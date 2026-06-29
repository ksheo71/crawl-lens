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
  // PSI 타임아웃(최대 60s)을 커버하기 위해 90s로 완화. 워커 키 EX는 120s로 설정.
  const workerOk = hbAge != null && hbAge < 90
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
