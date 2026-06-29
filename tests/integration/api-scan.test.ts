import { describe, it, expect, beforeAll, vi } from 'vitest'
import { POST } from '@/app/api/scan/route'
import { GET as STATUS } from '@/app/api/scan/[id]/status/route'
import { prisma } from '@/lib/db'

vi.mock('@/lib/queue', async (orig) => {
  const real = await orig<typeof import('@/lib/queue')>()
  return {
    ...real,
    scanQueue: { add: vi.fn().mockResolvedValue({ id: 'job-1' }) },
  }
})

beforeAll(async () => {
  await prisma.scan.deleteMany()
})

function req(body: object, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/scan', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

describe('POST /api/scan', () => {
  it('정상 URL → 201 + publicId', async () => {
    const res = await POST(req({ url: 'https://example.com/' }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.publicId).toMatch(/^[A-Za-z0-9_-]{10}$/)
    expect(json.status).toBe('PENDING')
  })

  it('잘못된 URL → 400', async () => {
    const res = await POST(req({ url: 'not-a-url' }))
    expect(res.status).toBe(400)
  })

  it('status 라우트가 PENDING 반환', async () => {
    const created = await POST(req({ url: 'https://other.test/' }))
    const { publicId } = await created.json()
    const res = await STATUS(new Request('http://localhost'), { params: Promise.resolve({ id: publicId }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('PENDING')
  })

  it('알 수 없는 publicId → 404', async () => {
    const res = await STATUS(new Request('http://localhost'), { params: Promise.resolve({ id: 'nonexistent' }) })
    expect(res.status).toBe(404)
  })
})
