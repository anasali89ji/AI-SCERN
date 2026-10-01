export interface ExtractedImage {
  index: number
  buffer: Buffer
  mimeType: string
  ext: string
  width?: number
  height?: number
  /** Module 2.1: set when an image was detected but couldn't be decoded
   * (e.g. unsupported ColorSpace, malformed PNG predictor). Buffer is empty —
   * callers should skip these in actual analysis but include them in
   * audit trails ("N images detected, M decoded"). */
  note?: string
}

export interface ParsedDocument {
  documentType: 'pdf' | 'docx' | 'pptx'
  text: string
  paragraphs: string[]
  images: ExtractedImage[]
  pageCount?: number
}
