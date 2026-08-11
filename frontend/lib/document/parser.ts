import type { ParsedDocument } from './types'
import { extractPdf } from './extract-pdf'
import { extractDocx } from './extract-docx'
import { extractPptx } from './extract-pptx'

export class DocumentParseError extends Error {
  code = 'PARSE_FAILED' as const
}

function detectType(fileName: string, mimeType: string): 'pdf' | 'docx' | 'pptx' | null {
  const name = fileName.toLowerCase()
  if (mimeType === 'application/pdf' || name.endsWith('.pdf')) return 'pdf'
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.docx')
  ) return 'docx'
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    name.endsWith('.pptx')
  ) return 'pptx'
  return null
}

export async function parseDocument(buffer: Buffer, fileName: string, mimeType: string): Promise<ParsedDocument> {
  const documentType = detectType(fileName, mimeType)
  if (!documentType) {
    throw new DocumentParseError(`Unsupported document type for "${fileName}"`)
  }

  try {
    if (documentType === 'pdf') {
      const { text, paragraphs, images, pageCount } = await extractPdf(buffer)
      return { documentType, text, paragraphs, images, pageCount }
    }
    if (documentType === 'docx') {
      const { text, paragraphs, images } = await extractDocx(buffer)
      return { documentType, text, paragraphs, images }
    }
    const { text, paragraphs, images, pageCount } = await extractPptx(buffer)
    return { documentType, text, paragraphs, images, pageCount }
  } catch (e: any) {
    const err = new DocumentParseError(e?.message || 'Failed to parse document')
    err.cause = e
    throw err
  }
}
