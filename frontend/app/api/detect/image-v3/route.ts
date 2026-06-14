/**
 * Aiscern Image Detection v3 API Route
 * 6-layer cascade ensemble: Metadata → CV Forensics → DL Ensemble → LLM Judges → Specialized → Meta-Ensemble
 *
 * NEW ROUTE — does NOT modify existing /api/detect/image/route.ts
 * Existing route continues to work exactly as before.
 *
 * POST /api/detect/image-v3
 *   - multipart/form-data: file (image, max 10MB)
 *   - application/json: { r2Key, mimeType, fileName, fileSize }
 */
import { NextRequest, NextResponse } from "next/server";
import { ImageEnsembleEngineV3 } from "@/lib/inference/image-ensemble-v3";
import { queryGeminiVisionV3, queryGrokVisionV3 } from "@/lib/inference/llm-judges-v3";
import { MetaEnsembleV3 } from "@/lib/inference/meta-ensemble-v3";
import { checkRateLimitDB } from "@/lib/ratelimit-db";
import { creditGuard } from "@/lib/middleware/credit-guard";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getR2Buffer, r2Available } from "@/lib/storage/r2";
import { contentHash } from "@/lib/cache/detection-cache";
import { fireScanCompleted } from "@/lib/inngest/send-scan-event";

export const maxDuration = 60

const PYTHON_WORKER_URL =
  process.env.PYTHON_WORKER_URL || "http://localhost:8001";

interface PythonForensicResult {
  metadata: Record<string, unknown>;
  frequency_analysis: Record<string, unknown>;
  noise_analysis: Record<string, unknown>;
  texture_color: Record<string, unknown>;
  face_deepfake: Record<string, unknown>;
  watermark_detection: Record<string, unknown>;
  text_artifacts: Record<string, unknown>;
  composite_cv_score: number;
  cv_signals: Record<string, number>;
  version: string;
}

async function callPythonWorker(
  imageBuffer: Buffer,
  mimeType: string
): Promise<PythonForensicResult> {
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([new Uint8Array(imageBuffer)], { type: mimeType }),
    "image.jpg"
  );

  const response = await fetch(`${PYTHON_WORKER_URL}/analyze/image`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Python worker error: ${response.status}`);
  }

  return response.json() as Promise<PythonForensicResult>;
}

// Fallback result if Python worker is unavailable
function emptyPythonResult(): PythonForensicResult {
  return {
    metadata: { score: 0.5 },
    frequency_analysis: { high_freq_suppression: 0.5 },
    noise_analysis: { noise_uniformity_score: 0.5 },
    texture_color: { texture_smoothness_score: 0.5 },
    face_deepfake: { faces_detected: false, deepfake_score: 0.5 },
    watermark_detection: { overall_watermark_score: 0 },
    text_artifacts: { artifact_score: 0 },
    composite_cv_score: 0.5,
    cv_signals: {},
    version: "3.0.0-fallback",
  };
}

export async function POST(req: NextRequest) {
  const start = Date.now();

  // Rate limiting
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const rl = await checkRateLimitDB("image-v3", ip);
  if (rl.limited) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many requests" },
      },
      { status: 429 }
    );
  }

  // Auth & credit guard
  let userId: string;
  try {
    const guard = await creditGuard(req, "image");
    userId = guard.userId;
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "AUTH_ERROR", message: "Auth failed" } },
      { status: 401 }
    );
  }

  // Image input handling
  let imageBuffer: Buffer;
  let mimeType: string;
  let fileName: string;
  let fileSize: number;
  let r2Key: string | null = null;

  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await req.json()) as {
      r2Key?: string;
      mimeType?: string;
      fileName?: string;
      fileSize?: number;
    };
    if (!body.r2Key || typeof body.r2Key !== "string") {
      return NextResponse.json(
        { success: false, error: { code: "NO_KEY", message: "r2Key required" } },
        { status: 400 }
      );
    }
    if (!r2Available()) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "R2_UNAVAILABLE", message: "Storage not configured" },
        },
        { status: 503 }
      );
    }
    const r2 = await getR2Buffer(body.r2Key);
    imageBuffer = r2.buffer;
    mimeType = body.mimeType || r2.contentType;
    fileName = body.fileName || body.r2Key.split("/").pop() || "image";
    fileSize = body.fileSize || imageBuffer.length;
    r2Key = body.r2Key;
  } else {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json(
        { success: false, error: { code: "NO_FILE", message: "No file provided" } },
        { status: 400 }
      );
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_TYPE", message: "File must be an image" },
        },
        { status: 400 }
      );
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "TOO_LARGE", message: "Image must be under 10MB" },
        },
        { status: 400 }
      );
    }
    const bytes = await file.arrayBuffer();
    imageBuffer = Buffer.from(bytes);
    mimeType = file.type;
    fileName = file.name;
    fileSize = file.size;
  }

  try {
    // Content hash for deduplication (first 64KB)
    void contentHash(imageBuffer.subarray(0, 65536)); // dedup hash placeholder

    // Run all layers in parallel
    const pythonPromise = callPythonWorker(imageBuffer, mimeType).catch(
      (e) => {
        console.warn("[detect/image-v3] Python worker unavailable:", e.message);
        return emptyPythonResult();
      }
    );

    const ensemble = new ImageEnsembleEngineV3();
    const dlPromise = ensemble.analyze(imageBuffer);

    const base64Image = imageBuffer.toString("base64");

    const geminiPromise = queryGeminiVisionV3(
      base64Image,
      process.env.GEMINI_API_KEY || ""
    ).catch((e) => ({
      is_ai_generated: false,
      confidence: 0,
      reasoning: `Gemini error: ${(e as Error).message}`,
      artifact_flags: [] as string[],
      physical_inconsistencies: [] as string[],
      generator_guess: null,
    }));

    const grokPromise = queryGrokVisionV3(
      base64Image,
      process.env.GROK_API_KEY || ""
    ).catch((e) => ({
      is_ai_generated: false,
      confidence: 0,
      reasoning: `Grok error: ${(e as Error).message}`,
      artifact_flags: [] as string[],
      physical_inconsistencies: [] as string[],
      generator_guess: null,
    }));

    const [pythonResult, dlResults, geminiResult, grokResult] =
      await Promise.all([pythonPromise, dlPromise, geminiPromise, grokPromise]);

    // Layer fusion
    const meta = new MetaEnsembleV3();
    const fusedDL = ensemble.fuseResults(dlResults);

    const layerResults = [
      {
        layer_id: "metadata",
        score: (pythonResult.metadata?.score as number) ?? 0.5,
        confidence:
          ((pythonResult.metadata?.score as number) ?? 0.5) > 0.8 ||
          ((pythonResult.metadata?.score as number) ?? 0.5) < 0.2
            ? 0.9
            : 0.5,
        weight: 0.15,
        features: pythonResult.metadata,
      },
      {
        layer_id: "cv_forensics",
        score: pythonResult.composite_cv_score ?? 0.5,
        confidence: 0.7,
        weight: 0.20,
        features: {
          frequency: pythonResult.frequency_analysis,
          noise: pythonResult.noise_analysis,
          texture: pythonResult.texture_color,
        },
      },
      {
        layer_id: "dl_ensemble",
        score: fusedDL.ensemble_score,
        confidence: fusedDL.confidence,
        weight: 0.25,
        features: { model_results: dlResults },
      },
      {
        layer_id: "llm_judges",
        score:
          (geminiResult.is_ai_generated
            ? geminiResult.confidence
            : 1 - geminiResult.confidence) *
            0.5 +
          (grokResult.is_ai_generated
            ? grokResult.confidence
            : 1 - grokResult.confidence) *
            0.5,
        confidence: (geminiResult.confidence + grokResult.confidence) / 2,
        weight: 0.20,
        features: {
          gemini: geminiResult,
          grok: grokResult,
          generator_guess:
            geminiResult.generator_guess || grokResult.generator_guess,
        },
      },
      {
        layer_id: "specialized",
        score: Math.max(
          (pythonResult.face_deepfake?.deepfake_score as number) ?? 0,
          (pythonResult.watermark_detection?.overall_watermark_score as number) ?? 0,
          (pythonResult.text_artifacts?.artifact_score as number) ?? 0
        ),
        confidence: 0.8,
        weight: 0.20,
        features: {
          face: pythonResult.face_deepfake,
          watermark: pythonResult.watermark_detection,
          text: pythonResult.text_artifacts,
          face_details: (pythonResult.face_deepfake?.face_details as unknown[]) ?? [],
        },
      },
    ];

    const fused = meta.fuse(layerResults);
    const verdict = meta.toVerdict(fused);
    const processingTime = Date.now() - start;

    // Persist to database
    const { data: scanRow, error: insertErr } = await getSupabaseAdmin()
      .from("scans")
      .insert({
        user_id:
          userId && !userId.startsWith("anon_") ? userId : null,
        anon_id: userId.startsWith("anon_") ? userId : null,
        media_type: "image",
        file_name: fileName,
        file_size: fileSize,
        r2_key: r2Key,
        verdict: verdict.verdict,
        confidence_score: fused.calibrated_confidence,
        uncertainty: fused.uncertainty,
        signals: [
          {
            name: "Metadata Analysis",
            score: pythonResult.metadata?.score,
            details: pythonResult.metadata,
          },
          {
            name: "CV Forensics",
            score: pythonResult.composite_cv_score,
            details: {
              frequency: pythonResult.frequency_analysis,
              noise: pythonResult.noise_analysis,
            },
          },
          {
            name: "DL Ensemble",
            score: fusedDL.ensemble_score,
            details: dlResults,
          },
          {
            name: "Gemini Vision",
            score: geminiResult.confidence,
            details: geminiResult,
          },
          {
            name: "Grok Vision",
            score: grokResult.confidence,
            details: grokResult,
          },
          {
            name: "Face Deepfake",
            score: pythonResult.face_deepfake?.deepfake_score,
            details: pythonResult.face_deepfake,
          },
          {
            name: "Watermark Detection",
            score: pythonResult.watermark_detection?.overall_watermark_score,
            details: pythonResult.watermark_detection,
          },
          {
            name: "Text Artifacts",
            score: pythonResult.text_artifacts?.artifact_score,
            details: pythonResult.text_artifacts,
          },
        ],
        processing_time: processingTime,
        model_used: "image-ensemble-v3",
        model_version: "3.0.0",
        status: "complete",
        metadata: {
          format: mimeType,
          size_kb: Math.round(fileSize / 1024),
          generator_attribution: fused.generator_attribution,
          manipulation_regions: fused.manipulation_regions,
          layer_breakdown: layerResults.map((l) => ({
            layer: l.layer_id,
            score: l.score,
            weight: l.weight,
          })),
          python_worker_version: pythonResult.version,
        },
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("[detect/image-v3] scan insert error:", insertErr);
    }

    const scanId = scanRow?.id ?? null;

    if (scanId) {
      fireScanCompleted({
        scan_id: scanId,
        user_id: userId,
        media_type: "image",
        verdict: verdict.verdict,
        confidence: fused.calibrated_confidence,
        model_used: "image-ensemble-v3",
      });
    }

    return NextResponse.json({
      success: true,
      scan_id: scanId,
      result: {
        verdict: verdict.verdict,
        confidence: fused.calibrated_confidence,
        uncertainty: fused.uncertainty,
        generator_attribution: fused.generator_attribution,
        manipulation_regions: fused.manipulation_regions,
        processing_time: processingTime,
        layer_breakdown: layerResults.map((l) => ({
          layer: l.layer_id,
          score: Math.round(l.score * 100) / 100,
          confidence: Math.round(l.confidence * 100) / 100,
          weight: l.weight,
        })),
        forensic_details: {
          metadata: pythonResult.metadata,
          frequency_analysis: pythonResult.frequency_analysis,
          noise_analysis: pythonResult.noise_analysis,
          face_analysis: pythonResult.face_deepfake,
          watermark_detection: pythonResult.watermark_detection,
          text_artifacts: pythonResult.text_artifacts,
        },
      },
    });
  } catch (err) {
    console.error("[detect/image-v3]", err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ANALYSIS_FAILED",
          message:
            err instanceof Error ? err.message : "Analysis failed",
        },
      },
      { status: 500 }
    );
  }
}
