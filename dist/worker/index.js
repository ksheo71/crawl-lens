"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bullmq_1 = require("bullmq");
const queue_1 = require("@/lib/queue");
const scan_1 = require("./scan");
const pdf_1 = require("./pdf");
const scanWorker = new bullmq_1.Worker('scan', async (job) => {
    await (0, scan_1.processScan)(job.data.publicId);
}, 
// bullmq bundles its own ioredis@5.10.x while the project uses ioredis@5.11.x.
// The two are runtime-equivalent but TypeScript treats them as distinct types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
{ connection: queue_1.redisConnection, concurrency: 2 });
scanWorker.on('failed', (job, err) => {
    console.error(JSON.stringify({ level: 'error', queue: 'scan', jobId: job?.id, msg: err.message }));
});
const pdfWorker = new bullmq_1.Worker('pdf', async (job) => {
    await (0, pdf_1.processPdf)(job.data.publicId);
}, 
// bullmq bundles its own ioredis@5.10.x while the project uses ioredis@5.11.x.
// The two are runtime-equivalent but TypeScript treats them as distinct types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
{ connection: queue_1.redisConnection, concurrency: 1 });
pdfWorker.on('failed', (job, err) => {
    console.error(JSON.stringify({ level: 'error', queue: 'pdf', jobId: job?.id, msg: err.message }));
});
// Immediate first heartbeat
void queue_1.redisConnection
    .set('worker:heartbeat', new Date().toISOString(), 'EX', 30)
    .catch((err) => {
    console.error(JSON.stringify({ level: 'error', msg: 'heartbeat failed', err: err.message }));
});
// Periodic heartbeat (every 5 seconds)
setInterval(() => {
    queue_1.redisConnection
        .set('worker:heartbeat', new Date().toISOString(), 'EX', 30)
        .catch((err) => {
        console.error(JSON.stringify({ level: 'error', msg: 'heartbeat failed', err: err.message }));
    });
}, 5_000);
console.log(JSON.stringify({ level: 'info', msg: 'worker started', queues: ['scan', 'pdf'] }));
