"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ipHash = ipHash;
exports.extractIp = extractIp;
const node_crypto_1 = require("node:crypto");
const env_1 = require("./env");
function ipHash(ip) {
    return (0, node_crypto_1.createHash)('sha256').update(ip + env_1.env.IP_HASH_SALT).digest('hex');
}
function extractIp(req) {
    const xff = req.headers.get('x-forwarded-for') ?? '';
    const first = xff.split(',')[0]?.trim();
    return first || req.headers.get('x-real-ip') || 'unknown';
}
