import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { redisConnection, progressKey } from '@/lib/queue'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const scan = await prisma.scan.findUnique({
    where: { publicId: id },
    select: { status: true, errorMessage: true },
  })

  if (!scan) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const progressStr = await redisConnection.get(progressKey(id))
  const progress = progressStr ? Number(progressStr) : undefined

  return NextResponse.json({
    status: scan.status,
    progress,
    error: scan.errorMessage ?? undefined,
  })
}
