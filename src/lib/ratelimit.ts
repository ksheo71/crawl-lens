import { redisConnection } from './queue'
import { env } from './env'

const LIMIT = 30
const WINDOW_SEC = 3600

const allowlist = new Set(
  env.RATE_LIMIT_ALLOWLIST.split(',').map((s) => s.trim()).filter(Boolean),
)

export function allowlistContains(ip: string): boolean {
  return allowlist.has(ip)
}

export async function checkRateLimit(ipHashOrIp: string): Promise<{ allowed: boolean; remaining: number }> {
  if (allowlist.has(ipHashOrIp)) return { allowed: true, remaining: LIMIT }
  const hour = new Date().toISOString().slice(0, 13).replace('T', '-')
  const key = `ratelimit:${ipHashOrIp}:${hour}`
  const n = await redisConnection.incr(key)
  if (n === 1) await redisConnection.expire(key, WINDOW_SEC)
  return { allowed: n <= LIMIT, remaining: Math.max(0, LIMIT - n) }
}
