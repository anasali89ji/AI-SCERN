/**
 * Aiscern Image v3 — CLIP Contrastive Detector
 * Uses HuggingFace zero-shot image classification via raw fetch.
 * NEW FILE — does not modify existing inference files.
 */

const HF_API = "https://api-inference.huggingface.co/models";
const CLIP_MODEL = "openai/clip-vit-large-patch14";

async function hfZeroShot(
  imageBuffer: Buffer,
  labels: string[]
): Promise<{ label: string; score: number }[]> {
  const token = process.env.HUGGINGFACE_API_TOKEN;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // CLIP zero-shot via the pipeline payload format
  const payload = {
    inputs: imageBuffer.toString("base64"),
    parameters: { candidate_labels: labels },
  };

  const res = await fetch(`${HF_API}/${CLIP_MODEL}`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) return [];
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) return [];
  return data as { label: string; score: number }[];
}

export class CLIPDetectorV3 {
  async detect(imageBuffer: Buffer): Promise<{ score: number; explanation: string }> {
    const labels = [
      "a real photograph taken with a camera",
      "an AI generated image",
      "an authentic natural photo",
      "a synthetic computer generated image",
    ];

    try {
      const results = await hfZeroShot(imageBuffer, labels);

      const realScore = results
        .filter((r) => r.label.includes("real") || r.label.includes("authentic") || r.label.includes("natural"))
        .reduce((sum, r) => sum + r.score, 0);

      const aiScore = results
        .filter((r) => r.label.includes("AI") || r.label.includes("synthetic") || r.label.includes("computer generated"))
        .reduce((sum, r) => sum + r.score, 0);

      const score = aiScore / (realScore + aiScore + 1e-8);

      return {
        score,
        explanation:
          aiScore > realScore
            ? "Image semantics align more with AI-generated descriptions"
            : "Image semantics align with real photograph descriptions",
      };
    } catch {
      return { score: 0.5, explanation: "CLIP detection unavailable" };
    }
  }
}
