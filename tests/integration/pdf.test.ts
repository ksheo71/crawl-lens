import { describe, it, expect, vi, beforeAll } from 'vitest'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { GET } from '@/app/r/[id]/pdf/route'
import { prisma } from '@/lib/db'

const CACHE = '/tmp/crawl-lens-pdf-test'

vi.mock('@/lib/env', async (orig) => {
  const e = (await orig<typeof import('@/lib/env')>()).env
  return { env: { ...e, PDF_CACHE_DIR: '/tmp/crawl-lens-pdf-test' } }
})

// pdfQueue와 pdfQueueEvents를 모킹해 Redis 연결 없이 테스트 가능하게 함
vi.mock('@/lib/queue', async () => {
  return {
    pdfQueue: { add: vi.fn() },
    pdfQueueEvents: {},
    redisConnection: { set: vi.fn(), quit: vi.fn() },
    scanQueue: { add: vi.fn() },
    progressKey: (id: string) => `scan:progress:${id}`,
  }
})

beforeAll(async () => {
  await mkdir(CACHE, { recursive: true })
  await prisma.scan.deleteMany()
})

describe('GET /r/[id]/pdf', () => {
  it('캐시 hit 시 즉시 PDF', async () => {
    const publicId = 'pdf-cached'
    await prisma.scan.create({
      data: { publicId, targetUrl: 'https://x.test/', normalizedUrl: 'https://x.test/', status: 'DONE' },
    })
    await writeFile(join(CACHE, `${publicId}.pdf`), Buffer.from('%PDF-stub'))
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: publicId }) })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
  })

  it('Scan 없음 → 404', async () => {
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'missing' }) })
    expect(res.status).toBe(404)
  })

  it('Scan PENDING → 409', async () => {
    await prisma.scan.create({
      data: { publicId: 'pdf-pending', targetUrl: 'https://x/', normalizedUrl: 'https://x/' },
    })
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'pdf-pending' }) })
    expect(res.status).toBe(409)
  })
})
