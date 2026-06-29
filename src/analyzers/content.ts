import type { Analyzer, CheckResult } from './types'

export const contentAnalyzer: Analyzer = {
  name: 'content',
  async run(ctx): Promise<CheckResult[]> {
    const $ = ctx.$
    const out: CheckResult[] = []

    const h1s = $('body h1')
    out.push({
      id: 'content.h1.present',
      category: 'content',
      status: h1s.length > 0 ? 'pass' : 'fail',
      title: 'H1 태그 존재',
      message: h1s.length > 0 ? `h1 ${h1s.length}개` : '<h1> 태그가 없습니다.',
      detail: { count: h1s.length },
      fix: h1s.length > 0 ? undefined : '페이지의 주제를 담은 <h1>을 하나 추가해주세요.',
      weight: 5,
    })
    out.push({
      id: 'content.h1.unique',
      category: 'content',
      status: h1s.length === 1 ? 'pass' : h1s.length === 0 ? 'skip' : 'warn',
      title: 'H1 유일성',
      message:
        h1s.length === 1 ? 'h1이 한 개입니다.'
        : h1s.length === 0 ? 'h1이 없어 검사 생략.'
        : `h1이 ${h1s.length}개입니다. 페이지당 1개를 권장합니다.`,
      detail: { count: h1s.length },
      fix: h1s.length > 1 ? '주제 외 헤딩은 h2 이하로 변경해주세요.' : undefined,
      weight: 3,
    })

    const order: number[] = []
    $('body :header').each((_, el) => {
      const tag = el.tagName.toLowerCase()
      if (/^h[1-6]$/.test(tag)) order.push(Number(tag[1]))
    })
    let skipFound = false
    for (let i = 1; i < order.length; i++) {
      if (order[i] - order[i - 1] > 1) { skipFound = true; break }
    }
    out.push({
      id: 'content.heading.hierarchy',
      category: 'content',
      status: order.length === 0 ? 'skip' : skipFound ? 'warn' : 'pass',
      title: '헤딩 계층 건너뛰기',
      message: skipFound ? '헤딩 레벨을 건너뛴 곳이 있습니다.' : '헤딩 계층이 자연스럽습니다.',
      detail: { sequence: order },
      fix: skipFound ? 'h2 다음 h4 같은 점프를 피해주세요.' : undefined,
      weight: 2,
    })

    const imgs = $('body img')
    const withAlt = imgs.filter((_, el) => ($(el).attr('alt') ?? '').trim().length > 0).length
    const ratio = imgs.length === 0 ? 1 : withAlt / imgs.length
    const altStatus = imgs.length === 0 ? 'skip' : ratio >= 0.9 ? 'pass' : ratio >= 0.5 ? 'warn' : 'fail'
    out.push({
      id: 'content.image.alt_ratio',
      category: 'content',
      status: altStatus,
      title: '이미지 alt 비율',
      message: imgs.length === 0
        ? '이미지가 없어 검사 생략.'
        : `${imgs.length}개 중 ${withAlt}개에 alt가 있습니다 (${Math.round(ratio * 100)}%).`,
      detail: { total: imgs.length, withAlt },
      fix: altStatus === 'pass' ? undefined : '의미 있는 이미지에는 alt를 채우고, 장식용 이미지는 alt="" 로 비워주세요.',
      weight: 4,
    })

    const text = $('body').text().replace(/\s+/g, ' ').trim()
    const wc = text.length // 한국어 글자 단위 (영문은 줄어들지만 v1 단순 정책)
    const wcStatus = wc >= 300 ? 'pass' : wc >= 100 ? 'warn' : 'fail'
    out.push({
      id: 'content.wordcount',
      category: 'content',
      status: wcStatus,
      title: '본문 길이',
      message: `본문 ${wc}자.`,
      detail: { chars: wc },
      fix: wcStatus === 'pass' ? undefined : '주제를 충분히 다루려면 300자 이상이 권장됩니다.',
      weight: 2,
    })

    const a = $('body a[href]')
    const host = (() => { try { return new URL(ctx.finalUrl).host } catch { return '' } })()
    let internal = 0, external = 0, nofollow = 0
    a.each((_, el) => {
      const href = $(el).attr('href') ?? ''
      const rel = $(el).attr('rel') ?? ''
      if (/nofollow/i.test(rel)) nofollow++
      try {
        const u = new URL(href, ctx.finalUrl)
        if (u.host === host) internal++
        else external++
      } catch { /* skip */ }
    })
    out.push({
      id: 'content.links.internal_count',
      category: 'content',
      status: internal >= 1 ? 'pass' : 'warn',
      title: '내부 링크 수',
      message: `내부 ${internal}, 외부 ${external}, nofollow ${nofollow}.`,
      detail: { internal, external, nofollow },
      fix: internal === 0 ? '같은 사이트의 관련 글로 내부 링크를 걸어주세요.' : undefined,
      weight: 3,
    })

    out.push({
      id: 'content.links.broken_sample',
      category: 'content',
      status: 'skip',
      title: '깨진 링크 점검',
      message: 'v1에서는 링크 수만 집계해요. 실제 응답 확인은 v2에서 지원 예정입니다.',
      detail: { totalLinks: internal + external },
      weight: 1,
    })

    return out
  },
}
