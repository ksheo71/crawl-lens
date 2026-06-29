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

describe('SSRF', () => {
  it('loopback IPv4 차단', () => {
    expect(() => normalizeUrl('http://127.0.0.1/')).toThrow('INVALID_URL')
  })
  it('10.x.x.x 사설망 차단', () => {
    expect(() => normalizeUrl('http://10.0.0.1/')).toThrow('INVALID_URL')
  })
  it('192.168.x.x 사설망 차단', () => {
    expect(() => normalizeUrl('http://192.168.1.1/')).toThrow('INVALID_URL')
  })
  it('169.254.x.x 링크로컬(AWS 메타데이터) 차단', () => {
    expect(() => normalizeUrl('http://169.254.169.254/')).toThrow('INVALID_URL')
  })
  it('host.docker.internal 차단', () => {
    expect(() => normalizeUrl('http://host.docker.internal:5432/')).toThrow('INVALID_URL')
  })
  it('localhost 차단', () => {
    expect(() => normalizeUrl('http://localhost/')).toThrow('INVALID_URL')
  })
  it('*.myazit.kr 내부 서비스 차단', () => {
    expect(() => normalizeUrl('http://cashbook.myazit.kr/')).toThrow('INVALID_URL')
  })
  it('IPv6 ::1 루프백 차단', () => {
    expect(() => normalizeUrl('http://[::1]/')).toThrow('INVALID_URL')
  })
  it('172.16.x.x 사설망 차단', () => {
    expect(() => normalizeUrl('http://172.16.0.1/')).toThrow('INVALID_URL')
  })
  it('0.x.x.x 차단', () => {
    expect(() => normalizeUrl('http://0.0.0.0/')).toThrow('INVALID_URL')
  })
  it('멀티캐스트 차단', () => {
    expect(() => normalizeUrl('http://224.0.0.1/')).toThrow('INVALID_URL')
  })
  it('공개 도메인은 허용', () => {
    expect(normalizeUrl('https://example.com/path')).toBe('https://example.com/path')
  })
  it('공개 IP는 허용', () => {
    expect(normalizeUrl('https://1.1.1.1/')).toBe('https://1.1.1.1/')
  })
})
