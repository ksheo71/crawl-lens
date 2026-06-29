import { Worker } from 'bullmq'
import { redisConnection } from '@/lib/queue'
import { processScan } from './scan'

const scanWorker = new Worker(
  'scan',
  async (job) => {
    await processScan(job.data.publicId)
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { connection: redisConnection as any, concurrency: 2 },
)

scanWorker.on('failed', (job, err) => {
  console.error(JSON.stringify({ level: 'error', queue: 'scan', jobId: job?.id, msg: err.message }))
})

console.log(JSON.stringify({ level: 'info', msg: 'worker started', queues: ['scan'] }))
