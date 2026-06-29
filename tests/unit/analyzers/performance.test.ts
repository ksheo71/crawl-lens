import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse, delay } from 'msw'
import { performanceAnalyzer } from '@/analyzers/performance'
import type { AnalyzeContext } from '@/analyzers/types'

vi.mock('@/lib/env', () => ({ env: { PSI_API_KEY: 'test-key' } }))

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const ctx: AnalyzeContext = {
  targetUrl: 'https://x.test/',
  normalizedUrl: 'https://x.test/',
  finalUrl: 'https://x.test/',
  html: '',
  // @ts-expect-error 사용 안 함
  $: null,
  responseHeaders: new Headers(),
  responseStatus: 200,
}

function psiResponse(scores: { lcp: number; inp: number; cls: number; tbt: number }) {
  return {
    lighthouseResult: {
      audits: {
        'largest-contentful-paint': { score: scores.lcp, displayValue: '2.5s' },
        'interaction-to-next-paint': { score: scores.inp, displayValue: '200ms' },
        'cumulative-layout-shift': { score: scores.cls, displayValue: '0.1' },
        'total-blocking-time': { score: scores.tbt, displayValue: '200ms' },
      },
    },
  }
}

describe('performanceAnalyzer', () => {
  it('좋은 점수: 모두 pass', async () => {
    server.use(http.get('https://www.googleapis.com/pagespeedonline/v5/runPagespeed', () =>
      HttpResponse.json(psiResponse({ lcp: 0.95, inp: 0.92, cls: 0.99, tbt: 0.95 })),
    ))
    const r = await performanceAnalyzer.run(ctx)
    expect(r.find((c) => c.id === 'performance.lcp')?.status).toBe('pass')
    expect(r.find((c) => c.id === 'performance.cls')?.status).toBe('pass')
  })

  it('낮은 점수: warn/fail', async () => {
    server.use(http.get('https://www.googleapis.com/pagespeedonline/v5/runPagespeed', () =>
      HttpResponse.json(psiResponse({ lcp: 0.3, inp: 0.6, cls: 0.45, tbt: 0.7 })),
    ))
    const r = await performanceAnalyzer.run(ctx)
    expect(r.find((c) => c.id === 'performance.lcp')?.status).toBe('fail')
    expect(r.find((c) => c.id === 'performance.inp')?.status).toBe('warn')
    expect(r.find((c) => c.id === 'performance.cls')?.status).toBe('fail')
  })

  it('429 quota → 모두 skip', async () => {
    server.use(http.get('https://www.googleapis.com/pagespeedonline/v5/runPagespeed', () =>
      HttpResponse.json({ error: { message: 'quota' } }, { status: 429 }),
    ))
    const r = await performanceAnalyzer.run(ctx)
    expect(r.every((c) => c.status === 'skip')).toBe(true)
    expect(r[0].detail).toMatchObject({ reason: 'PSI_QUOTA' })
  })

  it('타임아웃 → 모두 skip', async () => {
    server.use(http.get('https://www.googleapis.com/pagespeedonline/v5/runPagespeed', async () => {
      await delay(500)
      return HttpResponse.json({})
    }))
    const r = await performanceAnalyzer.run({ ...ctx } as AnalyzeContext, { timeoutMs: 100 })
    expect(r.every((c) => c.status === 'skip')).toBe(true)
    expect(r[0].detail).toMatchObject({ reason: 'PSI_TIMEOUT' })
  })
})
