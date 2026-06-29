import { z } from 'zod'

const schema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  PSI_API_KEY: z.string().min(1),
  PUBLIC_BASE_URL: z.string().url(),
  IP_HASH_SALT: z.string().min(16),
  RATE_LIMIT_ALLOWLIST: z.string().optional().default(''),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PDF_CACHE_DIR: z.string().default('/tmp/crawl-lens-pdf'),
})

export const env = schema.parse(process.env)
export type Env = z.infer<typeof schema>
