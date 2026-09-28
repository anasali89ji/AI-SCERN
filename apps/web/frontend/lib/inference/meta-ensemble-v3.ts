/**
 * Aiscern Image v3 — Meta-Ensemble & Bayesian Calibration
 * Weighted Bayesian fusion, uncertainty quantification, generator attribution.
 * NEW FILE — does not modify any existing inference files.
 */

export interface LayerResultV3 {
  layer_id: string;
  score: number;
  confidence: number;
  weight: number;
  features?: Record<string, unknown>;
}

export interface CalibratedResultV3 {
  final_score: number;
  calibrated_confidence: number;
  uncertainty: number;
  epistemic_uncertainty: number;
  aleatoric_uncertainty: number;
  generator_attribution: string | null;
  manipulation_regions: Array<{
    x: number;
    y: number;
    w: number;
    h: number;
    score: number;
    type: string;
  }>;
}

export class MetaEnsembleV3 {
  private calibrationParams: Map<string, { alpha: number; beta: number }>;

  constructor() {
    this.calibrationParams = new Map();
    this.loadCalibration();
  }

  private loadCalibration(): void {
    this.calibrationParams.set("metadata", { alpha: 2.0, beta: 1.5 });
    this.calibrationParams.set("cv_forensics", { alpha: 1.8, beta: 2.0 });
    this.calibrationParams.set("dl_ensemble", { alpha: 2.5, beta: 1.2 });
    this.calibrationParams.set("llm_judges", { alpha: 1.5, beta: 2.5 });
    this.calibrationParams.set("specialized", { alpha: 2.2, beta: 1.8 });
  }

  fuse(layers: LayerResultV3[]): CalibratedResultV3 {
    const calibrated: Array<{
      score: number;
      variance: number;
      weight: number;
    }> = [];

    for (const layer of layers) {
      const params = this.calibrationParams.get(layer.layer_id) || {
        alpha: 2,
        beta: 2,
      };

      const alpha = params.alpha * layer.confidence;
      const beta = params.beta * (1 - layer.confidence) + 0.1;

      const mean = alpha / (alpha + beta);
      const variance =
        (alpha * beta) /
        ((alpha + beta) ** 2 * (alpha + beta + 1));

      calibrated.push({
        score: mean,
        variance,
        weight: layer.weight * layer.confidence,
      });
    }

    let totalWeight = 0;
    let weightedScore = 0;
    let totalVariance = 0;

    for (const c of calibrated) {
      weightedScore += c.score * c.weight;
      totalWeight += c.weight;
      totalVariance += c.variance * c.weight ** 2;
    }

    const finalScore =
      totalWeight > 0 ? weightedScore / totalWeight : 0.5;

    const scores = calibrated.map((c) => c.score);
    const weights = calibrated.map((c) => c.weight);
    const epistemic = this.computeEpistemicUncertainty(scores, weights);
    const aleatoric = totalVariance / (totalWeight ** 2 + 1e-8);

    const totalUncertainty = Math.sqrt(epistemic ** 2 + aleatoric ** 2);
    const calibratedConfidence = Math.max(0, 1 - totalUncertainty * 2);

    const attribution = this.attributeGenerator(layers);
    const regions = this.extractManipulationRegions(layers);

    return {
      final_score: finalScore,
      calibrated_confidence: calibratedConfidence,
      uncertainty: totalUncertainty,
      epistemic_uncertainty: epistemic,
      aleatoric_uncertainty: aleatoric,
      generator_attribution: attribution,
      manipulation_regions: regions,
    };
  }

  private computeEpistemicUncertainty(
    scores: number[],
    weights: number[]
  ): number {
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const weightedMean =
      scores.reduce((a, b, i) => a + b * weights[i], 0) /
      (totalWeight + 1e-8);

    const variance =
      scores.reduce((a, b, i) => {
        return a + weights[i] * (b - weightedMean) ** 2;
      }, 0) /
      (totalWeight + 1e-8);

    return Math.sqrt(variance);
  }

  private attributeGenerator(layers: LayerResultV3[]): string | null {
    const guesses = new Map<string, number>();

    for (const layer of layers) {
      const features = layer.features as Record<string, unknown> | undefined;
      if (features?.generator_guess && typeof features.generator_guess === "string") {
        const g = features.generator_guess;
        guesses.set(g, (guesses.get(g) ?? 0) + layer.weight);
      }
      if (features?.generator_family && typeof features.generator_family === "string") {
        const g = features.generator_family;
        guesses.set(g, (guesses.get(g) ?? 0) + layer.weight);
      }
    }

    if (guesses.size === 0) return null;

    let bestGuess: string | null = null;
    let bestWeight = 0;

    for (const [guess, weight] of guesses) {
      if (weight > bestWeight) {
        bestWeight = weight;
        bestGuess = guess;
      }
    }

    return bestGuess;
  }

  private extractManipulationRegions(
    layers: LayerResultV3[]
  ): CalibratedResultV3["manipulation_regions"] {
    const regions: CalibratedResultV3["manipulation_regions"] = [];

    for (const layer of layers) {
      const features = layer.features as Record<string, unknown> | undefined;
      if (Array.isArray(features?.manipulation_regions)) {
        regions.push(
          ...(features.manipulation_regions as CalibratedResultV3["manipulation_regions"])
        );
      }
      if (Array.isArray(features?.face_details)) {
        for (const face of features.face_details as Array<Record<string, unknown>>) {
          if (typeof face.composite_score === "number" && face.composite_score > 0.6) {
            const bb = face.bounding_box as number[];
            regions.push({
              x: bb[0],
              y: bb[1],
              w: bb[2] - bb[0],
              h: bb[3] - bb[1],
              score: face.composite_score,
              type: "face_deepfake",
            });
          }
        }
      }
    }

    return regions;
  }

  toVerdict(result: CalibratedResultV3): {
    verdict: "AI" | "HUMAN" | "UNCERTAIN" | "AI-ENHANCED";
    confidence: number;
  } {
    const { final_score, calibrated_confidence, uncertainty } = result;

    const uncertainBand = 0.15 + uncertainty * 0.2;
    const lowerThreshold = 0.5 - uncertainBand;
    const upperThreshold = 0.5 + uncertainBand;

    if (final_score >= upperThreshold) {
      return { verdict: "AI", confidence: calibrated_confidence };
    } else if (final_score <= lowerThreshold) {
      return { verdict: "HUMAN", confidence: calibrated_confidence };
    } else {
      return { verdict: "UNCERTAIN", confidence: 1 - calibrated_confidence };
    }
  }
}
