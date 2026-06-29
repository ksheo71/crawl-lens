import { describe, it, expect } from 'vitest'
import { parseRobots } from '@/analyzers/technical'

describe('parseRobots', () => {
  it('single * group', () => {
    const r = parseRobots('User-agent: *\nDisallow: /secret\nSitemap: https://x/sm.xml')
    expect(r.disallows).toEqual(['/secret'])
    expect(r.sitemaps).toEqual(['https://x/sm.xml'])
  })

  it('multi-UA group: * rules survive when other UAs follow', () => {
    const text = [
      'User-agent: *',
      'User-agent: Googlebot',
      'Disallow: /admin',
    ].join('\n')
    expect(parseRobots(text).disallows).toEqual(['/admin'])
  })

  it('separate group for a non-matching UA is ignored', () => {
    const text = [
      'User-agent: *',
      'Disallow: /a',
      '',
      'User-agent: Bingbot',
      'Disallow: /b',
    ].join('\n')
    expect(parseRobots(text).disallows).toEqual(['/a'])
  })

  it('group containing both * and Googlebot still picks up * by default', () => {
    const text = [
      'User-agent: Googlebot',
      'User-agent: *',
      'Disallow: /c',
    ].join('\n')
    expect(parseRobots(text).disallows).toEqual(['/c'])
  })

  it('comments and blank lines tolerated', () => {
    const text = [
      '# this is a comment',
      'User-agent: *',
      '',
      'Disallow: /x   # inline comment',
      'Disallow:',
    ].join('\n')
    expect(parseRobots(text).disallows).toEqual(['/x', ''])
  })
})
