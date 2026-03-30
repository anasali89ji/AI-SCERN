// DETECTION TYPES
export type Verdict    = 'AI' | 'HUMAN' | 'UNCERTAIN'
export type MediaType  = 'image' | 'video' | 'audio' | 'text' | 'url'
export type ScanStatus = 'pending' | 'processing' | 'complete' | 'failed'

export interface DetectionSignal {
  name:        string
  category:    string
  description: string
  weight:      number
  value:       number
  flagged:     boolean
}

export interface SentenceScore {
  text:       string    // FIX: was "sentence" — must match hf-analyze.ts output
  ai_score:   number
  perplexity: number    // FIX: was "index" — must match hf-analyze.ts output
}

export interface FrameScore {
  frame:          number
  time_sec:       number
  ai_score:       number
  face_detected?: boolean
}

export interface SegmentScore {
  start_sec: number
  end_sec:   number
  label:     string
  ai_score:  number
}

export interface DetectionResult {
  verdict:          Verdict
  confidence:       number
  signals:          DetectionSignal[]
  summary:          string
  model_used:       string
  model_version?:   string
  processing_time?: number
  sentence_scores?: SentenceScore[]
  frame_scores?:    FrameScore[]
  segment_scores?:  SegmentScore[]
}

// DATABASE TYPES
export interface Profile {
  id:            string
  email:         string
  display_name:  string | null
  avatar_url:    string | null
  plan:          'free' | 'pro' | 'enterprise'
  scan_count:    number
  monthly_scans: number
  created_at:    string
  updated_at:    string
}

export interface Scan {
  id:               string
  user_id:          string
  media_type:       MediaType
  file_name:        string | null
  file_url:         string | null
  file_size:        number | null
  r2_key:           string | null
  source_url:       string | null
  content_preview:  string | null
  verdict:          Verdict | null
  confidence_score: number | null
  signals:          DetectionSignal[]
  metadata:         Record<string, unknown>
  processing_time:  number | null
  model_used:       string | null
  model_version:    string | null
  status:           ScanStatus
  error_message:    string | null
  created_at:       string
}

export interface ScraperSession {
  id:               string
  user_id:          string
  target_url:       string
  domain:           string | null
  screenshot_url:   string | null
  page_title:       string | null
  page_description: string | null
  total_assets:     number
  ai_asset_count:   number
  overall_ai_score: number | null
  scraped_content:  ScrapedContentItem[]
  status:           'pending' | 'crawling' | 'analyzing' | 'complete' | 'failed'
  error_message:    string | null
  created_at:       string
}

export interface ScrapedContentItem {
  type:       'text' | 'image' | 'video' | 'audio'
  url?:       string
  content?:   string
  verdict:    Verdict
  confidence: number
  signals:    DetectionSignal[]
}

export interface UserStats {
  total_scans:    number
  ai_detected:    number
  human_detected: number
  uncertain:      number
  avg_confidence: number
  image_scans:    number
  video_scans:    number
  audio_scans:    number
  text_scans:     number
}

export interface APIResponse<T = unknown> {
  success: boolean
  data?:   T
  error?:  { code: string; message: string; details?: unknown }
  meta?:   { processing_time: number; request_id: string }
}
