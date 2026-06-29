"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const zod_1 = require("zod");
const schema = zod_1.z.object({
    DATABASE_URL: zod_1.z.string().url(),
    REDIS_URL: zod_1.z.string().url(),
    PSI_API_KEY: zod_1.z.string().min(1),
    PUBLIC_BASE_URL: zod_1.z.string().url(),
    IP_HASH_SALT: zod_1.z.string().min(16),
    RATE_LIMIT_ALLOWLIST: zod_1.z.string().optional().default(''),
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    PDF_CACHE_DIR: zod_1.z.string().default('/tmp/crawl-lens-pdf'),
});
exports.env = schema.parse(process.env);
