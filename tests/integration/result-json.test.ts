import { describe, it, expect, beforeAll } from 'vitest'
import { GET } from '@/app/api/r/[id]/route'
import { prisma } from '@/lib/db'

beforeAll(async () => {
  await prisma.scan.deleteMany()
})

describe('GET /api/r/[id]', () => {
  it('존재 → 200', async () => {
    const s = await prisma.scan.create({
      data: { publicId: 'json-test-1', targetUrl: 'https://x.test/', normalizedUrl: 'https://x.test/' },
    })
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: s.publicId }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.publicId).toBe(s.publicId)
  })
  it('없음 → 404', async () => {
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'missing' }) })
    expect(res.status).toBe(404)
  })
})
