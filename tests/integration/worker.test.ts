import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { processScan } from '@/worker/scan'
import { prisma } from '@/lib/db'
import { newPublicId } from '@/lib/id'

vi.mock('@/lib/env', () => ({
  env: {
    PSI_API_KEY: 'k',
    DATABASE_URL: process.env.DATABASE_URL!,
    REDIS_URL: process.env.REDIS_URL!,
    IP_HASH_SALT: 'salt',
    PUBLIC_BASE_URL: 'http://localhost',
    RATE_LIMIT_ALLOWLIST: '',
    NODE_ENV: 'test',
  },
}))

const server = setupServer(
  http.get('https://target.test/', () => new HttpResponse(
    `<html lang="ko"><head><title>좋은 제목입니다 충분히 길어요 약 30자</title>
    <meta name="description" content="설명입니다 충분히 길어요 약 50자 이상이 되도록 적습니다.">
    <link rel="canonical" href="https://target.test/">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta property="og:title" content="x"><meta property="og:description" content="x"><meta property="og:image" content="x">
    </head><body><h1>제목</h1><p>${'본문 '.repeat(100)}</p><a href="/x">내부</a></body></html>`,
    { status: 200, headers: { 'content-type': 'text/html' } },
  )),
  http.get('https://target.test/robots.txt', () => HttpResponse.text('User-agent: *\nAllow: /')),
  http.get('https://target.test/sitemap.xml', () => HttpResponse.text('<urlset/>')),
  http.get('https://www.googleapis.com/pagespeedonline/v5/runPagespeed', () => HttpResponse.json({
    lighthouseResult: { audits: {
      'largest-contentful-paint': { score: 0.95, displayValue: '2.4s' },
      'interaction-to-next-paint': { score: 0.95, displayValue: '180ms' },
      'cumulative-layout-shift': { score: 0.99, displayValue: '0.05' },
      'total-blocking-time': { score: 0.95, displayValue: '150ms' },
    }},
  })),
)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

describe('processScan', () => {
  it('end-to-end: PENDING → DONE with score', async () => {
    const publicId = newPublicId()
    await prisma.scan.create({
      data: {
        publicId,
        targetUrl: 'https://target.test/',
        normalizedUrl: 'https://target.test/',
      },
    })
    const before = await prisma.scan.findUnique({ where: { publicId } })
    expect(before?.status).toBe('PENDING')
    await processScan(publicId)
    const after = await prisma.scan.findUnique({ where: { publicId } })
    expect(after?.status).toBe('DONE')
    expect(after?.totalScore).toBeGreaterThanOrEqual(70)
    expect(Array.isArray(after?.checks)).toBe(true)
  })
})
