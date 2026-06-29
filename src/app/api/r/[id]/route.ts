import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let scan: Awaited<ReturnType<typeof prisma.scan.findUnique>>
  try {
    scan = await prisma.scan.findUnique({ where: { publicId: id } })
  } catch {
    return NextResponse.json(
      { ok: false, error: '서비스 일시 오류입니다. 잠시 후 다시 시도해주세요.' },
      { status: 503 },
    )
  }
  if (!scan) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({
    publicId: scan.publicId,
    targetUrl: scan.targetUrl,
    normalizedUrl: scan.normalizedUrl,
    status: scan.status,
    errorCode: scan.errorCode,
    errorMessage: scan.errorMessage,
    fetchStatus: scan.fetchStatus,
    totalScore: scan.totalScore,
    categoryScores: scan.categoryScores,
    checks: scan.checks,
    createdAt: scan.createdAt,
    completedAt: scan.completedAt,
  })
}
