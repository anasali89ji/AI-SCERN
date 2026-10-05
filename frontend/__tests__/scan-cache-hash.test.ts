import { describe, expect, it } from 'vitest'
import { hashBuffer } from '@/lib/cache/scan-cache'

describe('hashBuffer', () => {
  it('is stable for identical content', () => {
    const a = Buffer.alloc(1024, 7)
    expect(hashBuffer(a)).toBe(hashBuffer(Buffer.from(a)))
    expect(hashBuffer(a)).toHaveLength(32)
  })

  it('distinguishes files that share the same first 64KB (old prefix-hash collision)', () => {
    const head = Buffer.alloc(70_000, 1)
    const a = Buffer.concat([head, Buffer.from('image-A-tail')])
    const b = Buffer.concat([head, Buffer.from('image-B-tail')])
    expect(hashBuffer(a)).not.toBe(hashBuffer(b))
  })

  it('uses a bounded-cost sampled hash above 32MB that still reacts to length and head/tail changes', () => {
    const size = 33 * 1024 * 1024
    const a = Buffer.alloc(size, 3)
    const longer = Buffer.alloc(size + 1, 3)
    const headEdit = Buffer.from(a); headEdit[10] = 9
    const tailEdit = Buffer.from(a); tailEdit[size - 10] = 9
    expect(hashBuffer(a)).toHaveLength(32)
    expect(hashBuffer(a)).not.toBe(hashBuffer(longer))
    expect(hashBuffer(a)).not.toBe(hashBuffer(headEdit))
    expect(hashBuffer(a)).not.toBe(hashBuffer(tailEdit))
  })
})
