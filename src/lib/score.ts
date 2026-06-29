import type { CheckResult, Category } from '@/analyzers/types'

const CATS: Category[] = ['meta', 'content', 'technical', 'performance']
// skip: NaN은 sentinel값 — 아래 filter에서 v != null 로 제외되어 점수 분모에서 빠짐 (line 12)
const STATUS_VAL = { pass: 1, warn: 0.5, fail: 0, skip: NaN } as const

export function aggregate(checks: CheckResult[]): {
  total: number
  categories: Record<Category, number | null>
} {
  const categories = {} as Record<Category, number | null>
  for (const cat of CATS) {
    const items = checks.filter((c) => c.category === cat && c.status !== 'skip')
    if (items.length === 0) { categories[cat] = null; continue }
    const num = items.reduce((s, c) => s + STATUS_VAL[c.status] * c.weight, 0)
    const den = items.reduce((s, c) => s + c.weight, 0)
    categories[cat] = Math.round((num / den) * 100)
  }
  const present = CATS.map((c) => categories[c]).filter((v): v is number => v != null)
  const total = present.length === 0 ? 0 : Math.round(present.reduce((a, b) => a + b, 0) / present.length)
  return { total, categories }
}
