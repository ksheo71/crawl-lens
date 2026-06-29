import { Queue } from 'bullmq'
import IORedis from 'ioredis'
import { env } from './env'

export const redisConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
})

export type ScanJobData = { publicId: string }
export type PdfJobData = { publicId: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const scanQueue = new Queue<ScanJobData>('scan', { connection: redisConnection as any })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const pdfQueue = new Queue<PdfJobData>('pdf', { connection: redisConnection as any })

export const progressKey = (publicId: string) => `scan:progress:${publicId}`
