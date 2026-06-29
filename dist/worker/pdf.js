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
exports.processPdf = processPdf;
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const env_1 = require("@/lib/env");
async function processPdf(publicId) {
    await (0, promises_1.mkdir)(env_1.env.PDF_CACHE_DIR, { recursive: true });
    const out = (0, node_path_1.join)(env_1.env.PDF_CACHE_DIR, `${publicId}.pdf`);
    // puppeteer-core와 @sparticuz/chromium은 동적으로 임포트해
    // 타입 분석 시점의 의존성 오류를 방지한다.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const puppeteer = (await Promise.resolve().then(() => __importStar(require('puppeteer-core')))).default;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chromium = (await Promise.resolve().then(() => __importStar(require('@sparticuz/chromium')))).default;
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH ?? await chromium.executablePath();
    const args = process.env.PUPPETEER_EXECUTABLE_PATH
        ? ['--no-sandbox', '--disable-dev-shm-usage']
        : chromium.args;
    const browser = await puppeteer.launch({
        args,
        executablePath,
        headless: true,
    });
    try {
        const page = await browser.newPage();
        await page.emulateMediaType('print');
        await page.goto(`${env_1.env.PUBLIC_BASE_URL}/r/${publicId}?print=1`, {
            waitUntil: 'networkidle0',
            timeout: 60_000,
        });
        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
        });
        await (0, promises_1.writeFile)(out, pdf);
        return out;
    }
    finally {
        await browser.close();
    }
}
