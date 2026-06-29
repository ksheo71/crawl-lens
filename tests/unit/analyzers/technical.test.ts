import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import * as cheerio from 'cheerio'
import { technicalAnalyzer } from '@/analyzers/technical'
import type { AnalyzeContext } from '@/analyzers/types'

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function ctx(opts: { url: string; html?: string; headers?: HeadersInit }): AnalyzeContext {
  const html = opts.html ?? '<html><head><title>x</title></head><body></body></html>'
  return {
    targetUrl: opts.url,
    normalizedUrl: opts.url,
    finalUrl: opts.url,
    html,
    $: cheerio.load(html),
    responseHeaders: new Headers(opts.headers),
    responseStatus: 200,
  }
}

describe('technicalAnalyzer', () => {
  it('HTTPS pass', async () => {
    server.use(http.get('https://x.test/robots.txt', () => HttpResponse.text('User-agent: *\nAllow: /')))
    server.use(http.get('https://x.test/sitemap.xml', () => HttpResponse.text('<urlset/>')))
    const r = await technicalAnalyzer.run(ctx({ url: 'https://x.test/' }))
    const byId = Object.fromEntries(r.map((c) => [c.id, c]))
    expect(byId['technical.https'].status).toBe('pass')
    expect(byId['technical.robots.accessible'].status).toBe('pass')
    expect(byId['technical.sitemap.discoverable'].status).toBe('pass')
  })

  it('HTTP fail', async () => {
    server.use(http.get('http://x.test/robots.txt', () => HttpResponse.text('', { status: 404 })))
    server.use(http.get('http://x.test/sitemap.xml', () => HttpResponse.text('', { status: 404 })))
    const r = await technicalAnalyzer.run(ctx({ url: 'http://x.test/' }))
    const byId = Object.fromEntries(r.map((c) => [c.id, c]))
    expect(byId['technical.https'].status).toBe('fail')
  })

  it('robots Disallow: / → disallowed fail', async () => {
    server.use(http.get('https://x.test/robots.txt', () => HttpResponse.text('User-agent: *\nDisallow: /')))
    server.use(http.get('https://x.test/sitemap.xml', () => HttpResponse.text('', { status: 404 })))
    const r = await technicalAnalyzer.run(ctx({ url: 'https://x.test/secret' }))
    const byId = Object.fromEntries(r.map((c) => [c.id, c]))
    expect(byId['technical.robots.disallowed'].status).toBe('fail')
  })

  it('JSON-LD 존재', async () => {
    const html = `<html><head><title>x</title>
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"x"}</script>
    </head><body></body></html>`
    server.use(http.get('https://x.test/robots.txt', () => HttpResponse.text('User-agent: *')))
    server.use(http.get('https://x.test/sitemap.xml', () => HttpResponse.text('<urlset/>')))
    const r = await technicalAnalyzer.run(ctx({ url: 'https://x.test/', html }))
    const byId = Object.fromEntries(r.map((c) => [c.id, c]))
    expect(byId['technical.schema.jsonld'].status).toBe('pass')
  })

  it('x-robots-tag: noindex → fail', async () => {
    server.use(http.get('https://x.test/robots.txt', () => HttpResponse.text('User-agent: *')))
    server.use(http.get('https://x.test/sitemap.xml', () => HttpResponse.text('<urlset/>')))
    const r = await technicalAnalyzer.run(
      ctx({ url: 'https://x.test/', headers: { 'x-robots-tag': 'noindex, nofollow' } }),
    )
    const byId = Object.fromEntries(r.map((c) => [c.id, c]))
    expect(byId['technical.x_robots_tag.noindex'].status).toBe('fail')
  })
})
