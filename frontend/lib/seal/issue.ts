/**
 * AISCERN — Seal Issuance Library (Module 5.2)
 *
 * Generates HMAC-SHA256 signed seal numbers for every forensic scan.
 * Format: ASC-<8 base32 chars>-<2 checksum chars> e.g. ASC-7K3X9P2Q-4F
 *
 * - 8 base32 chars = 40 bits of entropy (~1 trillion combinations) — unguessable
 * - 2-char checksum = first 2 chars of HMAC(seal_body, SEAL_SIGNING_KEY)
 *   catches typos without hitting the DB
 * - Signature = HMAC-SHA256(scan_id|verdict|confidence, SEAL_SIGNING_KEY)
 *   stored in scan_seals.signature for server-side verification
 */

import crypto from 'crypto'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

const SEAL_PREFIX = 'ASC'
const SEAL_BODY_LENGTH = 8       // 8 base32 chars
const SEAL_CHECKSUM_LENGTH = 2   // 2 chars from HMAC

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567' // RFC 4648

function randomBase32(length: number): string {
  const bytes = crypto.randomBytes(length)
  let result = ''
  for (let i = 0; i < length; i++) {
    result += BASE32_ALPHABET[bytes[i] % 32]
  }
  return result
}

function getSigningKey(): string {
  const key = process.env.SEAL_SIGNING_KEY
  if (!key) {
    throw new Error(
      'SEAL_SIGNING_KEY not set. Generate with: openssl rand -hex 32'
    )
  }
  return key
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', getSigningKey()).update(payload).digest('hex')
}

function checksum(sealBody: string): string {
  return sign(sealBody).slice(0, SEAL_CHECKSUM_LENGTH).toUpperCase()
}

/**
 * Generate a new seal number. Format: ASC-XXXXXXXX-XX
 */
export function generateSealNumber(): string {
  const body = randomBase32(SEAL_BODY_LENGTH)
  const cs = checksum(body)
  return `${SEAL_PREFIX}-${body}-${cs}`
}

/**
 * Validate the format of a seal number (regex check only, no DB lookup).
 */
export function isValidSealFormat(seal: string): boolean {
  return /^ASC-[A-Z2-7]{8}-[A-Z0-9]{2}$/.test(seal)
}

/**
 * Verify the checksum of a seal number (catches typos without hitting DB).
 */
export function verifySealChecksum(seal: string): boolean {
  if (!isValidSealFormat(seal)) return false
  const parts = seal.split('-')
  const body = parts[1]
  const expectedCs = parts[2]
  return checksum(body) === expectedCs
}

/**
 * Issue a seal for a text/image/audio/video/pdf scan.
 * Inserts a row in scan_seals with the HMAC signature.
 *
 * @returns The seal number (e.g. ASC-7K3X9P2Q-4F)
 */
export async function issueSealForScan(
  scanId: string,
  verdict: string,
  confidence: number,
  payload: Record<string, unknown>
): Promise<string> {
  const sealNumber = generateSealNumber()
  const payloadStr = JSON.stringify(
    { scanId, verdict, confidence, ...payload },
    Object.keys(payload).sort()
  )
  const payloadHash = crypto.createHash('sha256').update(payloadStr).digest('hex')
  const signature = sign(`${scanId}|${verdict}|${confidence}`)

  const { error } = await getSupabaseAdmin()
    .from('scan_seals')
    .insert({
      seal_number: sealNumber,
      scan_id: scanId,
      signature,
      payload_hash: payloadHash,
    })

  if (error) throw new Error(`Failed to issue seal: ${error.message}`)
  return sealNumber
}

/**
 * Issue a seal for a site scan (web scanner).
 * Updates the existing site_scan_seals row with a seal_number + signature.
 */
export async function issueSealForSiteScan(
  siteScanSealHash: string,
  scanId: string,
  origin: string,
  pagesScanned: number
): Promise<string> {
  const sealNumber = generateSealNumber()
  const signature = sign(`${scanId}|${origin}|${pagesScanned}`)
  const payloadHash = crypto
    .createHash('sha256')
    .update(`${origin}|${pagesScanned}|${scanId}`)
    .digest('hex')

  const { error } = await getSupabaseAdmin()
    .from('site_scan_seals')
    .update({
      seal_number: sealNumber,
      signature,
      payload_hash: payloadHash,
    })
    .eq('hash', siteScanSealHash)

  if (error) throw new Error(`Failed to issue site seal: ${error.message}`)
  return sealNumber
}

/**
 * Build the public verification URL for a seal number.
 */
export function sealVerifyUrl(sealNumber: string | null): string | null {
  if (!sealNumber) return null
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://aiscern.com'
  return `${baseUrl}/verify/${sealNumber}`
}
