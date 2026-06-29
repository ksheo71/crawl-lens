"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.USER_AGENT = void 0;
exports.fetchPage = fetchPage;
exports.USER_AGENT = 'crawl-lens/1.0 (+https://crawl-lens.myazit.kr)';
/**
 * Fetch a URL with timeout + error classification.
 *
 * @param url Target URL.
 * @param opts.timeoutMs Abort after this many ms. Default 15000.
 * @param opts.maxRedirects Reserved for v2 — currently ignored. The global
 *   fetch follows redirects unbounded; pass nothing for now.
 */
async function fetchPage(url, opts = {}) {
    const timeoutMs = opts.timeoutMs ?? 15_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, {
            headers: { 'user-agent': exports.USER_AGENT, accept: 'text/html,*/*;q=0.8' },
            redirect: 'follow',
            signal: controller.signal,
        });
        if (res.status >= 500)
            return { ok: false, code: 'HTTP_5XX', status: res.status };
        if (res.status >= 400)
            return { ok: false, code: 'HTTP_4XX', status: res.status };
        const body = await res.text();
        return { ok: true, finalUrl: res.url, status: res.status, headers: res.headers, body };
    }
    catch (err) {
        if (err.name === 'AbortError')
            return { ok: false, code: 'TIMEOUT' };
        const msg = err.message ?? '';
        if (/ENOTFOUND|EAI_AGAIN/i.test(msg))
            return { ok: false, code: 'DNS_FAIL' };
        return { ok: false, code: 'CONN_FAIL' };
    }
    finally {
        clearTimeout(timer);
    }
}
