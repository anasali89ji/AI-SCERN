import { describe, it, expect } from 'vitest'
import { contentHash } from '@/lib/cache/detection-cache'

/**
 * CACHE-IMG-1 / CACHE-AUD-1 regression: the image and audio detect routes
 * previously hashed only `buffer.subarray(0, 65536)`. Two different files
 * that share their first 64 KiB (same container header / camera profile /
 * embedded thumbnail / re-saved edit) received the SAME cache key and the
 * second file was served the first file's verdict.
 */
describe('detection-cache contentHash (CACHE-IMG-1 / CACHE-AUD-1)', () => {
  const HEAD = Buffer.alloc(96 * 1024, 0xAB) // 96 KiB shared prefix > 64 KiB slice

  function fileWith(tailByte: number): Buffer {
    const tail = Buffer.alloc(4096, tailByte) // distinct tail bytes
    return Buffer.concat([HEAD, tail])
  }

  it('differentiates files that share their first 64 KiB', () => {
    const h1 = contentHash(fileWith(0x01))
    const h2 = contentHash(fileWith(0x02))
    expect(h1).not.toBe(h2)
  })

  it('is stable for identical buffers (cache hits still work)', () => {
    expect(contentHash(fileWith(0x01))).toBe(contentHash(fileWith(0x01)))
  })

  it('differentiates files that differ only in length', () => {
    const a = Buffer.concat([HEAD, Buffer.alloc(1, 0x01)])
    const b = Buffer.concat([HEAD, Buffer.alloc(2048, 0x01)])
    expect(contentHash(a)).not.toBe(contentHash(b))
  })

  it('uses the large-file sampling path without colliding on shared heads', () => {
    // > 32 MB exercises the length+head+tail+samples branch
    const big = Buffer.alloc(33 * 1024 * 1024, 0x11)
    const big2 = Buffer.alloc(33 * 1024 * 1024, 0x11)
    big2[big2.length - 1] = 0x22 // differ only in the last byte (inside tail sample)
    expect(contentHash(big)).not.toBe(contentHash(big2))
  })
})
