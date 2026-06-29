"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metaAnalyzer = void 0;
const docs = {
    title: 'https://developers.google.com/search/docs/appearance/title-link',
    description: 'https://developers.google.com/search/docs/appearance/snippet',
    canonical: 'https://developers.google.com/search/docs/crawling-indexing/canonicalization',
    og: 'https://ogp.me/',
    viewport: 'https://developer.mozilla.org/docs/Web/HTML/Viewport_meta_tag',
};
exports.metaAnalyzer = {
    name: 'meta',
    async run(ctx) {
        const $ = ctx.$;
        const out = [];
        const title = $('head > title').first().text().trim();
        out.push({
            id: 'meta.title.present',
            category: 'meta',
            status: title ? 'pass' : 'fail',
            title: 'Title 태그 존재',
            message: title
                ? '<title> 태그가 정상적으로 설정되어 있어요.'
                : '<title> 태그가 비어 있거나 없습니다. 검색 결과의 첫인상을 결정하는 가장 중요한 요소예요.',
            detail: { value: title },
            fix: title ? undefined : '<head>에 <title>페이지 제목</title>을 추가해주세요.',
            docs: docs.title,
            weight: 5,
        });
        if (title) {
            const len = title.length;
            const ok = len >= 30 && len <= 60;
            out.push({
                id: 'meta.title.length',
                category: 'meta',
                status: ok ? 'pass' : 'warn',
                title: 'Title 태그 길이',
                message: ok
                    ? `현재 ${len}자입니다. 검색 결과에서 잘리지 않을 적정 범위예요.`
                    : `현재 ${len}자입니다. 30~60자가 적당합니다.`,
                detail: { value: title, length: len },
                fix: ok ? undefined : '핵심 키워드를 앞쪽에 두고 30~60자로 조정해주세요.',
                docs: docs.title,
                weight: 4,
            });
        }
        const desc = $('meta[name="description"]').attr('content')?.trim() ?? '';
        out.push({
            id: 'meta.description.present',
            category: 'meta',
            status: desc ? 'pass' : 'fail',
            title: 'Meta description 존재',
            message: desc ? 'meta description이 있어요.' : 'meta description이 비어 있습니다.',
            detail: { value: desc },
            fix: desc ? undefined : '<meta name="description" content="...">를 추가해주세요.',
            docs: docs.description,
            weight: 4,
        });
        if (desc) {
            const len = desc.length;
            const ok = len >= 50 && len <= 160;
            out.push({
                id: 'meta.description.length',
                category: 'meta',
                status: ok ? 'pass' : 'warn',
                title: 'Meta description 길이',
                message: ok ? `${len}자입니다.` : `${len}자입니다. 50~160자가 적당합니다.`,
                detail: { length: len },
                fix: ok ? undefined : '핵심 내용을 50~160자로 요약해 적어주세요.',
                docs: docs.description,
                weight: 3,
            });
        }
        const canonical = $('link[rel="canonical"]').attr('href')?.trim() ?? '';
        out.push({
            id: 'meta.canonical.present',
            category: 'meta',
            status: canonical ? 'pass' : 'fail',
            title: 'Canonical URL 설정',
            message: canonical ? `canonical: ${canonical}` : 'canonical 링크가 없습니다.',
            detail: { value: canonical },
            fix: canonical ? undefined : '<link rel="canonical" href="..."> 를 추가해주세요.',
            docs: docs.canonical,
            weight: 4,
        });
        const ogPairs = [
            { id: 'meta.og.title.present', sel: 'meta[property="og:title"]', label: 'Open Graph title' },
            { id: 'meta.og.description.present', sel: 'meta[property="og:description"]', label: 'Open Graph description' },
            { id: 'meta.og.image.present', sel: 'meta[property="og:image"]', label: 'Open Graph image' },
        ];
        for (const p of ogPairs) {
            const v = $(p.sel).attr('content')?.trim() ?? '';
            out.push({
                id: p.id,
                category: 'meta',
                status: v ? 'pass' : 'fail',
                title: p.label,
                message: v ? `${p.label} 설정됨` : `${p.label}이 없습니다.`,
                detail: { value: v },
                fix: v ? undefined : `<meta property="${p.sel.match(/og:[^"]+/)[0]}" content="..."> 를 추가해주세요.`,
                docs: docs.og,
                weight: 2,
            });
        }
        const twitter = $('meta[name="twitter:card"]').attr('content')?.trim() ?? '';
        out.push({
            id: 'meta.twitter.card.present',
            category: 'meta',
            status: twitter ? 'pass' : 'warn',
            title: 'Twitter Card',
            message: twitter ? `twitter:card: ${twitter}` : 'twitter:card가 없습니다.',
            detail: { value: twitter },
            fix: twitter ? undefined : '<meta name="twitter:card" content="summary_large_image"> 권장',
            docs: docs.og,
            weight: 1,
        });
        const viewport = $('meta[name="viewport"]').attr('content')?.trim() ?? '';
        out.push({
            id: 'meta.viewport.present',
            category: 'meta',
            status: viewport ? 'pass' : 'fail',
            title: 'Viewport meta',
            message: viewport ? viewport : 'viewport meta가 없습니다.',
            detail: { value: viewport },
            fix: viewport ? undefined : '<meta name="viewport" content="width=device-width, initial-scale=1"> 를 추가해주세요.',
            docs: docs.viewport,
            weight: 3,
        });
        const lang = $('html').attr('lang')?.trim() ?? '';
        out.push({
            id: 'meta.html.lang.present',
            category: 'meta',
            status: lang ? 'pass' : 'fail',
            title: 'HTML lang 속성',
            message: lang ? `lang="${lang}"` : '<html lang="..."> 속성이 없습니다.',
            detail: { value: lang },
            fix: lang ? undefined : '<html lang="ko"> 처럼 언어를 명시해주세요.',
            weight: 2,
        });
        return out;
    },
};
