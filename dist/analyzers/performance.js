"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.performanceAnalyzer = void 0;
const env_1 = require("@/lib/env");
const queue_1 = require("@/lib/queue");
const PSI_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const METRICS = [
    { id: 'performance.lcp', title: 'Largest Contentful Paint', auditKey: 'largest-contentful-paint', weight: 6 },
    { id: 'performance.inp', title: 'Interaction to Next Paint', auditKey: 'interaction-to-next-paint', weight: 6 },
    { id: 'performance.cls', title: 'Cumulative Layout Shift', auditKey: 'cumulative-layout-shift', weight: 6 },
    { id: 'performance.tbt', title: 'Total Blocking Time', auditKey: 'total-blocking-time', weight: 3 },
];
function scoreToStatus(score) {
    if (score == null)
        return 'skip';
    if (score >= 0.9)
        return 'pass';
    if (score >= 0.5)
        return 'warn';
    return 'fail';
}
function skipAll(reason) {
    return METRICS.map((m) => ({
        id: m.id,
        category: 'performance',
        status: 'skip',
        title: m.title,
        message: reason === 'PSI_QUOTA'
            ? '오늘의 PSI 호출 한도를 초과해 성능 측정을 건너뛰었어요.'
            : reason === 'PSI_TIMEOUT'
                ? 'PSI 응답이 60초 안에 오지 않아 건너뛰었어요.'
                : '성능 측정 중 오류가 발생해 건너뛰었어요.',
        detail: { reason },
        weight: m.weight,
    }));
}
const performanceAnalyzerImpl = {
    name: 'performance',
    async runPsi(url, timeoutMs = 60_000) {
        const u = new URL(PSI_ENDPOINT);
        u.searchParams.set('url', url);
        u.searchParams.set('strategy', 'mobile');
        u.searchParams.set('key', env_1.env.PSI_API_KEY);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(u, { signal: controller.signal });
            if (res.status === 429)
                throw new Error('PSI_QUOTA');
            if (!res.ok)
                throw new Error('PSI_FAIL');
            // Increment PSI quota metric on successful response
            const today = new Date().toISOString().slice(0, 10);
            await queue_1.redisConnection.incr(`metric:psi:quota_used:${today}`);
            await queue_1.redisConnection.expire(`metric:psi:quota_used:${today}`, 60 * 60 * 36);
            return await res.json();
        }
        finally {
            clearTimeout(timer);
        }
    },
    async run(ctx, opts = {}) {
        let data;
        try {
            data = await exports.performanceAnalyzer.runPsi(ctx.normalizedUrl, opts.timeoutMs);
        }
        catch (err) {
            const msg = err.message;
            if (msg === 'PSI_QUOTA')
                return skipAll('PSI_QUOTA');
            if (err.name === 'AbortError')
                return skipAll('PSI_TIMEOUT');
            return skipAll('PSI_FAIL');
        }
        const psiData = data;
        const audits = psiData?.lighthouseResult?.audits ?? {};
        return METRICS.map((m) => {
            const a = audits[m.auditKey];
            const score = a?.score;
            const status = scoreToStatus(score);
            return {
                id: m.id,
                category: 'performance',
                status,
                title: m.title,
                message: status === 'skip' ? '측정값을 얻지 못했습니다.'
                    : status === 'pass' ? `좋아요. (${a?.displayValue ?? ''})`
                        : `개선이 필요합니다. (${a?.displayValue ?? ''})`,
                detail: { score, displayValue: a?.displayValue },
                docs: 'https://web.dev/articles/vitals',
                weight: m.weight,
            };
        });
    },
};
exports.performanceAnalyzer = performanceAnalyzerImpl;
