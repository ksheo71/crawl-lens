import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { ResultClient } from './ResultClient'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const scan = await prisma.scan.findUnique({ where: { publicId: id } })
  if (!scan) notFound()
  return <ResultClient initial={JSON.parse(JSON.stringify(scan))} />
}
