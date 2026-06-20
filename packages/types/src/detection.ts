/**
 * Shared detection-domain types.
 * Mirror (not yet replace) the equivalents in frontend/types and admin —
 * see packages/types/README.md for migration status.
 */

export type DetectionModality = 'text' | 'image' | 'audio' | 'video';

export type ScanStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ScanResult {
  id: string;
  modality: DetectionModality;
  status: ScanStatus;
  /** 0-100 confidence that the content is AI-generated */
  aiProbability: number;
  createdAt: string;
}
