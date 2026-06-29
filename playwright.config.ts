import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4500',
    headless: true,
  },
  projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }],
  webServer: [
    {
      command: 'npm run dev',
      port: 4500,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        NODE_ENV: 'test',
        DATABASE_URL: process.env.DATABASE_URL ?? '',
        REDIS_URL: process.env.REDIS_URL ?? '',
        PSI_API_KEY: 'e2e-key',
        PUBLIC_BASE_URL: 'http://localhost:4500',
        IP_HASH_SALT: 'e2e-salt-1234567890',
        RATE_LIMIT_ALLOWLIST: '127.0.0.1',
      },
    },
    {
      command: 'npm run worker:dev',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: {
        NODE_ENV: 'test',
        DATABASE_URL: process.env.DATABASE_URL ?? '',
        REDIS_URL: process.env.REDIS_URL ?? '',
        PSI_API_KEY: 'e2e-key',
        PUBLIC_BASE_URL: 'http://localhost:4500',
        IP_HASH_SALT: 'e2e-salt-1234567890',
        RATE_LIMIT_ALLOWLIST: '127.0.0.1',
      },
    },
  ],
})
