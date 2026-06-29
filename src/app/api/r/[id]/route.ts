import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const scan = await prisma.scan.findUnique({ where: { publicId: id } })
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
