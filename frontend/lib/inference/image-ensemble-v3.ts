/**
 * Aiscern Image v3 — Deep Learning Ensemble Engine
 * Uses HuggingFace Inference API via raw fetch (same pattern as hf-analyze.ts).
 * NEW FILE — does not modify existing hf-analyze.ts or image-detection-brain.ts
 */

const HF_API = "https://api-inference.huggingface.co/models";

export interface DLModelResult {
  model_id: string;
  raw_score: number;
  confidence: number;
  inference_time_ms: number;
}

export interface EnsembleConfig {
  models: {
    id: string;
    hf_model_id: string;
    weight: number;
  }[];
}

export const DEFAULT_ENSEMBLE_CONFIG_V3: EnsembleConfig = {
  models: [
    { id: "vit-genimage",    hf_model_id: "Organika/sdxl-detector",             weight: 0.35 },
    { id: "vit-primary",     hf_model_id: "google/vit-base-patch16-224",         weight: 0.25 },
    { id: "resnet-patch",    hf_model_id: "microsoft/resnet-50",                  weight: 0.20 },
    { id: "convnext-detect", hf_model_id: "facebook/convnext-tiny-224",           weight: 0.20 },
  ],
};

async function hfImageInference(
  modelId: string,
  imageBuffer: Buffer,
  timeoutMs = 15000
): Promise<unknown> {
  const token = process.env.HUGGINGFACE_API_TOKEN;
  const headers: Record<string, string> = { "Content-Type": "application/octet-stream" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${HF_API}/${modelId}`, {
      method: "POST",
      headers,
      body: new Uint8Array(imageBuffer),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) return null;
    return res.json();
  } catch {
    clearTimeout(timer);
    return null;
  }
}

function parseClassificationResult(result: unknown): number {
  if (!Array.isArray(result) || result.length === 0) return 0.5;

  const items = result as { label?: string; score?: number }[];

  const aiItem = items.find(
    (r) =>
      r.label?.toLowerCase().includes("ai") ||
      r.label?.toLowerCase().includes("fake") ||
      r.label?.toLowerCase().includes("generated") ||
      r.label?.toLowerCase().includes("artificial")
  );

  const realItem = items.find(
    (r) =>
      r.label?.toLowerCase().includes("real") ||
      r.label?.toLowerCase().includes("human") ||
      r.label?.toLowerCase().includes("authentic") ||
      r.label?.toLowerCase().includes("genuine")
  );

  if (aiItem && realItem) return aiItem.score ?? 0.5;

  // If label structure unknown, use top score as is (neutral 0.5 fallback)
  return 0.5;
}

export class ImageEnsembleEngineV3 {
  private config: EnsembleConfig;

  constructor(config: EnsembleConfig = DEFAULT_ENSEMBLE_CONFIG_V3) {
    this.config = config;
  }

  async analyze(imageBuffer: Buffer): Promise<DLModelResult[]> {
    const results: DLModelResult[] = [];

    for (const model of this.config.models) {
      const start = Date.now();
      try {
        const raw = await hfImageInference(model.hf_model_id, imageBuffer);
        const score = parseClassificationResult(raw);

        results.push({
          model_id: model.id,
          raw_score: score,
          confidence: Math.abs(score - 0.5) * 2,
          inference_time_ms: Date.now() - start,
        });
      } catch (e) {
        console.error(`[ImageEnsembleV3] Model ${model.id} failed:`, e);
        results.push({
          model_id: model.id,
          raw_score: 0.5,
          confidence: 0.0,
          inference_time_ms: Date.now() - start,
        });
      }
    }

    return results;
  }

  fuseResults(results: DLModelResult[]): { ensemble_score: number; confidence: number } {
    if (results.length === 0) return { ensemble_score: 0.5, confidence: 0 };

    let totalWeight = 0;
    let weightedSum = 0;

    for (const result of results) {
      const model = this.config.models.find((m) => m.id === result.model_id);
      if (!model) continue;
      const w = model.weight * Math.max(result.confidence, 0.1);
      weightedSum += result.raw_score * w;
      totalWeight += w;
    }

    const ensembleScore = totalWeight > 0 ? weightedSum / totalWeight : 0.5;
    const scores = results.map((r) => r.raw_score);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length;
    const agreementConfidence = 1 - Math.min(variance * 4, 1);

    return { ensemble_score: ensembleScore, confidence: agreementConfidence };
  }
}
