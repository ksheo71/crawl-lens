import { z } from 'zod'

const schema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  PSI_API_KEY: z.string().optional().default(''),
  PUBLIC_BASE_URL: z.string().url(),
  IP_HASH_SALT: z.string().min(16),
  RATE_LIMIT_ALLOWLIST: z.string().optional().default(''),
  PDF_CACHE_DIR: z.string().default('/tmp/crawl-lens-pdf'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

const result = schema.safeParse(process.env)
if (!result.success) {
  const issues = result.error.issues
    .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n')
  console.error(`\nMissing or invalid env variables:\n${issues}\n\nCheck .env (copy .env.example and fill values).`)
  process.exit(1)
}
export const env = result.data
export type Env = z.infer<typeof schema>
