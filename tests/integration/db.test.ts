import { describe, it, expect, beforeAll } from 'vitest'
import { prisma } from '@/lib/db'
import { newPublicId } from '@/lib/id'

beforeAll(async () => {
  await prisma.scan.deleteMany()
})

describe('Scan 모델', () => {
  it('생성·조회 round-trip', async () => {
    const publicId = newPublicId()
    const created = await prisma.scan.create({
      data: {
        publicId,
        targetUrl: 'https://example.com/',
        normalizedUrl: 'https://example.com/',
      },
    })
    const found = await prisma.scan.findUnique({ where: { publicId } })
    expect(found?.id).toBe(created.id)
    expect(found?.status).toBe('PENDING')
  })
})
