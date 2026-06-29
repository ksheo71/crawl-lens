"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aggregate = aggregate;
const CATS = ['meta', 'content', 'technical', 'performance'];
const STATUS_VAL = { pass: 1, warn: 0.5, fail: 0, skip: NaN };
function aggregate(checks) {
    const categories = {};
    for (const cat of CATS) {
        const items = checks.filter((c) => c.category === cat && c.status !== 'skip');
        if (items.length === 0) {
            categories[cat] = null;
            continue;
        }
        const num = items.reduce((s, c) => s + STATUS_VAL[c.status] * c.weight, 0);
        const den = items.reduce((s, c) => s + c.weight, 0);
        categories[cat] = Math.round((num / den) * 100);
    }
    const present = CATS.map((c) => categories[c]).filter((v) => v != null);
    const total = present.length === 0 ? 0 : Math.round(present.reduce((a, b) => a + b, 0) / present.length);
    return { total, categories };
}
