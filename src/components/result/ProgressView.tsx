export function ProgressView({ targetUrl, progress }: { targetUrl: string; progress: number }) {
  return (
    <section className="mt-6">
      <p className="text-sm text-muted-foreground">검사 중…</p>
      <p className="font-mono text-sm break-all mt-1">{targetUrl}</p>
      <div className="mt-6 h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
      <ul className="mt-6 text-sm space-y-1">
        <li>{progress >= 10 ? '✓' : '⟳'} 페이지 가져오기</li>
        <li>{progress >= 50 ? '✓' : progress >= 10 ? '⟳' : '·'} 메타 / 콘텐츠 / 기술 검사</li>
        <li>{progress >= 95 ? '✓' : progress >= 50 ? '⟳' : '·'} 성능 측정 (Google PSI · 보통 20~40초)</li>
      </ul>
    </section>
  )
}
