import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse, delay } from 'msw'
import { fetchPage, USER_AGENT } from '@/lib/fetcher'

const server = setupServer(
  http.get('https://ok.test/', ({ request }) => {
    return new HttpResponse('<html><body>hi</body></html>', {
      status: 200,
      headers: { 'content-type': 'text/html', 'x-echo-ua': request.headers.get('user-agent') ?? '' },
    })
  }),
  http.get('https://notfound.test/', () => HttpResponse.text('nope', { status: 404 })),
  http.get('https://err.test/', () => HttpResponse.text('boom', { status: 500 })),
  http.get('https://slow.test/', async () => {
    await delay(20_000)
    return HttpResponse.text('late', { status: 200 })
  }),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

describe('fetchPage', () => {
  it('성공 시 본문·헤더·UA 일관', async () => {
    const r = await fetchPage('https://ok.test/')
    if (!r.ok) throw new Error('expected ok')
    expect(r.status).toBe(200)
    expect(r.body).toContain('hi')
    expect(r.headers.get('x-echo-ua')).toBe(USER_AGENT)
    expect(r.finalUrl).toBe('https://ok.test/')
  })
  it('404 → HTTP_4XX', async () => {
    const r = await fetchPage('https://notfound.test/')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.code).toBe('HTTP_4XX')
      expect(r.status).toBe(404)
    }
  })
  it('500 → HTTP_5XX', async () => {
    const r = await fetchPage('https://err.test/')
    if (r.ok) throw new Error('expected fail')
    expect(r.code).toBe('HTTP_5XX')
  })
  it('타임아웃 → TIMEOUT', async () => {
    const r = await fetchPage('https://slow.test/', { timeoutMs: 100 })
    if (r.ok) throw new Error('expected timeout')
    expect(r.code).toBe('TIMEOUT')
  })
})
