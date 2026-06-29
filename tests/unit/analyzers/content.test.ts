import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import * as cheerio from 'cheerio'
import { contentAnalyzer } from '@/analyzers/content'
import type { AnalyzeContext } from '@/analyzers/types'

function ctx(fixture: string): AnalyzeContext {
  const html = readFileSync(path.join('tests/fixtures/html', fixture), 'utf-8')
  return {
    targetUrl: 'https://example.com/',
    normalizedUrl: 'https://example.com/',
    finalUrl: 'https://example.com/',
    html,
    $: cheerio.load(html),
    responseHeaders: new Headers(),
    responseStatus: 200,
  }
}

describe('contentAnalyzer', () => {
  it('완전한 콘텐츠: 모두 pass', async () => {
    const r = await contentAnalyzer.run(ctx('content-good.html'))
    const byId = Object.fromEntries(r.map((c) => [c.id, c]))
    expect(byId['content.h1.present'].status).toBe('pass')
    expect(byId['content.h1.unique'].status).toBe('pass')
    expect(byId['content.image.alt_ratio'].status).toBe('pass')
    expect(byId['content.links.internal_count'].status).toBe('pass')
    expect(byId['content.links.broken_sample'].status).toBe('skip')
  })
  it('h1 없음: fail', async () => {
    const r = await contentAnalyzer.run(ctx('content-no-h1.html'))
    const byId = Object.fromEntries(r.map((c) => [c.id, c]))
    expect(byId['content.h1.present'].status).toBe('fail')
  })
  it('alt 누락 비율 높음: warn 또는 fail', async () => {
    const r = await contentAnalyzer.run(ctx('content-missing-alt.html'))
    const byId = Object.fromEntries(r.map((c) => [c.id, c]))
    expect(byId['content.image.alt_ratio'].status).not.toBe('pass')
    expect(byId['content.image.alt_ratio'].detail).toMatchObject({ total: 3, withAlt: 1 })
  })
})
