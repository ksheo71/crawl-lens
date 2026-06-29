import { describe, it, expect } from 'vitest'
import { aggregate } from '@/lib/score'
import type { CheckResult } from '@/analyzers/types'

function r(category: any, status: any, weight = 1): CheckResult {
  return { id: `${category}.x`, category, status, title: 't', message: 'm', weight }
}

describe('aggregate', () => {
  it('모든 카테고리 pass: 총점 100', () => {
    const checks: CheckResult[] = [
      r('meta', 'pass'), r('content', 'pass'),
      r('technical', 'pass'), r('performance', 'pass'),
    ]
    const a = aggregate(checks)
    expect(a.total).toBe(100)
    expect(a.categories).toEqual({ meta: 100, content: 100, technical: 100, performance: 100 })
  })
  it('warn은 50%로 반영', () => {
    const a = aggregate([r('meta', 'warn', 2), r('meta', 'pass', 2)])
    expect(a.categories.meta).toBe(75)
  })
  it('skip은 분모 제외', () => {
    const a = aggregate([r('meta', 'skip'), r('meta', 'pass')])
    expect(a.categories.meta).toBe(100)
  })
  it('카테고리 전체 skip이면 null', () => {
    const a = aggregate([r('performance', 'skip'), r('performance', 'skip'), r('meta', 'pass')])
    expect(a.categories.performance).toBeNull()
  })
  it('총점은 null 카테고리 제외', () => {
    const a = aggregate([r('performance', 'skip'), r('meta', 'pass'), r('content', 'fail')])
    // meta 100, content 0 → 평균 50
    expect(a.total).toBe(50)
  })
})
