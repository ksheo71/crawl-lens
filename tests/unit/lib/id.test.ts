import { describe, it, expect } from 'vitest'
import { newPublicId } from '@/lib/id'

describe('newPublicId', () => {
  it('10자 길이', () => {
    expect(newPublicId()).toHaveLength(10)
  })
  it('URL-safe 알파벳만', () => {
    for (let i = 0; i < 100; i++) {
      expect(newPublicId()).toMatch(/^[A-Za-z0-9_-]+$/)
    }
  })
  it('호출마다 다른 값', () => {
    const a = new Set(Array.from({ length: 1000 }, () => newPublicId()))
    expect(a.size).toBe(1000)
  })
})
