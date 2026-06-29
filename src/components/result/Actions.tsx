'use client'
import Link from 'next/link'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function Actions({ publicId, status }: { publicId: string; status: string }) {
  const done = status === 'DONE'
  const copy = async () => {
    await navigator.clipboard.writeText(window.location.href)
  }
  return (
    <div className="no-print flex flex-wrap gap-2 items-center justify-between">
      <Link href="/" className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}>← 새 검사</Link>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={copy}>URL 복사</Button>
        {done && <a href={`/r/${publicId}/pdf`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>PDF</a>}
        {done && <a href={`/api/r/${publicId}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>JSON</a>}
      </div>
    </div>
  )
}
