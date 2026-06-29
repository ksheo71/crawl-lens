import { stat, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { pdfQueue, pdfQueueEvents } from '@/lib/queue'
import { env } from '@/lib/env'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const file = join(env.PDF_CACHE_DIR, `${id}.pdf`)

  const cached = await stat(file).catch(() => null)
  if (cached) return streamPdf(file, id)

  let scan: { status: string } | null
  try {
    scan = await prisma.scan.findUnique({ where: { publicId: id }, select: { status: true } })
  } catch {
    return NextResponse.json(
      { ok: false, error: '서비스 일시 오류입니다. 잠시 후 다시 시도해주세요.' },
      { status: 503 },
    )
  }
  if (!scan) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (scan.status !== 'DONE') return NextResponse.json({ error: 'scan not completed' }, { status: 409 })

  let job: Awaited<ReturnType<typeof pdfQueue.add>>
  try {
    job = await pdfQueue.add('pdf', { publicId: id }, { removeOnComplete: 100, removeOnFail: 100 })
  } catch {
    return NextResponse.json(
      { ok: false, error: '서비스 일시 오류입니다. 잠시 후 다시 시도해주세요.' },
      { status: 503 },
    )
  }
  try {
    await job.waitUntilFinished(pdfQueueEvents, 60_000)
  } catch {
    return NextResponse.json({ error: 'pdf generation timeout' }, { status: 504 })
  }
  return streamPdf(file, id)
}

async function streamPdf(file: string, publicId: string) {
  const buf = await readFile(file)
  return new Response(buf, {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'cache-control': 'public, max-age=31536000, immutable',
      'content-disposition': `inline; filename="crawl-lens-${publicId}.pdf"`,
    },
  })
}
