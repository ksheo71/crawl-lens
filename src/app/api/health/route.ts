import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { redisConnection } from '@/lib/queue'

export async function GET() {
  const checks: Record<string, unknown> = {}
  let ok = true

  try {
    await prisma.$queryRaw`SELECT 1`
    checks.db = 'ok'
  } catch (e) {
    checks.db = (e as Error).message
    ok = false
  }

  try {
    await redisConnection.ping()
    checks.redis = 'ok'
  } catch (e) {
    checks.redis = (e as Error).message
    ok = false
  }

  const hb = await redisConnection.get('worker:heartbeat').catch(() => null)
  const hbAge = hb ? (Date.now() - Date.parse(hb)) / 1000 : null
  const workerOk = hbAge != null && hbAge < 30
  checks.worker = { active: workerOk, lastHeartbeat: hb }
  if (!workerOk) ok = false

  const today = new Date().toISOString().slice(0, 10)
  const [scanDone, scanFailed, psiUsed] = await Promise.all([
    redisConnection.get(`metric:scan:done:${today}`).catch(() => null),
    redisConnection.get(`metric:scan:failed:${today}`).catch(() => null),
    redisConnection.get(`metric:psi:quota_used:${today}`).catch(() => null),
  ])

  return NextResponse.json(
    {
      ok,
      checks,
      metrics: {
        scanDoneToday: Number(scanDone ?? 0),
        scanFailedToday: Number(scanFailed ?? 0),
        psiQuotaUsedToday: Number(psiUsed ?? 0),
      },
    },
    { status: ok ? 200 : 503 },
  )
}
