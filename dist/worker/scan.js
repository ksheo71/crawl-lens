"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.processScan = processScan;
const cheerio = __importStar(require("cheerio"));
const db_1 = require("@/lib/db");
const fetcher_1 = require("@/lib/fetcher");
const meta_1 = require("@/analyzers/meta");
const content_1 = require("@/analyzers/content");
const technical_1 = require("@/analyzers/technical");
const performance_1 = require("@/analyzers/performance");
const score_1 = require("@/lib/score");
const queue_1 = require("@/lib/queue");
async function setProgress(publicId, p) {
    await queue_1.redisConnection.set((0, queue_1.progressKey)(publicId), String(p), 'EX', 600);
}
async function processScan(publicId) {
    const scan = await db_1.prisma.scan.findUnique({ where: { publicId } });
    if (!scan)
        throw new Error(`scan not found: ${publicId}`);
    await db_1.prisma.scan.update({
        where: { publicId },
        data: { status: 'RUNNING', startedAt: new Date() },
    });
    await setProgress(publicId, 0);
    const fetchRes = await (0, fetcher_1.fetchPage)(scan.targetUrl, { timeoutMs: 15_000 });
    if (!fetchRes.ok) {
        await db_1.prisma.scan.update({
            where: { publicId },
            data: {
                status: 'FAILED',
                errorCode: fetchRes.code,
                errorMessage: messageFor(fetchRes.code, fetchRes.status),
                fetchStatus: fetchRes.status ?? null,
                completedAt: new Date(),
            },
        });
        await setProgress(publicId, 100);
        // Increment failed metric
        const today = new Date().toISOString().slice(0, 10);
        await queue_1.redisConnection.incr(`metric:scan:failed:${today}`);
        await queue_1.redisConnection.expire(`metric:scan:failed:${today}`, 60 * 60 * 36);
        return;
    }
    await setProgress(publicId, 10);
    const $ = cheerio.load(fetchRes.body);
    const ctx = {
        targetUrl: scan.targetUrl,
        normalizedUrl: scan.normalizedUrl,
        finalUrl: fetchRes.finalUrl,
        html: fetchRes.body,
        $,
        responseHeaders: fetchRes.headers,
        responseStatus: fetchRes.status,
    };
    const [meta, content, technical] = await Promise.all([
        safe(meta_1.metaAnalyzer.run(ctx)),
        safe(content_1.contentAnalyzer.run(ctx)),
        safe(technical_1.technicalAnalyzer.run(ctx)),
    ]);
    await setProgress(publicId, 50);
    const performance = await safe(performance_1.performanceAnalyzer.run(ctx));
    await setProgress(publicId, 95);
    const checks = [...meta, ...content, ...technical, ...performance];
    const { total, categories } = (0, score_1.aggregate)(checks);
    await db_1.prisma.scan.update({
        where: { publicId },
        data: {
            status: 'DONE',
            fetchStatus: fetchRes.status ?? null,
            totalScore: total,
            categoryScores: categories,
            checks: checks,
            completedAt: new Date(),
        },
    });
    await setProgress(publicId, 100);
    // Increment done metric
    const today = new Date().toISOString().slice(0, 10);
    await queue_1.redisConnection.incr(`metric:scan:done:${today}`);
    await queue_1.redisConnection.expire(`metric:scan:done:${today}`, 60 * 60 * 36);
}
async function safe(p) {
    try {
        return await p;
    }
    catch {
        return [];
    }
}
function messageFor(code, status) {
    switch (code) {
        case 'DNS_FAIL': return '도메인을 찾을 수 없어요';
        case 'CONN_FAIL': return '서버에 연결할 수 없었어요';
        case 'TIMEOUT': return '응답이 너무 느려요';
        case 'HTTP_4XX': return `페이지가 ${status ?? 4}xx를 반환했어요`;
        case 'HTTP_5XX': return `서버 오류(${status ?? 5}xx)가 발생했어요`;
        case 'PARSE_FAIL': return '페이지가 HTML이 아니거나 깨져 있어요';
        default: return '알 수 없는 오류가 발생했어요';
    }
}
