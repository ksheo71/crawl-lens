'use client'
import { useState, useMemo } from 'react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

type Check = {
  id: string; category: string; status: 'pass' | 'warn' | 'fail' | 'skip'
  title: string; message: string; detail?: unknown; fix?: string; docs?: string
}

const CAT_ORDER = ['meta', 'content', 'technical', 'performance'] as const
const CAT_LABEL: Record<string, string> = { meta: '메타데이터', content: '콘텐츠 구조', technical: '기술적 SEO', performance: '성능' }
const ICON: Record<string, string> = { pass: '✓', warn: '⚠', fail: '✗', skip: '−' }
const COLOR: Record<string, string> = {
  pass: 'text-emerald-600', warn: 'text-amber-600', fail: 'text-red-600', skip: 'text-muted-foreground',
}

export function CheckList({ checks }: { checks: Check[] }) {
  const [filter, setFilter] = useState<'all' | 'pass' | 'warn' | 'fail'>('all')

  const filtered = useMemo(() => filter === 'all' ? checks : checks.filter((c) => c.status === filter), [checks, filter])
  const grouped = useMemo(() => {
    const m = new Map<string, Check[]>()
    for (const c of filtered) {
      if (!m.has(c.category)) m.set(c.category, [])
      m.get(c.category)!.push(c)
    }
    return m
  }, [filtered])

  const counts = useMemo(() => {
    const c: Record<string, number> = { pass: 0, warn: 0, fail: 0 }
    for (const x of checks) if (x.status in c) c[x.status]++
    return c
  }, [checks])

  return (
    <section className="mt-8">
      <div className="flex gap-2 mb-4">
        {(['all', 'pass', 'warn', 'fail'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`text-sm px-3 py-1 rounded border ${filter === k ? 'bg-primary text-primary-foreground' : ''}`}
          >
            {k === 'all' ? `전체 ${checks.length}` : k === 'pass' ? `통과 ${counts.pass}` : k === 'warn' ? `경고 ${counts.warn}` : `실패 ${counts.fail}`}
          </button>
        ))}
      </div>

      {CAT_ORDER.map((cat) => {
        const items = grouped.get(cat) ?? []
        if (items.length === 0) return null
        const hasIssue = items.some((c) => c.status === 'warn' || c.status === 'fail')
        return (
          <Accordion key={cat} defaultValue={hasIssue ? [cat] : []} className="mb-4 border rounded">
            <AccordionItem value={cat}>
              <AccordionTrigger className="px-4">{CAT_LABEL[cat]} ({items.length})</AccordionTrigger>
              <AccordionContent className="px-4">
                <ul className="space-y-2">
                  {items.map((c) => (
                    <li key={c.id} className="border-b py-2 last:border-b-0">
                      <div className="flex items-start gap-2">
                        <span className={`${COLOR[c.status]} mt-0.5`}>{ICON[c.status]}</span>
                        <div className="flex-1">
                          <p className="font-medium">{c.title}</p>
                          <p className="text-sm text-muted-foreground mt-1">{c.message}</p>
                          {(!!c.fix || !!c.docs || !!c.detail) && (
                            <details className="mt-2 text-sm">
                              <summary className="cursor-pointer text-xs text-primary">자세히</summary>
                              {!!c.detail && (
                                <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto">{JSON.stringify(c.detail, null, 2)}</pre>
                              )}
                              {c.fix && <p className="mt-2"><strong>권장 조치:</strong> {c.fix}</p>}
                              {c.docs && <p className="mt-1"><a href={c.docs} target="_blank" rel="noopener" className="text-primary hover:underline">관련 문서</a></p>}
                            </details>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )
      })}
    </section>
  )
}
