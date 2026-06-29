const CAT_LABEL: Record<string, string> = { meta: '메타', content: '콘텐츠', technical: '기술', performance: '성능' }

export function ScoreHero({ targetUrl, completedAt, total, categories }: {
  targetUrl: string; completedAt: string; total: number; categories: Record<string, number | null>
}) {
  return (
    <section className="mt-6 flex flex-col sm:flex-row gap-6 items-center">
      <div className="w-28 h-28 rounded-full bg-primary text-primary-foreground flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tabular-nums">{total}</span>
        <span className="text-xs opacity-80">/100</span>
      </div>
      <div className="flex-1">
        <p className="text-sm font-mono break-all">{targetUrl}</p>
        <p className="text-xs text-muted-foreground mt-1">검사 시각: {new Date(completedAt).toLocaleString('ko-KR')}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          {Object.keys(CAT_LABEL).map((k) => (
            <span key={k} className="px-2 py-1 rounded bg-muted tabular-nums">
              {CAT_LABEL[k]} {categories[k] ?? '—'}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
