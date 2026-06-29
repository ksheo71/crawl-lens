import { describe, it, expect, vi } from 'vitest'

vi.mock('@/lib/env', () => ({
  env: {
    IP_HASH_SALT: 'salt',
    RATE_LIMIT_ALLOWLIST: '10.0.0.1',
    REDIS_URL: 'redis://localhost:6379/4',
  },
}))

import { checkRateLimit } from '@/lib/ratelimit'

describe('checkRateLimit', () => {
  it('초과 전엔 allowed=true', async () => {
    const r = await checkRateLimit('hash-' + Date.now())
    expect(r.allowed).toBe(true)
  })

  it('30회 초과 시 거부', async () => {
    const ip = 'hashLimit-' + Date.now()
    for (let i = 0; i < 30; i++) await checkRateLimit(ip)
    const r = await checkRateLimit(ip)
    expect(r.allowed).toBe(false)
  })
})
