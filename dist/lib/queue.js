"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pdfQueueEvents = exports.progressKey = exports.pdfQueue = exports.scanQueue = exports.redisConnection = void 0;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const env_1 = require("./env");
exports.redisConnection = new ioredis_1.default(env_1.env.REDIS_URL, {
    maxRetriesPerRequest: null,
});
// bullmq bundles its own ioredis@5.10.x while the project uses ioredis@5.11.x.
// The two are runtime-equivalent but TypeScript treats them as distinct types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
exports.scanQueue = new bullmq_1.Queue('scan', { connection: exports.redisConnection });
// bullmq bundles its own ioredis@5.10.x while the project uses ioredis@5.11.x.
// The two are runtime-equivalent but TypeScript treats them as distinct types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
exports.pdfQueue = new bullmq_1.Queue('pdf', { connection: exports.redisConnection });
const progressKey = (publicId) => `scan:progress:${publicId}`;
exports.progressKey = progressKey;
// bullmq bundles its own ioredis@5.10.x while the project uses ioredis@5.11.x.
// The two are runtime-equivalent but TypeScript treats them as distinct types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
exports.pdfQueueEvents = new bullmq_1.QueueEvents('pdf', { connection: exports.redisConnection });
