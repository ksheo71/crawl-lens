import { describe, it, expect, vi } from 'vitest'
vi.mock('@/lib/env', () => ({ env: { IP_HASH_SALT: 'salt-for-test-1234' } }))
import { ipHash, extractIp } from '@/lib/ipHash'
describe('ipHash', () => {
  it('deterministic for same input', () => {
    expect(ipHash('1.2.3.4')).toBe(ipHash('1.2.3.4'))
  })
  it('differs for different IPs', () => {
    expect(ipHash('1.2.3.4')).not.toBe(ipHash('5.6.7.8'))
  })
  it('returns 64-char hex', () => {
    expect(ipHash('1.2.3.4')).toMatch(/^[a-f0-9]{64}$/)
  })
})
describe('extractIp', () => {
  it('prefers x-forwarded-for[0]', () => {
    const r = new Request('http://x/', { headers: { 'x-forwarded-for': '1.2.3.4, 10.0.0.1' } })
    expect(extractIp(r)).toBe('1.2.3.4')
  })
  it('falls back to x-real-ip', () => {
    const r = new Request('http://x/', { headers: { 'x-real-ip': '9.9.9.9' } })
    expect(extractIp(r)).toBe('9.9.9.9')
  })
  it('returns "unknown" otherwise', () => {
    expect(extractIp(new Request('http://x/'))).toBe('unknown')
  })
})
