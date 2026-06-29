import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function FailureView({ targetUrl, errorCode, errorMessage }: { targetUrl: string; errorCode: string; errorMessage: string }) {
  return (
    <section className="mt-10 text-center">
      <h2 className="text-2xl font-semibold">이 URL을 검사할 수 없었어요</h2>
      <p className="font-mono text-sm break-all mt-3">{targetUrl}</p>
      <p className="mt-4 text-muted-foreground">사유: {errorMessage || errorCode || '알 수 없음'}</p>
      <ul className="mt-6 text-left max-w-md mx-auto text-sm text-muted-foreground space-y-1">
        <li>· URL 오타가 없는지</li>
        <li>· 페이지가 공개되어 있는지 (로그인 필요 X)</li>
        <li>· robots.txt가 차단하지 않는지</li>
      </ul>
      <div className="mt-6 flex justify-center gap-3">
        <Link href="/" className={cn(buttonVariants({ variant: 'secondary' }))}>홈으로</Link>
      </div>
    </section>
  )
}
