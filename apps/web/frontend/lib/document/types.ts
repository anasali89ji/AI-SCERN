export interface ExtractedImage {
  index: number
  buffer: Buffer
  mimeType: string
  ext: string
  width?: number
  height?: number
}

export interface ParsedDocument {
  documentType: 'pdf' | 'docx' | 'pptx'
  text: string
  paragraphs: string[]
  images: ExtractedImage[]
  pageCount?: number
}
