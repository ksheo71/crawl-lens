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
  if (cached) return streamPdf(file)

  const scan = await prisma.scan.findUnique({ where: { publicId: id }, select: { status: true } })
  if (!scan) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (scan.status !== 'DONE') return NextResponse.json({ error: 'scan not completed' }, { status: 409 })

  const job = await pdfQueue.add('pdf', { publicId: id }, { removeOnComplete: 100, removeOnFail: 100 })
  try {
    await job.waitUntilFinished(pdfQueueEvents, 60_000)
  } catch {
    return NextResponse.json({ error: 'pdf generation timeout' }, { status: 504 })
  }
  return streamPdf(file)
}

async function streamPdf(file: string) {
  const buf = await readFile(file)
  return new Response(buf, {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'cache-control': 'public, max-age=31536000, immutable',
      'content-disposition': `inline; filename="crawl-lens-${Date.now()}.pdf"`,
    },
  })
}
