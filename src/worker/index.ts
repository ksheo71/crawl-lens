import { Worker } from 'bullmq'
import { redisConnection } from '@/lib/queue'
import { processScan } from './scan'

const scanWorker = new Worker(
  'scan',
  async (job) => {
    await processScan(job.data.publicId)
  },
  // bullmq bundles its own ioredis@5.10.x while the project uses ioredis@5.11.x.
  // The two are runtime-equivalent but TypeScript treats them as distinct types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { connection: redisConnection as any, concurrency: 2 },
)

scanWorker.on('failed', (job, err) => {
  console.error(JSON.stringify({ level: 'error', queue: 'scan', jobId: job?.id, msg: err.message }))
})

// Immediate first heartbeat
await redisConnection.set('worker:heartbeat', new Date().toISOString(), 'EX', 30)

// Periodic heartbeat (every 5 seconds)
setInterval(async () => {
  await redisConnection.set('worker:heartbeat', new Date().toISOString(), 'EX', 30)
}, 5_000)

console.log(JSON.stringify({ level: 'info', msg: 'worker started', queues: ['scan'] }))
