"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.allowlistContains = allowlistContains;
exports.checkRateLimit = checkRateLimit;
const queue_1 = require("./queue");
const env_1 = require("./env");
const LIMIT = 30;
const WINDOW_SEC = 3600;
const allowlist = new Set(env_1.env.RATE_LIMIT_ALLOWLIST.split(',').map((s) => s.trim()).filter(Boolean));
function allowlistContains(ip) {
    return allowlist.has(ip);
}
async function checkRateLimit(ipHashOrIp) {
    if (allowlist.has(ipHashOrIp))
        return { allowed: true, remaining: LIMIT };
    const hour = new Date().toISOString().slice(0, 13);
    const key = `ratelimit:${ipHashOrIp}:${hour}`;
    const n = await queue_1.redisConnection.incr(key);
    if (n === 1)
        await queue_1.redisConnection.expire(key, WINDOW_SEC);
    return { allowed: n <= LIMIT, remaining: Math.max(0, LIMIT - n) };
}
