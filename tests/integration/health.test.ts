import { describe, it, expect } from 'vitest'
import { GET } from '@/app/api/health/route'
import { redisConnection } from '@/lib/queue'

describe('GET /api/health', () => {
  it('worker heartbeat 살아있을 때 ok', async () => {
    await redisConnection.set('worker:heartbeat', new Date().toISOString(), 'EX', 30)
    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.checks.worker.active).toBe(true)
  })
  it('worker heartbeat 없을 때 503', async () => {
    await redisConnection.del('worker:heartbeat')
    const res = await GET()
    expect(res.status).toBe(503)
  })
})
