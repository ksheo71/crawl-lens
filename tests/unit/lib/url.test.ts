import { describe, it, expect } from 'vitest'
import { normalizeUrl } from '@/lib/url'

describe('normalizeUrl', () => {
  it('protocol/host 소문자화', () => {
    expect(normalizeUrl('HTTPS://Example.COM/Path')).toBe('https://example.com/Path')
  })
  it('fragment 제거', () => {
    expect(normalizeUrl('https://example.com/p#section')).toBe('https://example.com/p')
  })
  it('기본 포트 제거', () => {
    expect(normalizeUrl('https://example.com:443/p')).toBe('https://example.com/p')
    expect(normalizeUrl('http://example.com:80/p')).toBe('http://example.com/p')
  })
  it('루트 경로 유지', () => {
    expect(normalizeUrl('https://example.com')).toBe('https://example.com/')
  })
  it('비루트 경로 그대로', () => {
    expect(normalizeUrl('https://example.com/blog/post')).toBe('https://example.com/blog/post')
  })
  it('query string 유지', () => {
    expect(normalizeUrl('https://example.com/p?q=1&z=2')).toBe('https://example.com/p?q=1&z=2')
  })
  it('잘못된 URL은 throw', () => {
    expect(() => normalizeUrl('not-a-url')).toThrow('INVALID_URL')
    expect(() => normalizeUrl('javascript:alert(1)')).toThrow('INVALID_URL')
  })
})
