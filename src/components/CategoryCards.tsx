import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const cats = [
  { title: '메타', body: 'title · description · canonical · OG · Twitter Card · viewport · lang' },
  { title: '콘텐츠', body: 'h1 · 헤딩 계층 · alt 비율 · 워드카운트 · 내부/외부 링크' },
  { title: '기술', body: 'HTTPS · robots.txt · sitemap · JSON-LD · X-Robots-Tag' },
  { title: '성능', body: 'LCP · INP · CLS · TBT (Google PageSpeed Insights)' },
]

export function CategoryCards() {
  return (
    <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-4xl">
      {cats.map((c) => (
        <Card key={c.title}>
          <CardHeader><CardTitle className="text-base">{c.title}</CardTitle></CardHeader>
          <CardContent className="text-xs text-muted-foreground">{c.body}</CardContent>
        </Card>
      ))}
    </div>
  )
}
