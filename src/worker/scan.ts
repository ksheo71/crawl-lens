import * as cheerio from 'cheerio'
import { prisma } from '@/lib/db'
import { fetchPage } from '@/lib/fetcher'
import { metaAnalyzer } from '@/analyzers/meta'
import { contentAnalyzer } from '@/analyzers/content'
import { technicalAnalyzer } from '@/analyzers/technical'
import { performanceAnalyzer } from '@/analyzers/performance'
import { aggregate } from '@/lib/score'
import { redisConnection, progressKey } from '@/lib/queue'
import type { AnalyzeContext, CheckResult } from '@/analyzers/types'

async function setProgress(publicId: string, p: number) {
  await redisConnection.set(progressKey(publicId), String(p), 'EX', 600)
}

export async function processScan(publicId: string): Promise<void> {
  const scan = await prisma.scan.findUnique({ where: { publicId } })
  if (!scan) throw new Error(`scan not found: ${publicId}`)

  await prisma.scan.update({
    where: { publicId },
    data: { status: 'RUNNING', startedAt: new Date() },
  })
  await setProgress(publicId, 0)

  const fetchRes = await fetchPage(scan.targetUrl, { timeoutMs: 15_000 })
  if (!fetchRes.ok) {
    await prisma.scan.update({
      where: { publicId },
      data: {
        status: 'FAILED',
        errorCode: fetchRes.code,
        errorMessage: messageFor(fetchRes.code, fetchRes.status),
        fetchStatus: fetchRes.status ?? null,
        completedAt: new Date(),
      },
    })
    await setProgress(publicId, 100)
    return
  }

  await setProgress(publicId, 10)

  const $ = cheerio.load(fetchRes.body)
  const ctx: AnalyzeContext = {
    targetUrl: scan.targetUrl,
    normalizedUrl: scan.normalizedUrl,
    finalUrl: fetchRes.finalUrl,
    html: fetchRes.body,
    $,
    responseHeaders: fetchRes.headers,
    responseStatus: fetchRes.status,
  }

  const [meta, content, technical] = await Promise.all([
    safe(metaAnalyzer.run(ctx)),
    safe(contentAnalyzer.run(ctx)),
    safe(technicalAnalyzer.run(ctx)),
  ])
  await setProgress(publicId, 50)
  const performance = await safe(performanceAnalyzer.run(ctx))
  await setProgress(publicId, 95)

  const checks: CheckResult[] = [...meta, ...content, ...technical, ...performance]
  const { total, categories } = aggregate(checks)

  await prisma.scan.update({
    where: { publicId },
    data: {
      status: 'DONE',
      fetchStatus: fetchRes.status ?? null,
      totalScore: total,
      categoryScores: categories,
      checks: checks as unknown as object,
      completedAt: new Date(),
    },
  })
  await setProgress(publicId, 100)
}

async function safe<T>(p: Promise<T[]>): Promise<T[]> {
  try { return await p } catch { return [] as T[] }
}

function messageFor(code: string, status?: number): string {
  switch (code) {
    case 'DNS_FAIL': return '도메인을 찾을 수 없어요'
    case 'CONN_FAIL': return '서버에 연결할 수 없었어요'
    case 'TIMEOUT': return '응답이 너무 느려요'
    case 'HTTP_4XX': return `페이지가 ${status ?? 4}xx를 반환했어요`
    case 'HTTP_5XX': return `서버 오류(${status ?? 5}xx)가 발생했어요`
    case 'PARSE_FAIL': return '페이지가 HTML이 아니거나 깨져 있어요'
    default: return '알 수 없는 오류가 발생했어요'
  }
}
