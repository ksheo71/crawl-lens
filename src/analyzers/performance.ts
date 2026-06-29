import { env } from '@/lib/env'
import type { Analyzer, CheckResult, CheckStatus } from './types'

const PSI_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'
const METRICS = [
  { id: 'performance.lcp', title: 'Largest Contentful Paint', auditKey: 'largest-contentful-paint', weight: 6 },
  { id: 'performance.inp', title: 'Interaction to Next Paint', auditKey: 'interaction-to-next-paint', weight: 6 },
  { id: 'performance.cls', title: 'Cumulative Layout Shift', auditKey: 'cumulative-layout-shift', weight: 6 },
  { id: 'performance.tbt', title: 'Total Blocking Time', auditKey: 'total-blocking-time', weight: 3 },
] as const

function scoreToStatus(score: number | null | undefined): CheckStatus {
  if (score == null) return 'skip'
  if (score >= 0.9) return 'pass'
  if (score >= 0.5) return 'warn'
  return 'fail'
}

function skipAll(reason: 'PSI_QUOTA' | 'PSI_TIMEOUT' | 'PSI_FAIL'): CheckResult[] {
  return METRICS.map((m) => ({
    id: m.id,
    category: 'performance' as const,
    status: 'skip' as const,
    title: m.title,
    message: reason === 'PSI_QUOTA'
      ? '오늘의 PSI 호출 한도를 초과해 성능 측정을 건너뛰었어요.'
      : reason === 'PSI_TIMEOUT'
      ? 'PSI 응답이 60초 안에 오지 않아 건너뛰었어요.'
      : '성능 측정 중 오류가 발생해 건너뛰었어요.',
    detail: { reason },
    weight: m.weight,
  }))
}

const performanceAnalyzerImpl: Analyzer & {
  runPsi: (url: string, timeoutMs?: number) => Promise<unknown>
  run(ctx: any, opts?: { timeoutMs?: number }): Promise<CheckResult[]>
} = {
  name: 'performance',
  async runPsi(url: string, timeoutMs = 60_000) {
    const u = new URL(PSI_ENDPOINT)
    u.searchParams.set('url', url)
    u.searchParams.set('strategy', 'mobile')
    u.searchParams.set('key', env.PSI_API_KEY)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(u, { signal: controller.signal })
      if (res.status === 429) throw new Error('PSI_QUOTA')
      if (!res.ok) throw new Error('PSI_FAIL')
      return await res.json()
    } finally {
      clearTimeout(timer)
    }
  },
  async run(ctx, opts: { timeoutMs?: number } = {}): Promise<CheckResult[]> {
    let data: any
    try {
      data = await performanceAnalyzer.runPsi(ctx.normalizedUrl, opts.timeoutMs)
    } catch (err) {
      const msg = (err as Error).message
      if (msg === 'PSI_QUOTA') return skipAll('PSI_QUOTA')
      if ((err as Error).name === 'AbortError') return skipAll('PSI_TIMEOUT')
      return skipAll('PSI_FAIL')
    }
    const audits = data?.lighthouseResult?.audits ?? {}
    return METRICS.map((m) => {
      const a = audits[m.auditKey]
      const score = a?.score
      const status = scoreToStatus(score)
      return {
        id: m.id,
        category: 'performance' as const,
        status,
        title: m.title,
        message:
          status === 'skip' ? '측정값을 얻지 못했습니다.'
          : status === 'pass' ? `좋아요. (${a?.displayValue ?? ''})`
          : `개선이 필요합니다. (${a?.displayValue ?? ''})`,
        detail: { score, displayValue: a?.displayValue },
        docs: 'https://web.dev/articles/vitals',
        weight: m.weight,
      }
    })
  },
}

export const performanceAnalyzer = performanceAnalyzerImpl as Analyzer & {
  runPsi: (url: string, timeoutMs?: number) => Promise<unknown>
  run(ctx: any, opts?: { timeoutMs?: number }): Promise<CheckResult[]>
}
