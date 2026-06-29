import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import * as cheerio from 'cheerio'
import { metaAnalyzer } from '@/analyzers/meta'
import type { AnalyzeContext } from '@/analyzers/types'

function ctx(fixture: string): AnalyzeContext {
  const html = readFileSync(path.join('tests/fixtures/html', fixture), 'utf-8')
  return {
    targetUrl: 'https://example.com/blog/post',
    normalizedUrl: 'https://example.com/blog/post',
    finalUrl: 'https://example.com/blog/post',
    html,
    $: cheerio.load(html),
    responseHeaders: new Headers(),
    responseStatus: 200,
  }
}

describe('metaAnalyzer', () => {
  it('완전한 메타: 대부분 pass', async () => {
    const results = await metaAnalyzer.run(ctx('meta-good.html'))
    const byId = Object.fromEntries(results.map((r) => [r.id, r]))
    expect(byId['meta.title.present'].status).toBe('pass')
    expect(byId['meta.description.present'].status).toBe('pass')
    expect(byId['meta.canonical.present'].status).toBe('pass')
    expect(byId['meta.og.image.present'].status).toBe('pass')
    expect(byId['meta.html.lang.present'].status).toBe('pass')
    expect(byId['meta.viewport.present'].status).toBe('pass')
  })

  it('메타 누락: 다수 fail', async () => {
    const results = await metaAnalyzer.run(ctx('meta-missing.html'))
    const byId = Object.fromEntries(results.map((r) => [r.id, r]))
    expect(byId['meta.title.present'].status).toBe('fail')
    expect(byId['meta.description.present'].status).toBe('fail')
    expect(byId['meta.canonical.present'].status).toBe('fail')
    expect(byId['meta.viewport.present'].status).toBe('fail')
    expect(byId['meta.html.lang.present'].status).toBe('fail')
  })

  it('너무 짧은 title/description: warn', async () => {
    const results = await metaAnalyzer.run(ctx('meta-too-short-title.html'))
    const byId = Object.fromEntries(results.map((r) => [r.id, r]))
    expect(byId['meta.title.length'].status).toBe('warn')
    expect(byId['meta.title.length'].detail).toMatchObject({ length: 2 })
    expect(byId['meta.description.length'].status).toBe('warn')
  })

  it('모든 결과는 category=meta', async () => {
    const results = await metaAnalyzer.run(ctx('meta-good.html'))
    expect(results.every((r) => r.category === 'meta')).toBe(true)
  })
})
