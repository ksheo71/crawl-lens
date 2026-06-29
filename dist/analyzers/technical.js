"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.technicalAnalyzer = void 0;
exports.parseRobots = parseRobots;
const fetcher_1 = require("@/lib/fetcher");
function parseRobots(text, ua = '*') {
    const disallows = [];
    const sitemaps = [];
    const lines = text.split(/\r?\n/).map((l) => l.replace(/#.*$/, '').trim());
    let currentUAs = [];
    let groupActive = false;
    let lastLineWasDirective = false;
    for (const line of lines) {
        if (!line)
            continue;
        const m = line.match(/^([A-Za-z-]+):\s*(.*)$/);
        if (!m)
            continue;
        const key = m[1].toLowerCase();
        const val = m[2].trim();
        if (key === 'sitemap') {
            sitemaps.push(val);
            continue;
        }
        if (key === 'user-agent') {
            if (lastLineWasDirective) {
                // New group starts
                currentUAs = [];
                groupActive = false;
            }
            currentUAs.push(val);
            groupActive = currentUAs.some((u) => u === '*' || u.toLowerCase() === ua.toLowerCase());
            lastLineWasDirective = false;
        }
        else if (key === 'disallow' || key === 'allow' || key === 'crawl-delay') {
            lastLineWasDirective = true;
            if (groupActive && key === 'disallow')
                disallows.push(val);
        }
    }
    return { disallows, sitemaps };
}
function disallowed(path, rules) {
    for (const r of rules) {
        if (!r)
            continue; // 빈 Disallow 는 허용 의미
        if (path === r)
            return true;
        if (path.startsWith(r))
            return true;
    }
    return false;
}
exports.technicalAnalyzer = {
    name: 'technical',
    async run(ctx) {
        const out = [];
        const url = new URL(ctx.finalUrl);
        const httpsOk = url.protocol === 'https:';
        out.push({
            id: 'technical.https',
            category: 'technical',
            status: httpsOk ? 'pass' : 'fail',
            title: 'HTTPS',
            message: httpsOk ? 'HTTPS로 제공됩니다.' : 'HTTP로 제공됩니다. HTTPS로 전환해주세요.',
            fix: httpsOk ? undefined : 'TLS 인증서를 설치하고 모든 트래픽을 HTTPS로 리다이렉트해주세요.',
            weight: 4,
        });
        const robotsUrl = `${url.origin}/robots.txt`;
        const robotsRes = await (0, fetcher_1.fetchPage)(robotsUrl, { timeoutMs: 8_000 });
        let robotsParsed = { disallows: [], sitemaps: [] };
        const robotsOk = robotsRes.ok === true;
        if (robotsOk)
            robotsParsed = parseRobots(robotsRes.body);
        out.push({
            id: 'technical.robots.accessible',
            category: 'technical',
            status: robotsOk ? 'pass' : 'warn',
            title: 'robots.txt 접근 가능',
            message: robotsOk ? 'robots.txt를 정상 조회했습니다.' : 'robots.txt를 가져올 수 없었습니다.',
            detail: { url: robotsUrl },
            fix: robotsOk ? undefined : '루트(/robots.txt)에 robots.txt 파일을 두는 게 좋습니다.',
            weight: 2,
        });
        const path = url.pathname || '/';
        const blocked = disallowed(path, robotsParsed.disallows);
        out.push({
            id: 'technical.robots.disallowed',
            category: 'technical',
            status: blocked ? 'fail' : 'pass',
            title: 'robots.txt 차단 여부',
            message: blocked
                ? '이 페이지가 robots.txt에 의해 차단되어 있어요. 검색 엔진이 못 봅니다.'
                : '검색 엔진이 접근할 수 있는 페이지입니다.',
            detail: { path, rules: robotsParsed.disallows },
            fix: blocked ? '해당 경로의 Disallow 규칙을 조정해주세요.' : undefined,
            weight: 4,
        });
        let sitemapOk = robotsParsed.sitemaps.length > 0;
        if (!sitemapOk) {
            const sm = await (0, fetcher_1.fetchPage)(`${url.origin}/sitemap.xml`, { timeoutMs: 8_000 });
            sitemapOk = sm.ok === true;
        }
        out.push({
            id: 'technical.sitemap.discoverable',
            category: 'technical',
            status: sitemapOk ? 'pass' : 'warn',
            title: 'Sitemap 발견',
            message: sitemapOk ? 'sitemap을 찾았습니다.' : 'sitemap.xml을 찾지 못했습니다.',
            detail: { hintsFromRobots: robotsParsed.sitemaps },
            fix: sitemapOk ? undefined : '/sitemap.xml 을 제공하거나 robots.txt에 Sitemap: 라인을 추가하세요.',
            weight: 3,
        });
        const jsonldNodes = ctx.$('script[type="application/ld+json"]');
        let parsedOk = 0;
        jsonldNodes.each((_, el) => {
            try {
                JSON.parse(ctx.$(el).text());
                parsedOk++;
            }
            catch { /* invalid */ }
        });
        const schemaStatus = jsonldNodes.length === 0 ? 'warn' : parsedOk === jsonldNodes.length ? 'pass' : 'warn';
        out.push({
            id: 'technical.schema.jsonld',
            category: 'technical',
            status: schemaStatus,
            title: 'JSON-LD 구조화 데이터',
            message: jsonldNodes.length === 0
                ? 'JSON-LD가 없습니다. Article/Product 등 스키마를 넣으면 리치 결과 가능성이 생깁니다.'
                : `JSON-LD ${jsonldNodes.length}개 중 ${parsedOk}개 파싱 OK.`,
            detail: { total: jsonldNodes.length, parsedOk },
            fix: jsonldNodes.length === 0 ? '<script type="application/ld+json">{...}</script> 로 적절한 스키마를 추가하세요.' : undefined,
            weight: 3,
        });
        const xrt = ctx.responseHeaders.get('x-robots-tag') ?? '';
        const noindex = /noindex/i.test(xrt);
        out.push({
            id: 'technical.x_robots_tag.noindex',
            category: 'technical',
            status: noindex ? 'fail' : 'pass',
            title: 'X-Robots-Tag noindex',
            message: noindex
                ? `응답 헤더에 noindex가 있어 검색에 노출되지 않습니다. (${xrt})`
                : 'noindex가 설정되어 있지 않습니다.',
            detail: { value: xrt },
            fix: noindex ? '서버 응답에서 X-Robots-Tag: noindex 를 제거해주세요.' : undefined,
            weight: 3,
        });
        return out;
    },
};
