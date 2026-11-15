/**
 * SCANNER-HANG-1 regression tests — crawlSite worker-pool termination.
 *
 * The pre-fix worker pool deadlocked when the maxPages cap was reached while
 * a worker was mid-fetch: that worker enqueued the fetched page's links, so
 * no resolve condition ever fired, no worker was left to dequeue, and
 * crawlSite hung until the platform timeout killed the route. These tests
 * crawl a link-farm fixture (every page links to more pages, so the queue
 * can never drain before the cap) and assert crawlSite RETURNS.
 *
 * vitest's per-test timeout is the failure mode: without the fix the first
 * test never settles and times out.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// DNS must not be hit from tests — safeFetch resolves every URL first.
const { lookupMock } = vi.hoisted(() => ({ lookupMock: vi.fn() }))
vi.mock('node:dns', () => ({
  lookup: (...args: unknown[]) => lookupMock(...args),
}))

import { crawlSite } from '../crawler'

const ORIGIN = 'https://linkfarm.example.com'

/** Every page is an article linking to three fresh pages — the queue can
 *  never drain before the maxPages cap is hit. */
function pageHtml(path: string): string {
  const clean = path.replace(/^\//, '') || 'root'
  return `<html><head><title>Page ${clean}</title></head><body>
    <article><h1>Article ${clean}</h1>
    <p>${'This is substantive article body text used to exercise the page parser. '.repeat(6)}</p>
    <a href="/${clean}-a">read a</a>
    <a href="/${clean}-b">read b</a>
    <a href="/${clean}-c">read c</a>
    </article></body></html>`
}

const notFound = {
  ok: false,
  status: 404,
  headers: { get: () => 'text/plain' },
  text: async () => '',
} as unknown as Response

beforeEach(() => {
  lookupMock.mockImplementation((...args: unknown[]) => {
    const cb = args[args.length - 1] as ((err: Error | null, res?: unknown) => void) | undefined
    if (typeof cb !== 'function') return
    cb(null, [{ address: '93.184.216.34', family: 4 }])
  })

  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
    const u = String(input instanceof Request ? input.url : input)
    if (!u.startsWith(ORIGIN)) return notFound // r.jina.ai etc. → direct fetch wins the race
    if (u.includes('robots.txt') || u.includes('sitemap.xml')) return notFound
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'text/html' },
      text: async () => pageHtml(u.slice(ORIGIN.length)),
    } as unknown as Response
  }))
})

afterEach(() => vi.unstubAllGlobals())

describe('crawlSite termination (SCANNER-HANG-1)', () => {
  it('returns when the maxPages cap is hit even though the last fetched page enqueues more links', async () => {
    const result = await crawlSite(`${ORIGIN}/start`, {
      maxPages: 10,
      maxImagesTotal: 10,
      maxDepth: 3,
      respectRobots: false,
    })

    // The crawl MUST return: this line is only reached if no deadlock.
    expect(result.pages.length).toBeGreaterThanOrEqual(1)
    // Cap respected (workers already mid-fetch may overshoot by < CONCURRENCY).
    expect(result.pages.length).toBeLessThanOrEqual(10 + 4)
  }, 10_000) // pre-fix code hangs forever → this timeout is the failure

  it('resolves for a site with fewer pages than the cap (queue drains naturally)', async () => {
    // maxDepth 0 → only the start page is fetched, no links enqueued
    const result = await crawlSite(`${ORIGIN}/only`, {
      maxPages: 5,
      maxImagesTotal: 5,
      maxDepth: 0,
      respectRobots: false,
    })
    expect(result.pages.length).toBe(1)
    expect(result.pages[0].url).toBe(`${ORIGIN}/only`)
    expect(result.fetchStats.direct).toBeGreaterThanOrEqual(1)
  }, 10_000)

  it('terminates when every fetch fails (failed URLs must not wedge the pool)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => notFound))
    const result = await crawlSite(`${ORIGIN}/dead`, {
      maxPages: 5,
      maxImagesTotal: 5,
      maxDepth: 2,
      respectRobots: false,
    })
    expect(result.pages.length).toBe(0)
    expect(result.failedUrls.length).toBe(1)
  }, 10_000)
})
