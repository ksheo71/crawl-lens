import { Queue, QueueEvents } from 'bullmq'
import IORedis from 'ioredis'
import { env } from './env'

export const redisConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
})

export type ScanJobData = { publicId: string }
export type PdfJobData = { publicId: string }

// bullmq bundles its own ioredis@5.10.x while the project uses ioredis@5.11.x.
// The two are runtime-equivalent but TypeScript treats them as distinct types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const scanQueue = new Queue<ScanJobData>('scan', { connection: redisConnection as any })
// bullmq bundles its own ioredis@5.10.x while the project uses ioredis@5.11.x.
// The two are runtime-equivalent but TypeScript treats them as distinct types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const pdfQueue = new Queue<PdfJobData>('pdf', { connection: redisConnection as any })

export const progressKey = (publicId: string) => `scan:progress:${publicId}`

// bullmq bundles its own ioredis@5.10.x while the project uses ioredis@5.11.x.
// The two are runtime-equivalent but TypeScript treats them as distinct types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const pdfQueueEvents = new QueueEvents('pdf', { connection: redisConnection as any })
