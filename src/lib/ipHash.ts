import { createHash } from 'node:crypto'
import { env } from './env'

export function ipHash(ip: string): string {
  return createHash('sha256').update(ip + env.IP_HASH_SALT).digest('hex')
}

export function extractIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for') ?? ''
  const first = xff.split(',')[0]?.trim()
  return first || req.headers.get('x-real-ip') || 'unknown'
}
