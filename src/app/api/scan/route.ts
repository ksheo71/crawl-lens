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
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 })
  }

  const parsed = Body.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'invalid body' }, { status: 400 })
  }

  let normalized: string
  try {
    normalized = normalizeUrl(parsed.data.url)
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid url' }, { status: 400 })
  }

  const publicId = newPublicId()
  try {
    await prisma.scan.create({
      data: {
        publicId,
        targetUrl: parsed.data.url,
        normalizedUrl: normalized,
        ipHash: ipHash(ip),
        userAgent: req.headers.get('user-agent') ?? undefined,
      },
    })
  } catch {
    return NextResponse.json(
      { ok: false, error: '서비스 일시 오류입니다. 잠시 후 다시 시도해주세요.' },
      { status: 503 },
    )
  }

  try {
    await scanQueue.add('scan', { publicId }, { removeOnComplete: 1000, removeOnFail: 5000 })
  } catch {
    await prisma.scan.delete({ where: { publicId } }).catch(() => {})
    return NextResponse.json(
      { ok: false, error: '서비스 일시 오류입니다. 잠시 후 다시 시도해주세요.' },
      { status: 503 },
    )
  }

  return NextResponse.json({ publicId, status: 'PENDING' }, { status: 201 })
}
