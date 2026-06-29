import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { redisConnection, progressKey } from '@/lib/queue'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let scan: { status: string; errorMessage: string | null } | null
  let progressStr: string | null

  try {
    scan = await prisma.scan.findUnique({
      where: { publicId: id },
      select: { status: true, errorMessage: true },
    })
    progressStr = await redisConnection.get(progressKey(id))
  } catch {
    return NextResponse.json(
      { ok: false, error: '서비스 일시 오류입니다. 잠시 후 다시 시도해주세요.' },
      { status: 503 },
    )
  }

  if (!scan) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const progress = progressStr ? Number(progressStr) : undefined

  return NextResponse.json({
    status: scan.status,
    progress,
    error: scan.errorMessage ?? undefined,
  })
}
