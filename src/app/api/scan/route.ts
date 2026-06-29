import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { scanQueue } from '@/lib/queue'
import { newPublicId } from '@/lib/id'
import { normalizeUrl } from '@/lib/url'
import { extractIp, ipHash } from '@/lib/ipHash'
import { checkRateLimit, allowlistContains } from '@/lib/ratelimit'

const Body = z.object({ url: z.string().min(1) })

export async function POST(req: Request) {
  const ip = extractIp(req)
  const allowKey = allowlistContains(ip) ? ip : ipHash(ip)
  const rl = await checkRateLimit(allowKey)
  if (!rl.allowed) {
    return NextResponse.json({ error: '잠시 후 다시 시도해주세요.' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const parsed = Body.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  let normalized: string
  try {
    normalized = normalizeUrl(parsed.data.url)
  } catch {
    return NextResponse.json({ error: 'invalid url' }, { status: 400 })
  }

  const publicId = newPublicId()
  await prisma.scan.create({
    data: {
      publicId,
      targetUrl: parsed.data.url,
      normalizedUrl: normalized,
      ipHash: ipHash(ip),
      userAgent: req.headers.get('user-agent') ?? undefined,
    },
  })

  try {
    await scanQueue.add('scan', { publicId }, { removeOnComplete: 1000, removeOnFail: 5000 })
  } catch {
    await prisma.scan.delete({ where: { publicId } }).catch(() => {})
    return NextResponse.json(
      { error: '검사를 시작할 수 없었어요. 잠시 후 다시 시도해주세요.' },
      { status: 500 },
    )
  }

  return NextResponse.json({ publicId, status: 'PENDING' }, { status: 201 })
}
