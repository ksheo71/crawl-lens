# crawl-lens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** URL 하나를 넣으면 메타·콘텐츠·기술·성능 SEO를 분석해 공유 가능한 결과 페이지를 돌려주는 Next.js 웹서비스 MVP를 구현한다.

**Architecture:** Next.js 단일 코드베이스에서 web/worker 두 컨테이너로 분리. web은 입력·표시·API, worker는 BullMQ로 검사·PDF 생성 처리. 호스트 PostgreSQL/Redis 재사용. Caddy + Cloudflare Tunnel 패턴(`/opt/stack/CLAUDE.md`)으로 배포.

**Tech Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS + shadcn/ui · Prisma · PostgreSQL · BullMQ · Redis · cheerio · Puppeteer · Vitest · Playwright · OrbStack(Docker)

## Global Constraints

- 도메인: `crawl-lens.myazit.kr`. 내부 포트: `4500`.
- DB는 `host.docker.internal:5432/crawl_lens`, Redis는 `host.docker.internal:6379/3`. Compose에 `extra_hosts: ["host.docker.internal:host-gateway"]` 명시.
- Node 22 alpine 이미지. 두 컨테이너(`crawl-lens-web`, `crawl-lens-worker`)는 같은 이미지에서 command만 다르게.
- `edge_shared` 도커 네트워크에 합류 (`external: true`).
- 결과 페이지 공유 URL은 `/r/{publicId}`, publicId는 nanoid 10자.
- 검사 4개 카테고리(meta/content/technical/performance) 각 25점, 총 100점. PSI는 모바일 strategy 1회 호출.
- 사용자 메시지·UI는 한국어. 검사 항목 식별자 `id`는 영어 (예: `meta.title.length`).
- User-Agent: `crawl-lens/1.0 (+https://crawl-lens.myazit.kr)`.
- IP는 평문 저장 금지 — `SHA-256(ip + IP_HASH_SALT)`로 hash.
- Rate limit: IP당 시간당 30회.
- 외부 사이트 fetch는 CI 테스트에서 금지 — `msw` 또는 `nock`으로 인터셉트.
- `.env*` 는 git 제외. `.env.example`만 커밋.
- 폴링 간격: 1초 → 30초 이후 2초 → 5초.

---

## File Structure

```
/Users/kyle/workspace/crawl-lens/
├── docs/superpowers/{specs,plans}/        이미 존재
├── prisma/
│   ├── schema.prisma                      Task 3
│   └── migrations/                        Task 3 (prisma migrate dev 결과물)
├── src/
│   ├── app/
│   │   ├── layout.tsx                     Task 1
│   │   ├── globals.css                    Task 1
│   │   ├── page.tsx                       Task 14 (홈)
│   │   ├── r/[id]/
│   │   │   ├── page.tsx                   Task 15 (결과 페이지)
│   │   │   ├── route.ts                   Task 16 (Accept negotiation; page와 분리 라우팅 트릭)
│   │   │   ├── pdf/route.ts               Task 17
│   │   │   └── (parts)/                   Task 15 (결과 페이지 클라이언트 컴포넌트들)
│   │   └── api/
│   │       ├── scan/route.ts              Task 11 (POST)
│   │       ├── scan/[id]/status/route.ts  Task 11 (GET)
│   │       └── health/route.ts            Task 13
│   ├── analyzers/
│   │   ├── types.ts                       Task 5
│   │   ├── meta.ts                        Task 5
│   │   ├── content.ts                     Task 6
│   │   ├── technical.ts                   Task 7
│   │   └── performance.ts                 Task 8
│   ├── lib/
│   │   ├── url.ts                         Task 2
│   │   ├── id.ts                          Task 2
│   │   ├── db.ts                          Task 3
│   │   ├── fetcher.ts                     Task 4
│   │   ├── score.ts                       Task 9
│   │   ├── queue.ts                       Task 10
│   │   ├── ratelimit.ts                   Task 12
│   │   ├── ipHash.ts                      Task 12
│   │   └── env.ts                         Task 1 (런타임 env 검증)
│   └── worker/
│       ├── index.ts                       Task 10 (entry)
│       ├── scan.ts                        Task 10 (scan 잡 처리)
│       └── pdf.ts                         Task 17 (pdf 잡 처리)
├── tests/
│   ├── fixtures/html/                     Task 5~7 (분석용 HTML 샘플)
│   ├── unit/                              Task 2,4~9,12
│   ├── integration/                       Task 11
│   └── e2e/                               Task 20
├── public/                                기본 정적 자원
├── scripts/deploy.sh                      Task 19
├── .github/workflows/
│   ├── ci.yml                             Task 1 (lint+typecheck+test)
│   └── deploy.yml                         Task 19
├── Dockerfile                             Task 18
├── docker-compose.yml                     Task 18
├── package.json                           Task 1
├── tsconfig.json                          Task 1
├── next.config.mjs                        Task 1
├── tailwind.config.ts                     Task 1
├── postcss.config.mjs                     Task 1
├── vitest.config.ts                       Task 1
├── playwright.config.ts                   Task 20
├── .gitignore                             Task 1
├── .env.example                           Task 1
├── README.md                              Task 1 (최소)
└── CLAUDE.md                              Task 19 (저장소 가이드)
```

---

## Task 1: 프로젝트 부트스트랩

**Goal:** Next.js 15 + TypeScript + Tailwind + shadcn/ui + Vitest 셋업. CI 셋업. `.gitignore`/`.env.example` 정비.

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `vitest.config.ts`, `.gitignore`, `.env.example`, `README.md`, `src/app/layout.tsx`, `src/app/globals.css`, `src/lib/env.ts`, `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: (없음)
- Produces: `env` 객체 (`import { env } from '@/lib/env'`) — `DATABASE_URL`, `REDIS_URL`, `PSI_API_KEY`, `PUBLIC_BASE_URL`, `IP_HASH_SALT`, `RATE_LIMIT_ALLOWLIST`, `NODE_ENV` 검증된 상수 노출

- [ ] **Step 1: Git 저장소 초기화**

Run:
```bash
cd /Users/kyle/workspace/crawl-lens
git init -b main
```

- [ ] **Step 2: Next.js 프로젝트 생성**

Run:
```bash
cd /Users/kyle/workspace/crawl-lens
npx --yes create-next-app@15 . --typescript --eslint --tailwind --app --src-dir --import-alias "@/*" --no-turbopack --use-npm
```
(대화형 질문이 뜨면 모두 default 또는 위의 옵션값으로.)

Expected: `package.json`, `src/app/{layout,page,globals.css}.tsx`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `.gitignore`, `eslint.config.mjs` 생성.

- [ ] **Step 3: 필수 의존성 설치**

Run:
```bash
npm install \
  @prisma/client@^5 \
  prisma@^5 \
  bullmq@^5 \
  ioredis@^5 \
  cheerio@^1 \
  nanoid@^5 \
  zod@^3 \
  pino@^9 \
  pino-pretty@^11 \
  puppeteer-core@^23 \
  @sparticuz/chromium@^129

npm install -D \
  vitest@^2 \
  @vitest/coverage-v8@^2 \
  msw@^2 \
  testcontainers@^10 \
  @playwright/test@^1 \
  @types/node@^22
```

Note: `puppeteer-core` + `@sparticuz/chromium` 조합으로 worker 컨테이너에서 Chromium 실행. Worker Dockerfile에서 시스템 chromium을 쓰는 방법도 있지만, 일관성을 위해 이 조합 사용.

- [ ] **Step 4: shadcn/ui 초기화**

Run:
```bash
npx --yes shadcn@latest init -d --base-color slate --css-variables
```

Expected: `components.json`, `src/lib/utils.ts`, `src/components/ui/` 디렉토리 준비.

필요 컴포넌트만 미리 추가:
```bash
npx --yes shadcn@latest add button input card badge accordion separator toast
```

- [ ] **Step 5: `src/lib/env.ts` 작성 (런타임 env 검증)**

```ts
import { z } from 'zod'

const schema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  PSI_API_KEY: z.string().min(1),
  PUBLIC_BASE_URL: z.string().url(),
  IP_HASH_SALT: z.string().min(16),
  RATE_LIMIT_ALLOWLIST: z.string().optional().default(''),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

export const env = schema.parse(process.env)
export type Env = z.infer<typeof schema>
```

- [ ] **Step 6: `.env.example` 작성**

```bash
DATABASE_URL=postgresql://crawl_lens:changeme@localhost:5432/crawl_lens
REDIS_URL=redis://localhost:6379/3
PSI_API_KEY=
PUBLIC_BASE_URL=http://localhost:4500
IP_HASH_SALT=change-me-min-16-chars
RATE_LIMIT_ALLOWLIST=127.0.0.1
NODE_ENV=development
```

- [ ] **Step 7: `.gitignore` 보강**

`.gitignore`에 아래 라인 추가 (Next.js 기본에 더해):
```
.env
.env.*
!.env.example
/coverage
/test-results
/playwright-report
/data
```

- [ ] **Step 8: `vitest.config.ts` 작성**

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    coverage: { provider: 'v8', reporter: ['text', 'lcov'] },
  },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
})
```

- [ ] **Step 9: `package.json` 스크립트 추가**

`package.json`의 `scripts`에 추가:
```json
{
  "scripts": {
    "dev": "next dev -p 4500",
    "build": "next build",
    "start": "next start -p 4500",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "worker": "node dist/worker/index.js",
    "worker:dev": "tsx src/worker/index.ts",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate deploy"
  }
}
```

Run: `npm install -D tsx@^4`

- [ ] **Step 10: `src/app/layout.tsx` 한국어 lang 설정**

```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'crawl-lens',
  description: '내 사이트가 검색에 잘 노출되는지 30초 안에 알아보세요.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 11: CI workflow 작성**

`.github/workflows/ci.yml`:
```yaml
name: ci
on:
  push: { branches-ignore: [main] }
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: crawl_lens
          POSTGRES_PASSWORD: changeme
          POSTGRES_DB: crawl_lens_test
        ports: ['5432:5432']
        options: --health-cmd pg_isready --health-interval 5s
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npx prisma generate
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test
        env:
          DATABASE_URL: postgresql://crawl_lens:changeme@localhost:5432/crawl_lens_test
          REDIS_URL: redis://localhost:6379/3
          PSI_API_KEY: dummy
          PUBLIC_BASE_URL: http://localhost:4500
          IP_HASH_SALT: ci-test-salt-1234567890
          NODE_ENV: test
```

- [ ] **Step 12: 빌드 + 타입체크 확인**

Run:
```bash
npm run lint
npm run typecheck
```

Expected: 둘 다 통과.

- [ ] **Step 13: 첫 커밋**

```bash
git add -A
git commit -m "chore: bootstrap Next.js 15 + Tailwind + Vitest"
```

---

## Task 2: 핵심 유틸 (URL 정규화 + publicId 생성)

**Goal:** 다른 모든 task가 의존하는 두 유틸 함수를 TDD로 구현.

**Files:**
- Create: `src/lib/url.ts`, `src/lib/id.ts`
- Test: `tests/unit/lib/url.test.ts`, `tests/unit/lib/id.test.ts`

**Interfaces:**
- Consumes: (없음)
- Produces:
  - `normalizeUrl(input: string): string` — 정규화된 URL. 잘못된 URL이면 `throw new Error('INVALID_URL')`
  - `newPublicId(): string` — 10자 nanoid (URL-safe 알파벳)

- [ ] **Step 1: URL 정규화 실패 테스트 작성**

`tests/unit/lib/url.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { normalizeUrl } from '@/lib/url'

describe('normalizeUrl', () => {
  it('protocol/host 소문자화', () => {
    expect(normalizeUrl('HTTPS://Example.COM/Path')).toBe('https://example.com/Path')
  })
  it('fragment 제거', () => {
    expect(normalizeUrl('https://example.com/p#section')).toBe('https://example.com/p')
  })
  it('기본 포트 제거', () => {
    expect(normalizeUrl('https://example.com:443/p')).toBe('https://example.com/p')
    expect(normalizeUrl('http://example.com:80/p')).toBe('http://example.com/p')
  })
  it('루트 경로 유지', () => {
    expect(normalizeUrl('https://example.com')).toBe('https://example.com/')
  })
  it('비루트 경로 그대로', () => {
    expect(normalizeUrl('https://example.com/blog/post')).toBe('https://example.com/blog/post')
  })
  it('query string 유지', () => {
    expect(normalizeUrl('https://example.com/p?q=1&z=2')).toBe('https://example.com/p?q=1&z=2')
  })
  it('잘못된 URL은 throw', () => {
    expect(() => normalizeUrl('not-a-url')).toThrow('INVALID_URL')
    expect(() => normalizeUrl('javascript:alert(1)')).toThrow('INVALID_URL')
  })
})
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run: `npm test -- url.test`
Expected: 모든 케이스 FAIL (`normalizeUrl is not defined`).

- [ ] **Step 3: 구현 작성**

`src/lib/url.ts`:
```ts
export function normalizeUrl(input: string): string {
  let u: URL
  try {
    u = new URL(input)
  } catch {
    throw new Error('INVALID_URL')
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error('INVALID_URL')
  }
  u.protocol = u.protocol.toLowerCase()
  u.hostname = u.hostname.toLowerCase()
  if ((u.protocol === 'http:' && u.port === '80') || (u.protocol === 'https:' && u.port === '443')) {
    u.port = ''
  }
  u.hash = ''
  let s = u.toString()
  // URL 객체는 경로 없을 때 '/'를 붙여줌. 그대로 둠.
  return s
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- url.test`
Expected: 모두 PASS.

- [ ] **Step 5: publicId 테스트 작성**

`tests/unit/lib/id.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { newPublicId } from '@/lib/id'

describe('newPublicId', () => {
  it('10자 길이', () => {
    expect(newPublicId()).toHaveLength(10)
  })
  it('URL-safe 알파벳만', () => {
    for (let i = 0; i < 100; i++) {
      expect(newPublicId()).toMatch(/^[A-Za-z0-9_-]+$/)
    }
  })
  it('호출마다 다른 값', () => {
    const a = new Set(Array.from({ length: 1000 }, () => newPublicId()))
    expect(a.size).toBe(1000)
  })
})
```

- [ ] **Step 6: publicId 구현**

`src/lib/id.ts`:
```ts
import { customAlphabet } from 'nanoid'

const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_'
const generate = customAlphabet(alphabet, 10)

export function newPublicId(): string {
  return generate()
}
```

- [ ] **Step 7: 테스트 통과 확인**

Run: `npm test -- id.test`
Expected: PASS.

- [ ] **Step 8: 커밋**

```bash
git add src/lib/url.ts src/lib/id.ts tests/unit/lib/
git commit -m "feat(lib): URL 정규화·publicId 생성"
```

---

## Task 3: Prisma 스키마 + DB 클라이언트

**Goal:** PostgreSQL `crawl_lens` 스키마 정의 + 마이그레이션 + 싱글톤 client.

**Files:**
- Create: `prisma/schema.prisma`, `src/lib/db.ts`
- 자동 생성: `prisma/migrations/*`

**Interfaces:**
- Consumes: `env.DATABASE_URL` (Task 1)
- Produces:
  - `prisma` 싱글톤 (`import { prisma } from '@/lib/db'`)
  - 모델: `Scan`, enum `ScanStatus`

- [ ] **Step 1: `prisma/schema.prisma` 작성**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Scan {
  id            String     @id @default(cuid())
  publicId      String     @unique

  targetUrl     String
  normalizedUrl String

  status        ScanStatus @default(PENDING)
  errorMessage  String?
  errorCode     String?
  fetchStatus   Int?

  totalScore       Int?
  categoryScores   Json?
  checks           Json?

  ipHash        String?
  userAgent     String?

  createdAt     DateTime   @default(now())
  startedAt     DateTime?
  completedAt   DateTime?

  @@index([publicId])
  @@index([createdAt])
  @@index([ipHash, createdAt])
}

enum ScanStatus {
  PENDING
  RUNNING
  DONE
  FAILED
}
```

- [ ] **Step 2: 로컬 PostgreSQL DB 준비 (개발용)**

이미 호스트에 `/opt/stack/services/database/postgres`가 떠 있다는 전제. 새 DB와 user 생성:

```bash
docker exec -i $(docker ps -qf name=postgres) psql -U postgres <<'SQL'
CREATE USER crawl_lens WITH PASSWORD 'changeme';
CREATE DATABASE crawl_lens OWNER crawl_lens;
GRANT ALL PRIVILEGES ON DATABASE crawl_lens TO crawl_lens;
SQL
```

(맥미니에서 실제 운영 비밀번호는 `/opt/stack/services/public/myazit.kr/crawl-lens/.env`에 따로 설정. 로컬 개발에서는 위 값을 `.env`에 그대로.)

`.env` 생성 (커밋하지 않음):
```bash
cp .env.example .env
# DATABASE_URL은 위 user/password에 맞춰 수정
```

- [ ] **Step 3: Prisma 마이그레이션 생성**

Run:
```bash
npx prisma migrate dev --name init
npx prisma generate
```

Expected: `prisma/migrations/<timestamp>_init/migration.sql` 생성, `node_modules/.prisma/client` 생성.

- [ ] **Step 4: `src/lib/db.ts` 싱글톤 작성**

```ts
import { PrismaClient } from '@prisma/client'

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

export const prisma =
  globalThis.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma
}
```

- [ ] **Step 5: 스키마 검증 (간단 INSERT/SELECT)**

`tests/integration/db.test.ts`:
```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { prisma } from '@/lib/db'
import { newPublicId } from '@/lib/id'

beforeAll(async () => {
  await prisma.scan.deleteMany()
})

describe('Scan 모델', () => {
  it('생성·조회 round-trip', async () => {
    const publicId = newPublicId()
    const created = await prisma.scan.create({
      data: {
        publicId,
        targetUrl: 'https://example.com/',
        normalizedUrl: 'https://example.com/',
      },
    })
    const found = await prisma.scan.findUnique({ where: { publicId } })
    expect(found?.id).toBe(created.id)
    expect(found?.status).toBe('PENDING')
  })
})
```

Run: `npm test -- db.test`
Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add prisma/ src/lib/db.ts tests/integration/db.test.ts
git commit -m "feat(db): Scan 스키마 + 마이그레이션 + Prisma 싱글톤"
```

---

## Task 4: HTTP Fetcher

**Goal:** 검사 대상 페이지 + robots.txt + sitemap.xml을 가져오는 공통 클라이언트. 타임아웃, 리다이렉트, UA 일관.

**Files:**
- Create: `src/lib/fetcher.ts`
- Test: `tests/unit/lib/fetcher.test.ts`

**Interfaces:**
- Consumes: (없음 — global `fetch` 사용)
- Produces:
  - `fetchPage(url: string, opts?: { timeoutMs?: number; maxRedirects?: number }): Promise<FetchResult>`
  - `type FetchResult = { ok: true; finalUrl: string; status: number; headers: Headers; body: string } | { ok: false; code: ErrorCode; status?: number }`
  - `type ErrorCode = 'DNS_FAIL' | 'CONN_FAIL' | 'TIMEOUT' | 'HTTP_4XX' | 'HTTP_5XX' | 'PARSE_FAIL'`
  - 상수: `USER_AGENT = 'crawl-lens/1.0 (+https://crawl-lens.myazit.kr)'`

- [ ] **Step 1: 실패 모드 테스트 작성**

`tests/unit/lib/fetcher.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse, delay } from 'msw'
import { fetchPage, USER_AGENT } from '@/lib/fetcher'

const server = setupServer(
  http.get('https://ok.test/', ({ request }) => {
    return new HttpResponse('<html><body>hi</body></html>', {
      status: 200,
      headers: { 'content-type': 'text/html', 'x-echo-ua': request.headers.get('user-agent') ?? '' },
    })
  }),
  http.get('https://notfound.test/', () => HttpResponse.text('nope', { status: 404 })),
  http.get('https://err.test/', () => HttpResponse.text('boom', { status: 500 })),
  http.get('https://slow.test/', async () => {
    await delay(20_000)
    return HttpResponse.text('late', { status: 200 })
  }),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

describe('fetchPage', () => {
  it('성공 시 본문·헤더·UA 일관', async () => {
    const r = await fetchPage('https://ok.test/')
    if (!r.ok) throw new Error('expected ok')
    expect(r.status).toBe(200)
    expect(r.body).toContain('hi')
    expect(r.headers.get('x-echo-ua')).toBe(USER_AGENT)
    expect(r.finalUrl).toBe('https://ok.test/')
  })
  it('404 → HTTP_4XX', async () => {
    const r = await fetchPage('https://notfound.test/')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.code).toBe('HTTP_4XX')
      expect(r.status).toBe(404)
    }
  })
  it('500 → HTTP_5XX', async () => {
    const r = await fetchPage('https://err.test/')
    if (r.ok) throw new Error('expected fail')
    expect(r.code).toBe('HTTP_5XX')
  })
  it('타임아웃 → TIMEOUT', async () => {
    const r = await fetchPage('https://slow.test/', { timeoutMs: 100 })
    if (r.ok) throw new Error('expected timeout')
    expect(r.code).toBe('TIMEOUT')
  })
})
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run: `npm test -- fetcher.test`
Expected: 모든 케이스 FAIL.

- [ ] **Step 3: 구현 작성**

`src/lib/fetcher.ts`:
```ts
export const USER_AGENT = 'crawl-lens/1.0 (+https://crawl-lens.myazit.kr)'

export type ErrorCode =
  | 'DNS_FAIL'
  | 'CONN_FAIL'
  | 'TIMEOUT'
  | 'HTTP_4XX'
  | 'HTTP_5XX'
  | 'PARSE_FAIL'

export type FetchResult =
  | { ok: true; finalUrl: string; status: number; headers: Headers; body: string }
  | { ok: false; code: ErrorCode; status?: number }

export async function fetchPage(
  url: string,
  opts: { timeoutMs?: number; maxRedirects?: number } = {},
): Promise<FetchResult> {
  const timeoutMs = opts.timeoutMs ?? 15_000
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,*/*;q=0.8' },
      redirect: 'follow',
      signal: controller.signal,
    })
    if (res.status >= 500) return { ok: false, code: 'HTTP_5XX', status: res.status }
    if (res.status >= 400) return { ok: false, code: 'HTTP_4XX', status: res.status }
    const body = await res.text()
    return { ok: true, finalUrl: res.url, status: res.status, headers: res.headers, body }
  } catch (err) {
    if ((err as Error).name === 'AbortError') return { ok: false, code: 'TIMEOUT' }
    const msg = (err as Error).message ?? ''
    if (/ENOTFOUND|EAI_AGAIN/i.test(msg)) return { ok: false, code: 'DNS_FAIL' }
    return { ok: false, code: 'CONN_FAIL' }
  } finally {
    clearTimeout(timer)
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- fetcher.test`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/fetcher.ts tests/unit/lib/fetcher.test.ts
git commit -m "feat(lib): fetchPage with timeout, redirect, error classification"
```

---

## Task 5: Analyzer 인터페이스 + Meta Analyzer

**Goal:** 모든 analyzer가 공유할 타입 + 메타데이터 카테고리 검사기. Fixture 기반 TDD.

**Files:**
- Create: `src/analyzers/types.ts`, `src/analyzers/meta.ts`
- Create: `tests/fixtures/html/meta-good.html`, `tests/fixtures/html/meta-missing.html`, `tests/fixtures/html/meta-too-short-title.html`
- Test: `tests/unit/analyzers/meta.test.ts`

**Interfaces:**
- Consumes: (Task 4의 FetchResult이 변환된 형태)
- Produces:
  - `type CheckResult` (앞서 spec에 정의된 그대로)
  - `type AnalyzeContext = { targetUrl: string; normalizedUrl: string; finalUrl: string; html: string; $: cheerio.CheerioAPI; responseHeaders: Headers; responseStatus: number }`
  - `interface Analyzer { name: Category; run(ctx: AnalyzeContext): Promise<CheckResult[]> }`
  - `metaAnalyzer: Analyzer`

검사 항목 (`id`):
- `meta.title.present`
- `meta.title.length` (30~60자 권장)
- `meta.description.present`
- `meta.description.length` (50~160자 권장)
- `meta.canonical.present`
- `meta.og.title.present`
- `meta.og.description.present`
- `meta.og.image.present`
- `meta.twitter.card.present`
- `meta.viewport.present`
- `meta.html.lang.present`

- [ ] **Step 1: `src/analyzers/types.ts` 작성**

```ts
import type { CheerioAPI } from 'cheerio'

export type Category = 'meta' | 'content' | 'technical' | 'performance'
export type CheckStatus = 'pass' | 'warn' | 'fail' | 'skip'

export type CheckResult = {
  id: string
  category: Category
  status: CheckStatus
  title: string
  message: string
  detail?: Record<string, unknown>
  fix?: string
  docs?: string
  weight: number
}

export type AnalyzeContext = {
  targetUrl: string
  normalizedUrl: string
  finalUrl: string
  html: string
  $: CheerioAPI
  responseHeaders: Headers
  responseStatus: number
}

export interface Analyzer {
  name: Category
  run(ctx: AnalyzeContext): Promise<CheckResult[]>
}
```

- [ ] **Step 2: Fixture HTML 3개 작성**

`tests/fixtures/html/meta-good.html`:
```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>좋은 블로그 글 제목입니다 - 어떻게 SEO를 시작할까</title>
  <meta name="description" content="SEO 입문자가 알아야 할 핵심 다섯 가지를 정리했습니다. 메타 태그부터 콘텐츠 구조까지 차근차근 설명합니다.">
  <link rel="canonical" href="https://example.com/blog/seo-intro">
  <meta property="og:title" content="좋은 블로그 글 제목입니다">
  <meta property="og:description" content="SEO 입문자용 가이드">
  <meta property="og:image" content="https://example.com/og.png">
  <meta name="twitter:card" content="summary_large_image">
</head>
<body><h1>본문</h1></body>
</html>
```

`tests/fixtures/html/meta-missing.html`:
```html
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body><h1>본문</h1></body>
</html>
```

`tests/fixtures/html/meta-too-short-title.html`:
```html
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>짧음</title>
  <meta name="description" content="설명도 너무 짧습니다.">
</head>
<body><h1>본문</h1></body>
</html>
```

- [ ] **Step 3: 테스트 작성**

`tests/unit/analyzers/meta.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import * as cheerio from 'cheerio'
import { metaAnalyzer } from '@/analyzers/meta'
import type { AnalyzeContext } from '@/analyzers/types'

function ctx(fixture: string): AnalyzeContext {
  const html = readFileSync(path.join('tests/fixtures/html', fixture), 'utf-8')
  return {
    targetUrl: 'https://example.com/blog/post',
    normalizedUrl: 'https://example.com/blog/post',
    finalUrl: 'https://example.com/blog/post',
    html,
    $: cheerio.load(html),
    responseHeaders: new Headers(),
    responseStatus: 200,
  }
}

describe('metaAnalyzer', () => {
  it('완전한 메타: 대부분 pass', async () => {
    const results = await metaAnalyzer.run(ctx('meta-good.html'))
    const byId = Object.fromEntries(results.map((r) => [r.id, r]))
    expect(byId['meta.title.present'].status).toBe('pass')
    expect(byId['meta.description.present'].status).toBe('pass')
    expect(byId['meta.canonical.present'].status).toBe('pass')
    expect(byId['meta.og.image.present'].status).toBe('pass')
    expect(byId['meta.html.lang.present'].status).toBe('pass')
    expect(byId['meta.viewport.present'].status).toBe('pass')
  })

  it('메타 누락: 다수 fail', async () => {
    const results = await metaAnalyzer.run(ctx('meta-missing.html'))
    const byId = Object.fromEntries(results.map((r) => [r.id, r]))
    expect(byId['meta.title.present'].status).toBe('fail')
    expect(byId['meta.description.present'].status).toBe('fail')
    expect(byId['meta.canonical.present'].status).toBe('fail')
    expect(byId['meta.viewport.present'].status).toBe('fail')
    expect(byId['meta.html.lang.present'].status).toBe('fail')
  })

  it('너무 짧은 title/description: warn', async () => {
    const results = await metaAnalyzer.run(ctx('meta-too-short-title.html'))
    const byId = Object.fromEntries(results.map((r) => [r.id, r]))
    expect(byId['meta.title.length'].status).toBe('warn')
    expect(byId['meta.title.length'].detail).toMatchObject({ length: 2 })
    expect(byId['meta.description.length'].status).toBe('warn')
  })

  it('모든 결과는 category=meta', async () => {
    const results = await metaAnalyzer.run(ctx('meta-good.html'))
    expect(results.every((r) => r.category === 'meta')).toBe(true)
  })
})
```

Run: `npm test -- meta.test` → FAIL (모듈 없음).

- [ ] **Step 4: `src/analyzers/meta.ts` 구현**

```ts
import type { Analyzer, CheckResult } from './types'

const docs = {
  title: 'https://developers.google.com/search/docs/appearance/title-link',
  description: 'https://developers.google.com/search/docs/appearance/snippet',
  canonical: 'https://developers.google.com/search/docs/crawling-indexing/canonicalization',
  og: 'https://ogp.me/',
  viewport: 'https://developer.mozilla.org/docs/Web/HTML/Viewport_meta_tag',
}

export const metaAnalyzer: Analyzer = {
  name: 'meta',
  async run(ctx): Promise<CheckResult[]> {
    const $ = ctx.$
    const out: CheckResult[] = []

    const title = $('head > title').first().text().trim()
    out.push({
      id: 'meta.title.present',
      category: 'meta',
      status: title ? 'pass' : 'fail',
      title: 'Title 태그 존재',
      message: title
        ? '<title> 태그가 정상적으로 설정되어 있어요.'
        : '<title> 태그가 비어 있거나 없습니다. 검색 결과의 첫인상을 결정하는 가장 중요한 요소예요.',
      detail: { value: title },
      fix: title ? undefined : '<head>에 <title>페이지 제목</title>을 추가해주세요.',
      docs: docs.title,
      weight: 5,
    })
    if (title) {
      const len = title.length
      const ok = len >= 30 && len <= 60
      out.push({
        id: 'meta.title.length',
        category: 'meta',
        status: ok ? 'pass' : 'warn',
        title: 'Title 태그 길이',
        message: ok
          ? `현재 ${len}자입니다. 검색 결과에서 잘리지 않을 적정 범위예요.`
          : `현재 ${len}자입니다. 30~60자가 적당합니다.`,
        detail: { value: title, length: len },
        fix: ok ? undefined : '핵심 키워드를 앞쪽에 두고 30~60자로 조정해주세요.',
        docs: docs.title,
        weight: 4,
      })
    }

    const desc = $('meta[name="description"]').attr('content')?.trim() ?? ''
    out.push({
      id: 'meta.description.present',
      category: 'meta',
      status: desc ? 'pass' : 'fail',
      title: 'Meta description 존재',
      message: desc ? 'meta description이 있어요.' : 'meta description이 비어 있습니다.',
      detail: { value: desc },
      fix: desc ? undefined : '<meta name="description" content="...">를 추가해주세요.',
      docs: docs.description,
      weight: 4,
    })
    if (desc) {
      const len = desc.length
      const ok = len >= 50 && len <= 160
      out.push({
        id: 'meta.description.length',
        category: 'meta',
        status: ok ? 'pass' : 'warn',
        title: 'Meta description 길이',
        message: ok ? `${len}자입니다.` : `${len}자입니다. 50~160자가 적당합니다.`,
        detail: { length: len },
        fix: ok ? undefined : '핵심 내용을 50~160자로 요약해 적어주세요.',
        docs: docs.description,
        weight: 3,
      })
    }

    const canonical = $('link[rel="canonical"]').attr('href')?.trim() ?? ''
    out.push({
      id: 'meta.canonical.present',
      category: 'meta',
      status: canonical ? 'pass' : 'fail',
      title: 'Canonical URL 설정',
      message: canonical ? `canonical: ${canonical}` : 'canonical 링크가 없습니다.',
      detail: { value: canonical },
      fix: canonical ? undefined : '<link rel="canonical" href="..."> 를 추가해주세요.',
      docs: docs.canonical,
      weight: 4,
    })

    const ogPairs: Array<{ id: string; sel: string; label: string }> = [
      { id: 'meta.og.title.present', sel: 'meta[property="og:title"]', label: 'Open Graph title' },
      { id: 'meta.og.description.present', sel: 'meta[property="og:description"]', label: 'Open Graph description' },
      { id: 'meta.og.image.present', sel: 'meta[property="og:image"]', label: 'Open Graph image' },
    ]
    for (const p of ogPairs) {
      const v = $(p.sel).attr('content')?.trim() ?? ''
      out.push({
        id: p.id,
        category: 'meta',
        status: v ? 'pass' : 'fail',
        title: p.label,
        message: v ? `${p.label} 설정됨` : `${p.label}이 없습니다.`,
        detail: { value: v },
        fix: v ? undefined : `<meta property="${p.sel.match(/og:[^"]+/)![0]}" content="..."> 를 추가해주세요.`,
        docs: docs.og,
        weight: 2,
      })
    }

    const twitter = $('meta[name="twitter:card"]').attr('content')?.trim() ?? ''
    out.push({
      id: 'meta.twitter.card.present',
      category: 'meta',
      status: twitter ? 'pass' : 'warn',
      title: 'Twitter Card',
      message: twitter ? `twitter:card: ${twitter}` : 'twitter:card가 없습니다.',
      detail: { value: twitter },
      fix: twitter ? undefined : '<meta name="twitter:card" content="summary_large_image"> 권장',
      docs: docs.og,
      weight: 1,
    })

    const viewport = $('meta[name="viewport"]').attr('content')?.trim() ?? ''
    out.push({
      id: 'meta.viewport.present',
      category: 'meta',
      status: viewport ? 'pass' : 'fail',
      title: 'Viewport meta',
      message: viewport ? viewport : 'viewport meta가 없습니다.',
      detail: { value: viewport },
      fix: viewport ? undefined : '<meta name="viewport" content="width=device-width, initial-scale=1"> 를 추가해주세요.',
      docs: docs.viewport,
      weight: 3,
    })

    const lang = $('html').attr('lang')?.trim() ?? ''
    out.push({
      id: 'meta.html.lang.present',
      category: 'meta',
      status: lang ? 'pass' : 'fail',
      title: 'HTML lang 속성',
      message: lang ? `lang="${lang}"` : '<html lang="..."> 속성이 없습니다.',
      detail: { value: lang },
      fix: lang ? undefined : '<html lang="ko"> 처럼 언어를 명시해주세요.',
      weight: 2,
    })

    return out
  },
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test -- meta.test`
Expected: 4 케이스 PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/analyzers/types.ts src/analyzers/meta.ts tests/fixtures/html/meta-*.html tests/unit/analyzers/meta.test.ts
git commit -m "feat(analyzers): meta analyzer with 11 checks + fixtures"
```

---

## Task 6: Content Analyzer

**Goal:** 콘텐츠 구조(헤딩, alt, 워드카운트, 링크) 검사.

**Files:**
- Create: `src/analyzers/content.ts`
- Create: `tests/fixtures/html/content-good.html`, `tests/fixtures/html/content-no-h1.html`, `tests/fixtures/html/content-missing-alt.html`
- Test: `tests/unit/analyzers/content.test.ts`

**Interfaces:**
- Consumes: `AnalyzeContext` (Task 5)
- Produces: `contentAnalyzer: Analyzer`

검사 항목:
- `content.h1.present` (h1 존재)
- `content.h1.unique` (h1이 하나)
- `content.heading.hierarchy` (h1→h2→h3 건너뛰지 않음)
- `content.image.alt_ratio` (alt 있는 이미지 비율 ≥ 90%)
- `content.wordcount` (300자 이상)
- `content.links.internal_count` (≥1)
- `content.links.broken_sample` (샘플 5개 검사 — v1에서는 status check 안 함, 카운트만)

- [ ] **Step 1: Fixture HTML 3개 작성**

`tests/fixtures/html/content-good.html`:
```html
<!DOCTYPE html>
<html lang="ko"><head><title>Test</title></head>
<body>
<h1>좋은 제목</h1>
<p>이 문서는 SEO 입문자를 위한 가이드입니다. 검색 엔진은 페이지의 메타 정보와 본문 콘텐츠를 함께 평가합니다. 따라서 제목과 설명을 명확히 설정하고, 본문은 독자가 찾는 정보를 충분히 담아야 합니다. 헤딩 태그는 문서 구조를 알려주는 단서이므로 h1을 한 번, 그 아래로 h2와 h3를 사용해 계층을 표현합니다. 이미지에는 반드시 alt 속성을 채워 검색 엔진과 스크린 리더 모두에 의미를 전달해야 합니다. 외부 링크는 권위 있는 출처로 연결하고, 내부 링크로 관련 글을 묶어 체류 시간을 늘립니다. 이 모든 요소를 균형 있게 갖추는 것이 SEO의 출발입니다.</p>
<h2>섹션 1</h2><p>본문 단락.</p>
<h2>섹션 2</h2><p>또 다른 단락.</p>
<img src="/a.png" alt="설명 A">
<img src="/b.png" alt="설명 B">
<a href="/inner">내부</a>
<a href="https://external.example/">외부</a>
</body></html>
```

`tests/fixtures/html/content-no-h1.html`:
```html
<!DOCTYPE html><html lang="ko"><head><title>x</title></head>
<body><h2>제목 없음</h2><p>본문.</p></body></html>
```

`tests/fixtures/html/content-missing-alt.html`:
```html
<!DOCTYPE html><html lang="ko"><head><title>x</title></head>
<body>
<h1>제목</h1>
<p>짧은 본문.</p>
<img src="/a.png">
<img src="/b.png" alt="">
<img src="/c.png" alt="좋음">
</body></html>
```

- [ ] **Step 2: 테스트 작성**

`tests/unit/analyzers/content.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import * as cheerio from 'cheerio'
import { contentAnalyzer } from '@/analyzers/content'
import type { AnalyzeContext } from '@/analyzers/types'

function ctx(fixture: string): AnalyzeContext {
  const html = readFileSync(path.join('tests/fixtures/html', fixture), 'utf-8')
  return {
    targetUrl: 'https://example.com/',
    normalizedUrl: 'https://example.com/',
    finalUrl: 'https://example.com/',
    html,
    $: cheerio.load(html),
    responseHeaders: new Headers(),
    responseStatus: 200,
  }
}

describe('contentAnalyzer', () => {
  it('완전한 콘텐츠: 모두 pass', async () => {
    const r = await contentAnalyzer.run(ctx('content-good.html'))
    const byId = Object.fromEntries(r.map((c) => [c.id, c]))
    expect(byId['content.h1.present'].status).toBe('pass')
    expect(byId['content.h1.unique'].status).toBe('pass')
    expect(byId['content.image.alt_ratio'].status).toBe('pass')
    expect(byId['content.links.internal_count'].status).toBe('pass')
  })
  it('h1 없음: fail', async () => {
    const r = await contentAnalyzer.run(ctx('content-no-h1.html'))
    const byId = Object.fromEntries(r.map((c) => [c.id, c]))
    expect(byId['content.h1.present'].status).toBe('fail')
  })
  it('alt 누락 비율 높음: warn 또는 fail', async () => {
    const r = await contentAnalyzer.run(ctx('content-missing-alt.html'))
    const byId = Object.fromEntries(r.map((c) => [c.id, c]))
    expect(byId['content.image.alt_ratio'].status).not.toBe('pass')
    expect(byId['content.image.alt_ratio'].detail).toMatchObject({ total: 3, withAlt: 1 })
  })
})
```

- [ ] **Step 3: 구현**

`src/analyzers/content.ts`:
```ts
import type { Analyzer, CheckResult } from './types'

export const contentAnalyzer: Analyzer = {
  name: 'content',
  async run(ctx): Promise<CheckResult[]> {
    const $ = ctx.$
    const out: CheckResult[] = []

    const h1s = $('body h1')
    out.push({
      id: 'content.h1.present',
      category: 'content',
      status: h1s.length > 0 ? 'pass' : 'fail',
      title: 'H1 태그 존재',
      message: h1s.length > 0 ? `h1 ${h1s.length}개` : '<h1> 태그가 없습니다.',
      detail: { count: h1s.length },
      fix: h1s.length > 0 ? undefined : '페이지의 주제를 담은 <h1>을 하나 추가해주세요.',
      weight: 5,
    })
    out.push({
      id: 'content.h1.unique',
      category: 'content',
      status: h1s.length === 1 ? 'pass' : h1s.length === 0 ? 'skip' : 'warn',
      title: 'H1 유일성',
      message:
        h1s.length === 1 ? 'h1이 한 개입니다.'
        : h1s.length === 0 ? 'h1이 없어 검사 생략.'
        : `h1이 ${h1s.length}개입니다. 페이지당 1개를 권장합니다.`,
      detail: { count: h1s.length },
      fix: h1s.length > 1 ? '주제 외 헤딩은 h2 이하로 변경해주세요.' : undefined,
      weight: 3,
    })

    const order: number[] = []
    $('body :header').each((_, el) => {
      const tag = el.tagName.toLowerCase()
      if (/^h[1-6]$/.test(tag)) order.push(Number(tag[1]))
    })
    let skipFound = false
    for (let i = 1; i < order.length; i++) {
      if (order[i] - order[i - 1] > 1) { skipFound = true; break }
    }
    out.push({
      id: 'content.heading.hierarchy',
      category: 'content',
      status: order.length === 0 ? 'skip' : skipFound ? 'warn' : 'pass',
      title: '헤딩 계층 건너뛰기',
      message: skipFound ? '헤딩 레벨을 건너뛴 곳이 있습니다.' : '헤딩 계층이 자연스럽습니다.',
      detail: { sequence: order },
      fix: skipFound ? 'h2 다음 h4 같은 점프를 피해주세요.' : undefined,
      weight: 2,
    })

    const imgs = $('body img')
    const withAlt = imgs.filter((_, el) => ($(el).attr('alt') ?? '').trim().length > 0).length
    const ratio = imgs.length === 0 ? 1 : withAlt / imgs.length
    const altStatus = imgs.length === 0 ? 'skip' : ratio >= 0.9 ? 'pass' : ratio >= 0.5 ? 'warn' : 'fail'
    out.push({
      id: 'content.image.alt_ratio',
      category: 'content',
      status: altStatus,
      title: '이미지 alt 비율',
      message: imgs.length === 0
        ? '이미지가 없어 검사 생략.'
        : `${imgs.length}개 중 ${withAlt}개에 alt가 있습니다 (${Math.round(ratio * 100)}%).`,
      detail: { total: imgs.length, withAlt },
      fix: altStatus === 'pass' ? undefined : '의미 있는 이미지에는 alt를 채우고, 장식용 이미지는 alt="" 로 비워주세요.',
      weight: 4,
    })

    const text = $('body').text().replace(/\s+/g, ' ').trim()
    const wc = text.length // 한국어 글자 단위 (영문은 줄어들지만 v1 단순 정책)
    const wcStatus = wc >= 300 ? 'pass' : wc >= 100 ? 'warn' : 'fail'
    out.push({
      id: 'content.wordcount',
      category: 'content',
      status: wcStatus,
      title: '본문 길이',
      message: `본문 ${wc}자.`,
      detail: { chars: wc },
      fix: wcStatus === 'pass' ? undefined : '주제를 충분히 다루려면 300자 이상이 권장됩니다.',
      weight: 2,
    })

    const a = $('body a[href]')
    const host = (() => { try { return new URL(ctx.finalUrl).host } catch { return '' } })()
    let internal = 0, external = 0, nofollow = 0
    a.each((_, el) => {
      const href = $(el).attr('href') ?? ''
      const rel = $(el).attr('rel') ?? ''
      if (/nofollow/i.test(rel)) nofollow++
      try {
        const u = new URL(href, ctx.finalUrl)
        if (u.host === host) internal++
        else external++
      } catch { /* skip */ }
    })
    out.push({
      id: 'content.links.internal_count',
      category: 'content',
      status: internal >= 1 ? 'pass' : 'warn',
      title: '내부 링크 수',
      message: `내부 ${internal}, 외부 ${external}, nofollow ${nofollow}.`,
      detail: { internal, external, nofollow },
      fix: internal === 0 ? '같은 사이트의 관련 글로 내부 링크를 걸어주세요.' : undefined,
      weight: 3,
    })

    return out
  },
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- content.test`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/analyzers/content.ts tests/fixtures/html/content-*.html tests/unit/analyzers/content.test.ts
git commit -m "feat(analyzers): content analyzer (h1, alt, wordcount, links)"
```

---

## Task 7: Technical Analyzer

**Goal:** 기술적 SEO (HTTPS, robots.txt, sitemap.xml, JSON-LD, x-robots-tag) 검사.

**Files:**
- Create: `src/analyzers/technical.ts`
- Test: `tests/unit/analyzers/technical.test.ts`

**Interfaces:**
- Consumes: `AnalyzeContext`. 외부 robots.txt/sitemap.xml fetch는 `fetchPage` 사용 → 테스트에서는 msw로 mock.
- Produces: `technicalAnalyzer: Analyzer`

검사 항목:
- `technical.https` (HTTPS 사용)
- `technical.robots.accessible` (robots.txt 200 응답)
- `technical.robots.disallowed` (대상 URL이 robots에 의해 차단됐는지)
- `technical.sitemap.discoverable` (sitemap.xml 발견 또는 robots에 sitemap 라인)
- `technical.schema.jsonld` (JSON-LD 1개 이상 + 파싱 가능)
- `technical.x_robots_tag.noindex` (응답 헤더 `x-robots-tag`에 noindex 없음)

- [ ] **Step 1: 테스트 작성**

`tests/unit/analyzers/technical.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import * as cheerio from 'cheerio'
import { technicalAnalyzer } from '@/analyzers/technical'
import type { AnalyzeContext } from '@/analyzers/types'

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function ctx(opts: { url: string; html?: string; headers?: HeadersInit }): AnalyzeContext {
  const html = opts.html ?? '<html><head><title>x</title></head><body></body></html>'
  return {
    targetUrl: opts.url,
    normalizedUrl: opts.url,
    finalUrl: opts.url,
    html,
    $: cheerio.load(html),
    responseHeaders: new Headers(opts.headers),
    responseStatus: 200,
  }
}

describe('technicalAnalyzer', () => {
  it('HTTPS pass', async () => {
    server.use(http.get('https://x.test/robots.txt', () => HttpResponse.text('User-agent: *\nAllow: /')))
    server.use(http.get('https://x.test/sitemap.xml', () => HttpResponse.text('<urlset/>')))
    const r = await technicalAnalyzer.run(ctx({ url: 'https://x.test/' }))
    const byId = Object.fromEntries(r.map((c) => [c.id, c]))
    expect(byId['technical.https'].status).toBe('pass')
    expect(byId['technical.robots.accessible'].status).toBe('pass')
    expect(byId['technical.sitemap.discoverable'].status).toBe('pass')
  })

  it('HTTP fail', async () => {
    server.use(http.get('http://x.test/robots.txt', () => HttpResponse.text('', { status: 404 })))
    server.use(http.get('http://x.test/sitemap.xml', () => HttpResponse.text('', { status: 404 })))
    const r = await technicalAnalyzer.run(ctx({ url: 'http://x.test/' }))
    const byId = Object.fromEntries(r.map((c) => [c.id, c]))
    expect(byId['technical.https'].status).toBe('fail')
  })

  it('robots Disallow: / → disallowed fail', async () => {
    server.use(http.get('https://x.test/robots.txt', () => HttpResponse.text('User-agent: *\nDisallow: /')))
    server.use(http.get('https://x.test/sitemap.xml', () => HttpResponse.text('', { status: 404 })))
    const r = await technicalAnalyzer.run(ctx({ url: 'https://x.test/secret' }))
    const byId = Object.fromEntries(r.map((c) => [c.id, c]))
    expect(byId['technical.robots.disallowed'].status).toBe('fail')
  })

  it('JSON-LD 존재', async () => {
    const html = `<html><head><title>x</title>
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"x"}</script>
    </head><body></body></html>`
    server.use(http.get('https://x.test/robots.txt', () => HttpResponse.text('User-agent: *')))
    server.use(http.get('https://x.test/sitemap.xml', () => HttpResponse.text('<urlset/>')))
    const r = await technicalAnalyzer.run(ctx({ url: 'https://x.test/', html }))
    const byId = Object.fromEntries(r.map((c) => [c.id, c]))
    expect(byId['technical.schema.jsonld'].status).toBe('pass')
  })

  it('x-robots-tag: noindex → fail', async () => {
    server.use(http.get('https://x.test/robots.txt', () => HttpResponse.text('User-agent: *')))
    server.use(http.get('https://x.test/sitemap.xml', () => HttpResponse.text('<urlset/>')))
    const r = await technicalAnalyzer.run(
      ctx({ url: 'https://x.test/', headers: { 'x-robots-tag': 'noindex, nofollow' } }),
    )
    const byId = Object.fromEntries(r.map((c) => [c.id, c]))
    expect(byId['technical.x_robots_tag.noindex'].status).toBe('fail')
  })
})
```

- [ ] **Step 2: 구현 (robots 파서 포함)**

`src/analyzers/technical.ts`:
```ts
import { fetchPage } from '@/lib/fetcher'
import type { Analyzer, CheckResult } from './types'

function parseRobots(text: string, ua = '*'): { disallows: string[]; sitemaps: string[] } {
  const disallows: string[] = []
  const sitemaps: string[] = []
  const lines = text.split(/\r?\n/).map((l) => l.replace(/#.*$/, '').trim()).filter(Boolean)
  let active = false
  for (const line of lines) {
    const m = line.match(/^([A-Za-z-]+):\s*(.*)$/)
    if (!m) continue
    const key = m[1].toLowerCase()
    const val = m[2].trim()
    if (key === 'sitemap') sitemaps.push(val)
    if (key === 'user-agent') active = val === '*' || val.toLowerCase() === ua.toLowerCase()
    if (active && key === 'disallow') disallows.push(val)
  }
  return { disallows, sitemaps }
}

function disallowed(path: string, rules: string[]): boolean {
  for (const r of rules) {
    if (!r) continue // 빈 Disallow 는 허용 의미
    if (path === r) return true
    if (r.endsWith('/') && path.startsWith(r)) return true
    if (path.startsWith(r)) return true
  }
  return false
}

export const technicalAnalyzer: Analyzer = {
  name: 'technical',
  async run(ctx): Promise<CheckResult[]> {
    const out: CheckResult[] = []
    const url = new URL(ctx.finalUrl)
    const httpsOk = url.protocol === 'https:'
    out.push({
      id: 'technical.https',
      category: 'technical',
      status: httpsOk ? 'pass' : 'fail',
      title: 'HTTPS',
      message: httpsOk ? 'HTTPS로 제공됩니다.' : 'HTTP로 제공됩니다. HTTPS로 전환해주세요.',
      fix: httpsOk ? undefined : 'TLS 인증서를 설치하고 모든 트래픽을 HTTPS로 리다이렉트해주세요.',
      weight: 4,
    })

    const robotsUrl = `${url.origin}/robots.txt`
    const robotsRes = await fetchPage(robotsUrl, { timeoutMs: 8_000 })
    let robotsParsed = { disallows: [] as string[], sitemaps: [] as string[] }
    const robotsOk = robotsRes.ok === true
    if (robotsOk) robotsParsed = parseRobots(robotsRes.body)
    out.push({
      id: 'technical.robots.accessible',
      category: 'technical',
      status: robotsOk ? 'pass' : 'warn',
      title: 'robots.txt 접근 가능',
      message: robotsOk ? 'robots.txt를 정상 조회했습니다.' : 'robots.txt를 가져올 수 없었습니다.',
      detail: { url: robotsUrl },
      fix: robotsOk ? undefined : '루트(/robots.txt)에 robots.txt 파일을 두는 게 좋습니다.',
      weight: 2,
    })

    const path = url.pathname || '/'
    const blocked = disallowed(path, robotsParsed.disallows)
    out.push({
      id: 'technical.robots.disallowed',
      category: 'technical',
      status: blocked ? 'fail' : 'pass',
      title: 'robots.txt 차단 여부',
      message: blocked
        ? '이 페이지가 robots.txt에 의해 차단되어 있어요. 검색 엔진이 못 봅니다.'
        : '검색 엔진이 접근할 수 있는 페이지입니다.',
      detail: { path, rules: robotsParsed.disallows },
      fix: blocked ? '해당 경로의 Disallow 규칙을 조정해주세요.' : undefined,
      weight: 4,
    })

    let sitemapOk = robotsParsed.sitemaps.length > 0
    if (!sitemapOk) {
      const sm = await fetchPage(`${url.origin}/sitemap.xml`, { timeoutMs: 8_000 })
      sitemapOk = sm.ok === true
    }
    out.push({
      id: 'technical.sitemap.discoverable',
      category: 'technical',
      status: sitemapOk ? 'pass' : 'warn',
      title: 'Sitemap 발견',
      message: sitemapOk ? 'sitemap을 찾았습니다.' : 'sitemap.xml을 찾지 못했습니다.',
      detail: { hintsFromRobots: robotsParsed.sitemaps },
      fix: sitemapOk ? undefined : '/sitemap.xml 을 제공하거나 robots.txt에 Sitemap: 라인을 추가하세요.',
      weight: 3,
    })

    const jsonldNodes = ctx.$('script[type="application/ld+json"]')
    let parsedOk = 0
    jsonldNodes.each((_, el) => {
      try { JSON.parse(ctx.$(el).text()); parsedOk++ } catch { /* invalid */ }
    })
    const schemaStatus = jsonldNodes.length === 0 ? 'warn' : parsedOk === jsonldNodes.length ? 'pass' : 'warn'
    out.push({
      id: 'technical.schema.jsonld',
      category: 'technical',
      status: schemaStatus,
      title: 'JSON-LD 구조화 데이터',
      message: jsonldNodes.length === 0
        ? 'JSON-LD가 없습니다. Article/Product 등 스키마를 넣으면 리치 결과 가능성이 생깁니다.'
        : `JSON-LD ${jsonldNodes.length}개 중 ${parsedOk}개 파싱 OK.`,
      detail: { total: jsonldNodes.length, parsedOk },
      fix: jsonldNodes.length === 0 ? '<script type="application/ld+json">{...}</script> 로 적절한 스키마를 추가하세요.' : undefined,
      weight: 3,
    })

    const xrt = ctx.responseHeaders.get('x-robots-tag') ?? ''
    const noindex = /noindex/i.test(xrt)
    out.push({
      id: 'technical.x_robots_tag.noindex',
      category: 'technical',
      status: noindex ? 'fail' : 'pass',
      title: 'X-Robots-Tag noindex',
      message: noindex
        ? `응답 헤더에 noindex가 있어 검색에 노출되지 않습니다. (${xrt})`
        : 'noindex가 설정되어 있지 않습니다.',
      detail: { value: xrt },
      fix: noindex ? '서버 응답에서 X-Robots-Tag: noindex 를 제거해주세요.' : undefined,
      weight: 3,
    })

    return out
  },
}
```

- [ ] **Step 3: 테스트 통과 확인**

Run: `npm test -- technical.test`
Expected: PASS.

- [ ] **Step 4: 커밋**

```bash
git add src/analyzers/technical.ts tests/unit/analyzers/technical.test.ts
git commit -m "feat(analyzers): technical analyzer (https, robots, sitemap, jsonld, x-robots-tag)"
```

---

## Task 8: Performance Analyzer (PSI API)

**Goal:** Google PageSpeed Insights v5 API를 호출해 LCP/INP/CLS/TBT 점수를 CheckResult로 변환.

**Files:**
- Create: `src/analyzers/performance.ts`
- Test: `tests/unit/analyzers/performance.test.ts`

**Interfaces:**
- Consumes: `env.PSI_API_KEY` (Task 1), `AnalyzeContext.normalizedUrl`
- Produces: `performanceAnalyzer: Analyzer`. 내부 helper `runPsi(url: string): Promise<PsiAudit>` 노출 (테스트 mock에 사용)

검사 항목:
- `performance.lcp` (Largest Contentful Paint)
- `performance.inp` (Interaction to Next Paint)
- `performance.cls` (Cumulative Layout Shift)
- `performance.tbt` (Total Blocking Time)

각 메트릭 PSI의 score를 기반으로 pass(≥0.9) / warn(≥0.5) / fail(<0.5).

부분 실패 처리:
- PSI API가 429 (quota) → 모든 항목 SKIP + 메시지 "PSI_QUOTA"
- 60초 타임아웃 → 모든 항목 SKIP + 메시지 "PSI_TIMEOUT"

- [ ] **Step 1: 테스트 작성 (PSI는 fetch mock)**

`tests/unit/analyzers/performance.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse, delay } from 'msw'
import { performanceAnalyzer } from '@/analyzers/performance'
import type { AnalyzeContext } from '@/analyzers/types'

vi.mock('@/lib/env', () => ({ env: { PSI_API_KEY: 'test-key' } }))

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const ctx: AnalyzeContext = {
  targetUrl: 'https://x.test/',
  normalizedUrl: 'https://x.test/',
  finalUrl: 'https://x.test/',
  html: '',
  // @ts-expect-error 사용 안 함
  $: null,
  responseHeaders: new Headers(),
  responseStatus: 200,
}

function psiResponse(scores: { lcp: number; inp: number; cls: number; tbt: number }) {
  return {
    lighthouseResult: {
      audits: {
        'largest-contentful-paint': { score: scores.lcp, displayValue: '2.5s' },
        'interaction-to-next-paint': { score: scores.inp, displayValue: '200ms' },
        'cumulative-layout-shift': { score: scores.cls, displayValue: '0.1' },
        'total-blocking-time': { score: scores.tbt, displayValue: '200ms' },
      },
    },
  }
}

describe('performanceAnalyzer', () => {
  it('좋은 점수: 모두 pass', async () => {
    server.use(http.get('https://www.googleapis.com/pagespeedonline/v5/runPagespeed', () =>
      HttpResponse.json(psiResponse({ lcp: 0.95, inp: 0.92, cls: 0.99, tbt: 0.95 })),
    ))
    const r = await performanceAnalyzer.run(ctx)
    expect(r.find((c) => c.id === 'performance.lcp')?.status).toBe('pass')
    expect(r.find((c) => c.id === 'performance.cls')?.status).toBe('pass')
  })

  it('낮은 점수: warn/fail', async () => {
    server.use(http.get('https://www.googleapis.com/pagespeedonline/v5/runPagespeed', () =>
      HttpResponse.json(psiResponse({ lcp: 0.3, inp: 0.6, cls: 0.45, tbt: 0.7 })),
    ))
    const r = await performanceAnalyzer.run(ctx)
    expect(r.find((c) => c.id === 'performance.lcp')?.status).toBe('fail')
    expect(r.find((c) => c.id === 'performance.inp')?.status).toBe('warn')
    expect(r.find((c) => c.id === 'performance.cls')?.status).toBe('fail')
  })

  it('429 quota → 모두 skip', async () => {
    server.use(http.get('https://www.googleapis.com/pagespeedonline/v5/runPagespeed', () =>
      HttpResponse.json({ error: { message: 'quota' } }, { status: 429 }),
    ))
    const r = await performanceAnalyzer.run(ctx)
    expect(r.every((c) => c.status === 'skip')).toBe(true)
    expect(r[0].detail).toMatchObject({ reason: 'PSI_QUOTA' })
  })

  it('타임아웃 → 모두 skip', async () => {
    server.use(http.get('https://www.googleapis.com/pagespeedonline/v5/runPagespeed', async () => {
      await delay(70_000)
      return HttpResponse.json({})
    }))
    const r = await performanceAnalyzer.run({ ...ctx } as AnalyzeContext)
    expect(r.every((c) => c.status === 'skip')).toBe(true)
    expect(r[0].detail).toMatchObject({ reason: 'PSI_TIMEOUT' })
  }, 65_000)
})
```

(마지막 테스트는 60초 대기가 있어 슬로우. 테스트에서는 timeout 값을 작게 만들 수 있게 옵션 제공.)

- [ ] **Step 2: 구현 (timeout override 옵션 포함)**

`src/analyzers/performance.ts`:
```ts
import { env } from '@/lib/env'
import type { Analyzer, CheckResult, CheckStatus } from './types'

const PSI_ENDPOINT = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'
const METRICS = [
  { id: 'performance.lcp', title: 'Largest Contentful Paint', auditKey: 'largest-contentful-paint', weight: 6 },
  { id: 'performance.inp', title: 'Interaction to Next Paint', auditKey: 'interaction-to-next-paint', weight: 6 },
  { id: 'performance.cls', title: 'Cumulative Layout Shift', auditKey: 'cumulative-layout-shift', weight: 6 },
  { id: 'performance.tbt', title: 'Total Blocking Time', auditKey: 'total-blocking-time', weight: 3 },
] as const

function scoreToStatus(score: number | null | undefined): CheckStatus {
  if (score == null) return 'skip'
  if (score >= 0.9) return 'pass'
  if (score >= 0.5) return 'warn'
  return 'fail'
}

function skipAll(reason: 'PSI_QUOTA' | 'PSI_TIMEOUT' | 'PSI_FAIL'): CheckResult[] {
  return METRICS.map((m) => ({
    id: m.id,
    category: 'performance' as const,
    status: 'skip' as const,
    title: m.title,
    message: reason === 'PSI_QUOTA'
      ? '오늘의 PSI 호출 한도를 초과해 성능 측정을 건너뛰었어요.'
      : reason === 'PSI_TIMEOUT'
      ? 'PSI 응답이 60초 안에 오지 않아 건너뛰었어요.'
      : '성능 측정 중 오류가 발생해 건너뛰었어요.',
    detail: { reason },
    weight: m.weight,
  }))
}

export const performanceAnalyzer: Analyzer & {
  runPsi: (url: string, timeoutMs?: number) => Promise<unknown>
} = {
  name: 'performance',
  async runPsi(url: string, timeoutMs = 60_000) {
    const u = new URL(PSI_ENDPOINT)
    u.searchParams.set('url', url)
    u.searchParams.set('strategy', 'mobile')
    u.searchParams.set('key', env.PSI_API_KEY)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(u, { signal: controller.signal })
      if (res.status === 429) throw new Error('PSI_QUOTA')
      if (!res.ok) throw new Error('PSI_FAIL')
      return await res.json()
    } finally {
      clearTimeout(timer)
    }
  },
  async run(ctx): Promise<CheckResult[]> {
    let data: any
    try {
      data = await performanceAnalyzer.runPsi(ctx.normalizedUrl)
    } catch (err) {
      const msg = (err as Error).message
      if (msg === 'PSI_QUOTA') return skipAll('PSI_QUOTA')
      if ((err as Error).name === 'AbortError') return skipAll('PSI_TIMEOUT')
      return skipAll('PSI_FAIL')
    }
    const audits = data?.lighthouseResult?.audits ?? {}
    return METRICS.map((m) => {
      const a = audits[m.auditKey]
      const score = a?.score
      const status = scoreToStatus(score)
      return {
        id: m.id,
        category: 'performance',
        status,
        title: m.title,
        message:
          status === 'skip' ? '측정값을 얻지 못했습니다.'
          : status === 'pass' ? `좋아요. (${a?.displayValue ?? ''})`
          : `개선이 필요합니다. (${a?.displayValue ?? ''})`,
        detail: { score, displayValue: a?.displayValue },
        docs: 'https://web.dev/articles/vitals',
        weight: m.weight,
      }
    })
  },
}
```

- [ ] **Step 3: 테스트 통과 확인**

Run: `npm test -- performance.test`
Expected: PASS.

- [ ] **Step 4: 커밋**

```bash
git add src/analyzers/performance.ts tests/unit/analyzers/performance.test.ts
git commit -m "feat(analyzers): performance analyzer via PSI v5"
```

---

## Task 9: Score 집계

**Goal:** CheckResult[] 를 받아 카테고리 점수 + 총점 계산.

**Files:**
- Create: `src/lib/score.ts`
- Test: `tests/unit/lib/score.test.ts`

**Interfaces:**
- Consumes: `CheckResult[]` (Task 5)
- Produces:
  - `aggregate(checks: CheckResult[]): { total: number; categories: Record<Category, number | null> }`
  - 카테고리 점수는 가중평균(`pass=1, warn=0.5, fail=0, skip=분모 제외`)을 100점 만점으로. 모두 skip이면 `null`.
  - 총점은 non-null 카테고리들의 단순 평균을 정수로 반올림.

- [ ] **Step 1: 테스트 작성**

`tests/unit/lib/score.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { aggregate } from '@/lib/score'
import type { CheckResult } from '@/analyzers/types'

function r(category: any, status: any, weight = 1): CheckResult {
  return { id: `${category}.x`, category, status, title: 't', message: 'm', weight }
}

describe('aggregate', () => {
  it('모든 카테고리 pass: 총점 100', () => {
    const checks: CheckResult[] = [
      r('meta', 'pass'), r('content', 'pass'),
      r('technical', 'pass'), r('performance', 'pass'),
    ]
    const a = aggregate(checks)
    expect(a.total).toBe(100)
    expect(a.categories).toEqual({ meta: 100, content: 100, technical: 100, performance: 100 })
  })
  it('warn은 50%로 반영', () => {
    const a = aggregate([r('meta', 'warn', 2), r('meta', 'pass', 2)])
    expect(a.categories.meta).toBe(75)
  })
  it('skip은 분모 제외', () => {
    const a = aggregate([r('meta', 'skip'), r('meta', 'pass')])
    expect(a.categories.meta).toBe(100)
  })
  it('카테고리 전체 skip이면 null', () => {
    const a = aggregate([r('performance', 'skip'), r('performance', 'skip'), r('meta', 'pass')])
    expect(a.categories.performance).toBeNull()
  })
  it('총점은 null 카테고리 제외', () => {
    const a = aggregate([r('performance', 'skip'), r('meta', 'pass'), r('content', 'fail')])
    // meta 100, content 0 → 평균 50
    expect(a.total).toBe(50)
  })
})
```

- [ ] **Step 2: 구현**

`src/lib/score.ts`:
```ts
import type { CheckResult, Category } from '@/analyzers/types'

const CATS: Category[] = ['meta', 'content', 'technical', 'performance']
const STATUS_VAL = { pass: 1, warn: 0.5, fail: 0, skip: NaN } as const

export function aggregate(checks: CheckResult[]): {
  total: number
  categories: Record<Category, number | null>
} {
  const categories = {} as Record<Category, number | null>
  for (const cat of CATS) {
    const items = checks.filter((c) => c.category === cat && c.status !== 'skip')
    if (items.length === 0) { categories[cat] = null; continue }
    const num = items.reduce((s, c) => s + STATUS_VAL[c.status] * c.weight, 0)
    const den = items.reduce((s, c) => s + c.weight, 0)
    categories[cat] = Math.round((num / den) * 100)
  }
  const present = CATS.map((c) => categories[c]).filter((v): v is number => v != null)
  const total = present.length === 0 ? 0 : Math.round(present.reduce((a, b) => a + b, 0) / present.length)
  return { total, categories }
}
```

- [ ] **Step 3: 테스트 통과**

Run: `npm test -- score.test`
Expected: PASS.

- [ ] **Step 4: 커밋**

```bash
git add src/lib/score.ts tests/unit/lib/score.test.ts
git commit -m "feat(lib): aggregate scores per category + total"
```

---

## Task 10: BullMQ 큐 + Worker (scan 잡)

**Goal:** Redis 기반 `scan` 큐 + worker entry. 검사 한 사이클을 worker에서 실행.

**Files:**
- Create: `src/lib/queue.ts`, `src/worker/index.ts`, `src/worker/scan.ts`
- Test: `tests/integration/worker.test.ts`

**Interfaces:**
- Consumes:
  - `env.REDIS_URL`
  - `fetchPage` (Task 4)
  - 4개 analyzer (Task 5~8)
  - `aggregate` (Task 9)
  - `prisma` (Task 3)
- Produces:
  - `scanQueue: Queue<ScanJobData>` — `ScanJobData = { publicId: string }`
  - `pdfQueue: Queue<PdfJobData>` — `PdfJobData = { publicId: string }` (실제 처리는 Task 17)
  - `redisConnection: IORedis` — 다른 모듈도 재사용
  - `progressKey(publicId): string`
  - Worker가 잡 처리 시: Scan 레코드 `RUNNING` → 검사 → 결과 저장 → `DONE` 또는 `FAILED`로 전이

- [ ] **Step 1: `src/lib/queue.ts` 작성**

```ts
import { Queue } from 'bullmq'
import IORedis from 'ioredis'
import { env } from './env'

export const redisConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
})

export type ScanJobData = { publicId: string }
export type PdfJobData = { publicId: string }

export const scanQueue = new Queue<ScanJobData>('scan', { connection: redisConnection })
export const pdfQueue = new Queue<PdfJobData>('pdf', { connection: redisConnection })

export const progressKey = (publicId: string) => `scan:progress:${publicId}`
```

- [ ] **Step 2: `src/worker/scan.ts` 작성**

```ts
import * as cheerio from 'cheerio'
import { prisma } from '@/lib/db'
import { fetchPage } from '@/lib/fetcher'
import { metaAnalyzer } from '@/analyzers/meta'
import { contentAnalyzer } from '@/analyzers/content'
import { technicalAnalyzer } from '@/analyzers/technical'
import { performanceAnalyzer } from '@/analyzers/performance'
import { aggregate } from '@/lib/score'
import { redisConnection, progressKey } from '@/lib/queue'
import type { AnalyzeContext, CheckResult } from '@/analyzers/types'

async function setProgress(publicId: string, p: number) {
  await redisConnection.set(progressKey(publicId), String(p), 'EX', 600)
}

export async function processScan(publicId: string): Promise<void> {
  const scan = await prisma.scan.findUnique({ where: { publicId } })
  if (!scan) throw new Error(`scan not found: ${publicId}`)

  await prisma.scan.update({
    where: { publicId },
    data: { status: 'RUNNING', startedAt: new Date() },
  })
  await setProgress(publicId, 0)

  const fetchRes = await fetchPage(scan.targetUrl, { timeoutMs: 15_000 })
  if (!fetchRes.ok) {
    await prisma.scan.update({
      where: { publicId },
      data: {
        status: 'FAILED',
        errorCode: fetchRes.code,
        errorMessage: messageFor(fetchRes.code, fetchRes.status),
        fetchStatus: fetchRes.status ?? null,
        completedAt: new Date(),
      },
    })
    await setProgress(publicId, 100)
    return
  }

  await setProgress(publicId, 10)

  const $ = cheerio.load(fetchRes.body)
  const ctx: AnalyzeContext = {
    targetUrl: scan.targetUrl,
    normalizedUrl: scan.normalizedUrl,
    finalUrl: fetchRes.finalUrl,
    html: fetchRes.body,
    $,
    responseHeaders: fetchRes.headers,
    responseStatus: fetchRes.status,
  }

  const [meta, content, technical] = await Promise.all([
    safe(metaAnalyzer.run(ctx)),
    safe(contentAnalyzer.run(ctx)),
    safe(technicalAnalyzer.run(ctx)),
  ])
  await setProgress(publicId, 50)
  const performance = await safe(performanceAnalyzer.run(ctx))
  await setProgress(publicId, 95)

  const checks: CheckResult[] = [...meta, ...content, ...technical, ...performance]
  const { total, categories } = aggregate(checks)

  await prisma.scan.update({
    where: { publicId },
    data: {
      status: 'DONE',
      fetchStatus: fetchRes.status,
      totalScore: total,
      categoryScores: categories,
      checks: checks as unknown as object,
      completedAt: new Date(),
    },
  })
  await setProgress(publicId, 100)
}

async function safe<T>(p: Promise<T[]>): Promise<T[]> {
  try { return await p } catch { return [] as T[] }
}

function messageFor(code: string, status?: number): string {
  switch (code) {
    case 'DNS_FAIL': return '도메인을 찾을 수 없어요'
    case 'CONN_FAIL': return '서버에 연결할 수 없었어요'
    case 'TIMEOUT': return '응답이 너무 느려요'
    case 'HTTP_4XX': return `페이지가 ${status ?? 4}xx를 반환했어요`
    case 'HTTP_5XX': return `서버 오류(${status ?? 5}xx)가 발생했어요`
    case 'PARSE_FAIL': return '페이지가 HTML이 아니거나 깨져 있어요'
    default: return '알 수 없는 오류가 발생했어요'
  }
}
```

- [ ] **Step 3: `src/worker/index.ts` 작성**

```ts
import { Worker } from 'bullmq'
import { redisConnection } from '@/lib/queue'
import { processScan } from './scan'

const scanWorker = new Worker(
  'scan',
  async (job) => {
    await processScan(job.data.publicId)
  },
  { connection: redisConnection, concurrency: 2 },
)

scanWorker.on('failed', (job, err) => {
  console.error(JSON.stringify({ level: 'error', queue: 'scan', jobId: job?.id, msg: err.message }))
})

console.log(JSON.stringify({ level: 'info', msg: 'worker started', queues: ['scan'] }))
```

- [ ] **Step 4: 통합 테스트 작성 (testcontainers)**

`tests/integration/worker.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import { processScan } from '@/worker/scan'
import { prisma } from '@/lib/db'
import { newPublicId } from '@/lib/id'

vi.mock('@/lib/env', () => ({
  env: {
    PSI_API_KEY: 'k',
    DATABASE_URL: process.env.DATABASE_URL!,
    REDIS_URL: process.env.REDIS_URL!,
    IP_HASH_SALT: 'salt',
    PUBLIC_BASE_URL: 'http://localhost',
    RATE_LIMIT_ALLOWLIST: '',
    NODE_ENV: 'test',
  },
}))

const server = setupServer(
  http.get('https://target.test/', () => new HttpResponse(
    `<html lang="ko"><head><title>좋은 제목입니다 충분히 길어요 약 30자</title>
    <meta name="description" content="설명입니다 충분히 길어요 약 50자 이상이 되도록 적습니다.">
    <link rel="canonical" href="https://target.test/">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta property="og:title" content="x"><meta property="og:description" content="x"><meta property="og:image" content="x">
    </head><body><h1>제목</h1><p>${'본문 '.repeat(100)}</p><a href="/x">내부</a></body></html>`,
    { status: 200, headers: { 'content-type': 'text/html' } },
  )),
  http.get('https://target.test/robots.txt', () => HttpResponse.text('User-agent: *\nAllow: /')),
  http.get('https://target.test/sitemap.xml', () => HttpResponse.text('<urlset/>')),
  http.get('https://www.googleapis.com/pagespeedonline/v5/runPagespeed', () => HttpResponse.json({
    lighthouseResult: { audits: {
      'largest-contentful-paint': { score: 0.95, displayValue: '2.4s' },
      'interaction-to-next-paint': { score: 0.95, displayValue: '180ms' },
      'cumulative-layout-shift': { score: 0.99, displayValue: '0.05' },
      'total-blocking-time': { score: 0.95, displayValue: '150ms' },
    }},
  })),
)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

describe('processScan', () => {
  it('end-to-end: PENDING → DONE with score', async () => {
    const publicId = newPublicId()
    await prisma.scan.create({
      data: {
        publicId,
        targetUrl: 'https://target.test/',
        normalizedUrl: 'https://target.test/',
      },
    })
    await processScan(publicId)
    const after = await prisma.scan.findUnique({ where: { publicId } })
    expect(after?.status).toBe('DONE')
    expect(after?.totalScore).toBeGreaterThanOrEqual(70)
    expect(Array.isArray(after?.checks)).toBe(true)
  })
})
```

- [ ] **Step 5: 테스트 실행**

Run: `npm test -- worker.test`
Expected: PASS (필요 시 `.env.test`에 DATABASE_URL/REDIS_URL을 ci.yml과 동일하게 설정).

- [ ] **Step 6: 커밋**

```bash
git add src/lib/queue.ts src/worker/ tests/integration/worker.test.ts
git commit -m "feat(worker): scan job pipeline (fetch → analyze × 4 → score → save)"
```

---

## Task 11: POST /api/scan + GET status

**Goal:** 검사 시작 API와 폴링용 status API. URL 유효성 검사·정규화·잡 enqueue. (Rate limit은 Task 12에서 별도로 추가)

**Files:**
- Create: `src/app/api/scan/route.ts`, `src/app/api/scan/[id]/status/route.ts`
- Test: `tests/integration/api-scan.test.ts`

**Interfaces:**
- Consumes:
  - `prisma`, `scanQueue`, `newPublicId`, `normalizeUrl`, `progressKey`, `redisConnection`
- Produces:
  - `POST /api/scan` body `{ url: string }` → `{ publicId, status }` (201) | `{ error }` (400)
  - `GET /api/scan/[id]/status` → `{ status, progress?, error? }` (200) | 404

- [ ] **Step 1: 테스트 작성**

`tests/integration/api-scan.test.ts`:
```ts
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { POST } from '@/app/api/scan/route'
import { GET as STATUS } from '@/app/api/scan/[id]/status/route'
import { prisma } from '@/lib/db'

vi.mock('@/lib/queue', async (orig) => {
  const real = await orig<typeof import('@/lib/queue')>()
  return {
    ...real,
    scanQueue: { add: vi.fn().mockResolvedValue({ id: 'job-1' }) },
  }
})

beforeAll(async () => { await prisma.scan.deleteMany() })

function req(body: object, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/scan', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

describe('POST /api/scan', () => {
  it('정상 URL → 201 + publicId', async () => {
    const res = await POST(req({ url: 'https://example.com/' }))
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.publicId).toMatch(/^[A-Za-z0-9_-]{10}$/)
    expect(json.status).toBe('PENDING')
  })

  it('잘못된 URL → 400', async () => {
    const res = await POST(req({ url: 'not-a-url' }))
    expect(res.status).toBe(400)
  })

  it('status 라우트가 PENDING 반환', async () => {
    const created = await POST(req({ url: 'https://other.test/' }))
    const { publicId } = await created.json()
    const res = await STATUS(new Request('http://localhost'), { params: Promise.resolve({ id: publicId }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('PENDING')
  })

  it('알 수 없는 publicId → 404', async () => {
    const res = await STATUS(new Request('http://localhost'), { params: Promise.resolve({ id: 'nonexistent' }) })
    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: 구현 — `src/app/api/scan/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { scanQueue } from '@/lib/queue'
import { newPublicId } from '@/lib/id'
import { normalizeUrl } from '@/lib/url'

const Body = z.object({ url: z.string().min(1) })

export async function POST(req: Request) {
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid json' }, { status: 400 }) }
  const parsed = Body.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'invalid body' }, { status: 400 })

  let normalized: string
  try { normalized = normalizeUrl(parsed.data.url) } catch { return NextResponse.json({ error: 'invalid url' }, { status: 400 }) }

  const publicId = newPublicId()
  await prisma.scan.create({
    data: {
      publicId,
      targetUrl: parsed.data.url,
      normalizedUrl: normalized,
    },
  })
  await scanQueue.add('scan', { publicId }, { removeOnComplete: 1000, removeOnFail: 5000 })

  return NextResponse.json({ publicId, status: 'PENDING' }, { status: 201 })
}
```

- [ ] **Step 3: 구현 — `src/app/api/scan/[id]/status/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { redisConnection, progressKey } from '@/lib/queue'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const scan = await prisma.scan.findUnique({
    where: { publicId: id },
    select: { status: true, errorMessage: true },
  })
  if (!scan) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const progressStr = await redisConnection.get(progressKey(id))
  const progress = progressStr ? Number(progressStr) : undefined
  return NextResponse.json({
    status: scan.status,
    progress,
    error: scan.errorMessage ?? undefined,
  })
}
```

- [ ] **Step 4: 테스트 통과**

Run: `npm test -- api-scan.test`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/app/api/scan tests/integration/api-scan.test.ts
git commit -m "feat(api): POST /api/scan + GET /api/scan/[id]/status"
```

---

## Task 12: Rate limit + IP hash

**Goal:** IP당 시간당 30회 제한. POST /api/scan에 적용. 화이트리스트 우회.

**Files:**
- Create: `src/lib/ratelimit.ts`, `src/lib/ipHash.ts`
- Modify: `src/app/api/scan/route.ts` (앞에 rate limit 체크 추가)
- Test: `tests/unit/lib/ratelimit.test.ts`

**Interfaces:**
- Consumes: `redisConnection`, `env.IP_HASH_SALT`, `env.RATE_LIMIT_ALLOWLIST`
- Produces:
  - `ipHash(ip: string): string` (`sha256(ip + salt)` hex)
  - `extractIp(req: Request): string` — `x-forwarded-for` 우선
  - `checkRateLimit(ip: string): Promise<{ allowed: boolean; remaining: number }>` — 시간별 카운터 INCR

- [ ] **Step 1: 구현 — `src/lib/ipHash.ts`**

```ts
import { createHash } from 'node:crypto'
import { env } from './env'

export function ipHash(ip: string): string {
  return createHash('sha256').update(ip + env.IP_HASH_SALT).digest('hex')
}

export function extractIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for') ?? ''
  const first = xff.split(',')[0]?.trim()
  return first || req.headers.get('x-real-ip') || 'unknown'
}
```

- [ ] **Step 2: 테스트 작성**

`tests/unit/lib/ratelimit.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('@/lib/env', () => ({
  env: { IP_HASH_SALT: 'salt', RATE_LIMIT_ALLOWLIST: '10.0.0.1', REDIS_URL: 'redis://localhost:6379/4' },
}))

import { checkRateLimit } from '@/lib/ratelimit'

describe('checkRateLimit', () => {
  it('초과 전엔 allowed=true', async () => {
    const r = await checkRateLimit('hash-' + Date.now())
    expect(r.allowed).toBe(true)
  })
  it('30회 초과 시 거부', async () => {
    const ip = 'hashLimit-' + Date.now()
    for (let i = 0; i < 30; i++) await checkRateLimit(ip)
    const r = await checkRateLimit(ip)
    expect(r.allowed).toBe(false)
  })
})
```

- [ ] **Step 3: 구현 — `src/lib/ratelimit.ts`**

```ts
import { redisConnection } from './queue'
import { env } from './env'

const LIMIT = 30
const WINDOW_SEC = 3600

const allowlist = new Set(
  env.RATE_LIMIT_ALLOWLIST.split(',').map((s) => s.trim()).filter(Boolean),
)

export async function checkRateLimit(ipHashOrIp: string): Promise<{ allowed: boolean; remaining: number }> {
  if (allowlist.has(ipHashOrIp)) return { allowed: true, remaining: LIMIT }
  const hour = new Date().toISOString().slice(0, 13)
  const key = `ratelimit:${ipHashOrIp}:${hour}`
  const n = await redisConnection.incr(key)
  if (n === 1) await redisConnection.expire(key, WINDOW_SEC)
  return { allowed: n <= LIMIT, remaining: Math.max(0, LIMIT - n) }
}
```

(allowlist는 hash가 아닌 평문 IP와도 매치되도록 호출 측에서 평문 IP를 먼저 확인하게 한다.)

- [ ] **Step 4: 테스트 통과**

Run: `npm test -- ratelimit.test`
Expected: PASS.

- [ ] **Step 5: `POST /api/scan`에 적용**

`src/app/api/scan/route.ts` 의 POST 함수 시작 직후:
```ts
import { extractIp, ipHash } from '@/lib/ipHash'
import { checkRateLimit } from '@/lib/ratelimit'

// POST 함수 안, body 파싱 직전에:
const ip = extractIp(req)
const allowKey = allowlistContains(ip) ? ip : ipHash(ip)
const rl = await checkRateLimit(allowKey)
if (!rl.allowed) {
  return NextResponse.json({ error: '잠시 후 다시 시도해주세요.' }, { status: 429 })
}
```

`allowlistContains`는 `ratelimit.ts`에서 helper export:
```ts
export function allowlistContains(ip: string) { return allowlist.has(ip) }
```

또한 Scan 레코드 생성 시 `ipHash`, `userAgent` 채우기:
```ts
await prisma.scan.create({
  data: {
    publicId,
    targetUrl: parsed.data.url,
    normalizedUrl: normalized,
    ipHash: ipHash(ip),
    userAgent: req.headers.get('user-agent') ?? undefined,
  },
})
```

- [ ] **Step 6: 커밋**

```bash
git add src/lib/ratelimit.ts src/lib/ipHash.ts src/app/api/scan/route.ts tests/unit/lib/ratelimit.test.ts
git commit -m "feat(api): rate limit (IP/hour) + ip hashing"
```

---

## Task 13: GET /api/health

**Goal:** deploy.sh가 호출하는 헬스체크. DB ping + Redis ping + worker heartbeat 체크.

**Files:**
- Create: `src/app/api/health/route.ts`
- Modify: `src/worker/index.ts` (heartbeat 갱신 추가)
- Test: `tests/integration/health.test.ts`

**Interfaces:**
- Consumes: `prisma`, `redisConnection`
- Produces: `GET /api/health` → 200/`{ ok: true, ... }` or 503

- [ ] **Step 1: worker heartbeat 추가**

`src/worker/index.ts`의 끝에:
```ts
import { redisConnection } from '@/lib/queue'

setInterval(async () => {
  await redisConnection.set('worker:heartbeat', new Date().toISOString(), 'EX', 30)
}, 5_000)
```

(워커 시작 직후 한 번 즉시 실행도 추가:)
```ts
redisConnection.set('worker:heartbeat', new Date().toISOString(), 'EX', 30)
```

- [ ] **Step 2: 구현 — `src/app/api/health/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { redisConnection } from '@/lib/queue'

export async function GET() {
  const checks: Record<string, unknown> = {}
  let ok = true

  try { await prisma.$queryRaw`SELECT 1`; checks.db = 'ok' }
  catch (e) { checks.db = (e as Error).message; ok = false }

  try { await redisConnection.ping(); checks.redis = 'ok' }
  catch (e) { checks.redis = (e as Error).message; ok = false }

  const hb = await redisConnection.get('worker:heartbeat').catch(() => null)
  const hbAge = hb ? (Date.now() - Date.parse(hb)) / 1000 : null
  const workerOk = hbAge != null && hbAge < 30
  checks.worker = { active: workerOk, lastHeartbeat: hb }
  if (!workerOk) ok = false

  const today = new Date().toISOString().slice(0, 10)
  const [scanDone, scanFailed, psiUsed] = await Promise.all([
    redisConnection.get(`metric:scan:done:${today}`).catch(() => null),
    redisConnection.get(`metric:scan:failed:${today}`).catch(() => null),
    redisConnection.get(`metric:psi:quota_used:${today}`).catch(() => null),
  ])

  return NextResponse.json(
    {
      ok,
      checks,
      metrics: {
        scanDoneToday: Number(scanDone ?? 0),
        scanFailedToday: Number(scanFailed ?? 0),
        psiQuotaUsedToday: Number(psiUsed ?? 0),
      },
    },
    { status: ok ? 200 : 503 },
  )
}
```

- [ ] **Step 3: scan worker에 metric 증가 추가**

`src/worker/scan.ts` 의 DONE 전이 직후:
```ts
import { redisConnection } from '@/lib/queue'
const today = new Date().toISOString().slice(0, 10)
await redisConnection.incr(`metric:scan:done:${today}`)
await redisConnection.expire(`metric:scan:done:${today}`, 60 * 60 * 36)
```

FAILED 전이 직후도 동일하게 `metric:scan:failed:${today}`.

PSI 호출 후(performance.ts 안의 runPsi 정상 응답 직후) `metric:psi:quota_used:${today}` 증가.

- [ ] **Step 4: 테스트 작성**

`tests/integration/health.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { GET } from '@/app/api/health/route'
import { redisConnection } from '@/lib/queue'

describe('GET /api/health', () => {
  it('worker heartbeat 살아있을 때 ok', async () => {
    await redisConnection.set('worker:heartbeat', new Date().toISOString(), 'EX', 30)
    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.checks.worker.active).toBe(true)
  })
  it('worker heartbeat 없을 때 503', async () => {
    await redisConnection.del('worker:heartbeat')
    const res = await GET()
    expect(res.status).toBe(503)
  })
})
```

- [ ] **Step 5: 테스트 통과**

Run: `npm test -- health.test`
Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/app/api/health src/worker/index.ts src/worker/scan.ts tests/integration/health.test.ts
git commit -m "feat(api): /api/health + worker heartbeat + daily metrics"
```

---

## Task 14: 홈 페이지 UI

**Goal:** URL 입력 → POST /api/scan → 결과 페이지로 이동. localStorage 기반 최근 이력 표시. 4개 카테고리 카드.

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/components/UrlForm.tsx`, `src/components/RecentScans.tsx`, `src/components/CategoryCards.tsx`, `src/components/ThemeToggle.tsx`
- Create: `src/lib/clientHistory.ts` (localStorage 헬퍼)

**Interfaces:**
- Consumes: 위 API
- Produces: 홈 페이지

- [ ] **Step 1: `src/lib/clientHistory.ts`**

```ts
'use client'
const KEY = 'crawl-lens:history'
const MAX = 20

export type HistoryItem = {
  publicId: string
  targetUrl: string
  totalScore?: number
  createdAt: string
}

export function getHistory(): HistoryItem[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

export function addHistory(item: HistoryItem) {
  if (typeof window === 'undefined') return
  const cur = getHistory().filter((i) => i.publicId !== item.publicId)
  const next = [item, ...cur].slice(0, MAX)
  localStorage.setItem(KEY, JSON.stringify(next))
}
```

- [ ] **Step 2: `src/components/UrlForm.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { addHistory } from '@/lib/clientHistory'

export function UrlForm() {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    let target = url.trim()
    if (!target) return
    if (!/^https?:\/\//i.test(target)) target = `https://${target}`
    setBusy(true)
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: target }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error ?? '검사를 시작할 수 없었어요.')
        setBusy(false)
        return
      }
      const { publicId } = await res.json()
      addHistory({ publicId, targetUrl: target, createdAt: new Date().toISOString() })
      router.push(`/r/${publicId}`)
    } catch {
      setError('네트워크 오류')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex gap-2 w-full max-w-2xl">
      <Input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://example.com/blog/post"
        className="flex-1 text-lg h-12"
        disabled={busy}
      />
      <Button type="submit" disabled={busy} className="h-12 px-6">
        {busy ? '시작 중…' : '검사 시작'}
      </Button>
      {error && <p className="text-red-600 text-sm">{error}</p>}
    </form>
  )
}
```

- [ ] **Step 3: `src/components/RecentScans.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getHistory, type HistoryItem } from '@/lib/clientHistory'

export function RecentScans() {
  const [items, setItems] = useState<HistoryItem[]>([])
  useEffect(() => { setItems(getHistory()) }, [])
  if (items.length === 0) return null
  return (
    <section className="mt-12 w-full max-w-2xl">
      <h2 className="text-sm text-muted-foreground mb-2">최근 검사 (이 브라우저)</h2>
      <ul className="space-y-1">
        {items.map((i) => (
          <li key={i.publicId} className="flex justify-between text-sm">
            <Link href={`/r/${i.publicId}`} className="truncate hover:underline">{i.targetUrl}</Link>
            <span className="text-muted-foreground tabular-nums">
              {i.totalScore != null ? `${i.totalScore}점` : '대기'}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
```

- [ ] **Step 4: `src/components/CategoryCards.tsx`**

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const cats = [
  { title: '메타', body: 'title · description · canonical · OG · Twitter Card · viewport · lang' },
  { title: '콘텐츠', body: 'h1 · 헤딩 계층 · alt 비율 · 워드카운트 · 내부/외부 링크' },
  { title: '기술', body: 'HTTPS · robots.txt · sitemap · JSON-LD · X-Robots-Tag' },
  { title: '성능', body: 'LCP · INP · CLS · TBT (Google PageSpeed Insights)' },
]

export function CategoryCards() {
  return (
    <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-4xl">
      {cats.map((c) => (
        <Card key={c.title}>
          <CardHeader><CardTitle className="text-base">{c.title}</CardTitle></CardHeader>
          <CardContent className="text-xs text-muted-foreground">{c.body}</CardContent>
        </Card>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: `src/app/page.tsx`**

```tsx
import { UrlForm } from '@/components/UrlForm'
import { RecentScans } from '@/components/RecentScans'
import { CategoryCards } from '@/components/CategoryCards'

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center px-6 py-16">
      <header className="text-center mb-10">
        <h1 className="text-4xl font-bold tracking-tight">crawl-lens</h1>
        <p className="mt-3 text-muted-foreground">
          내 사이트가 검색에 잘 노출되는지 30초 안에 알아보세요.
        </p>
      </header>
      <UrlForm />
      <CategoryCards />
      <RecentScans />
    </main>
  )
}
```

- [ ] **Step 6: 빌드 확인**

Run: `npm run build`
Expected: 빌드 성공.

- [ ] **Step 7: 커밋**

```bash
git add src/app/page.tsx src/components/ src/lib/clientHistory.ts
git commit -m "feat(ui): home page with URL form + recent history + category cards"
```

---

## Task 15: 결과 페이지 (진행/완료/실패)

**Goal:** `/r/[id]` 에서 status에 따라 분기. 폴링 → 결과 표시 (총점, 카테고리 점수, 카테고리별 아코디언, 필터 칩, 액션 버튼). localStorage 점수 갱신.

**Files:**
- Create: `src/app/r/[id]/page.tsx` (Server Component — 초기 데이터 fetch)
- Create: `src/app/r/[id]/ResultClient.tsx` (Client Component — 폴링 + 렌더)
- Create: `src/components/result/ScoreHero.tsx`, `src/components/result/CheckList.tsx`, `src/components/result/ProgressView.tsx`, `src/components/result/FailureView.tsx`, `src/components/result/Actions.tsx`

**Interfaces:**
- Consumes: `prisma`, `GET /api/scan/[id]/status`
- Produces: 결과 페이지

- [ ] **Step 1: 서버 컴포넌트 (`page.tsx`)**

```tsx
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { ResultClient } from './ResultClient'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const scan = await prisma.scan.findUnique({ where: { publicId: id } })
  if (!scan) notFound()
  return <ResultClient initial={JSON.parse(JSON.stringify(scan))} />
}
```

- [ ] **Step 2: `ResultClient.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { ProgressView } from '@/components/result/ProgressView'
import { FailureView } from '@/components/result/FailureView'
import { ScoreHero } from '@/components/result/ScoreHero'
import { CheckList } from '@/components/result/CheckList'
import { Actions } from '@/components/result/Actions'
import { addHistory } from '@/lib/clientHistory'

type Scan = {
  publicId: string
  targetUrl: string
  normalizedUrl: string
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED'
  errorCode?: string | null
  errorMessage?: string | null
  totalScore?: number | null
  categoryScores?: Record<string, number | null> | null
  checks?: Array<any> | null
  createdAt: string
  completedAt?: string | null
}

export function ResultClient({ initial }: { initial: Scan }) {
  const [scan, setScan] = useState<Scan>(initial)
  const [progress, setProgress] = useState<number>(0)

  useEffect(() => {
    if (scan.status === 'DONE' || scan.status === 'FAILED') {
      if (scan.status === 'DONE' && scan.totalScore != null) {
        addHistory({
          publicId: scan.publicId,
          targetUrl: scan.targetUrl,
          totalScore: scan.totalScore,
          createdAt: scan.createdAt,
        })
      }
      return
    }
    let cancelled = false
    let interval = 1_000
    let tries = 0
    async function tick() {
      if (cancelled) return
      try {
        const res = await fetch(`/api/scan/${scan.publicId}/status`)
        if (res.ok) {
          const j = await res.json()
          setProgress(j.progress ?? 0)
          if (j.status === 'DONE' || j.status === 'FAILED') {
            const full = await fetch(`/r/${scan.publicId}.json`).then((r) => r.json())
            setScan(full)
            return
          }
        }
      } catch { /* ignore */ }
      tries++
      if (tries > 30 && interval === 1_000) interval = 2_000
      if (tries > 60 && interval === 2_000) interval = 5_000
      setTimeout(tick, interval)
    }
    tick()
    return () => { cancelled = true }
  }, [scan.publicId, scan.status])

  return (
    <main className="min-h-screen flex flex-col items-center px-6 py-10">
      <div className="w-full max-w-3xl">
        <Actions publicId={scan.publicId} status={scan.status} />
        {(scan.status === 'PENDING' || scan.status === 'RUNNING') && (
          <ProgressView targetUrl={scan.targetUrl} progress={progress} />
        )}
        {scan.status === 'FAILED' && (
          <FailureView targetUrl={scan.targetUrl} errorCode={scan.errorCode ?? ''} errorMessage={scan.errorMessage ?? ''} />
        )}
        {scan.status === 'DONE' && (
          <>
            <ScoreHero
              targetUrl={scan.targetUrl}
              completedAt={scan.completedAt ?? scan.createdAt}
              total={scan.totalScore ?? 0}
              categories={scan.categoryScores ?? {}}
            />
            <CheckList checks={scan.checks ?? []} />
          </>
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 3: `ProgressView.tsx`**

```tsx
export function ProgressView({ targetUrl, progress }: { targetUrl: string; progress: number }) {
  return (
    <section className="mt-6">
      <p className="text-sm text-muted-foreground">검사 중…</p>
      <p className="font-mono text-sm break-all mt-1">{targetUrl}</p>
      <div className="mt-6 h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
      <ul className="mt-6 text-sm space-y-1">
        <li>{progress >= 10 ? '✓' : '⟳'} 페이지 가져오기</li>
        <li>{progress >= 50 ? '✓' : progress >= 10 ? '⟳' : '·'} 메타 / 콘텐츠 / 기술 검사</li>
        <li>{progress >= 95 ? '✓' : progress >= 50 ? '⟳' : '·'} 성능 측정 (Google PSI · 보통 20~40초)</li>
      </ul>
    </section>
  )
}
```

- [ ] **Step 4: `FailureView.tsx`**

```tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function FailureView({ targetUrl, errorCode, errorMessage }: { targetUrl: string; errorCode: string; errorMessage: string }) {
  return (
    <section className="mt-10 text-center">
      <h2 className="text-2xl font-semibold">이 URL을 검사할 수 없었어요</h2>
      <p className="font-mono text-sm break-all mt-3">{targetUrl}</p>
      <p className="mt-4 text-muted-foreground">사유: {errorMessage || errorCode || '알 수 없음'}</p>
      <ul className="mt-6 text-left max-w-md mx-auto text-sm text-muted-foreground space-y-1">
        <li>· URL 오타가 없는지</li>
        <li>· 페이지가 공개되어 있는지 (로그인 필요 X)</li>
        <li>· robots.txt가 차단하지 않는지</li>
      </ul>
      <div className="mt-6 flex justify-center gap-3">
        <Button asChild variant="secondary"><Link href="/">홈으로</Link></Button>
      </div>
    </section>
  )
}
```

- [ ] **Step 5: `ScoreHero.tsx`**

```tsx
const CAT_LABEL: Record<string, string> = { meta: '메타', content: '콘텐츠', technical: '기술', performance: '성능' }

export function ScoreHero({ targetUrl, completedAt, total, categories }: {
  targetUrl: string; completedAt: string; total: number; categories: Record<string, number | null>
}) {
  return (
    <section className="mt-6 flex flex-col sm:flex-row gap-6 items-center">
      <div className="w-28 h-28 rounded-full bg-primary text-primary-foreground flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tabular-nums">{total}</span>
        <span className="text-xs opacity-80">/100</span>
      </div>
      <div className="flex-1">
        <p className="text-sm font-mono break-all">{targetUrl}</p>
        <p className="text-xs text-muted-foreground mt-1">검사 시각: {new Date(completedAt).toLocaleString('ko-KR')}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          {Object.keys(CAT_LABEL).map((k) => (
            <span key={k} className="px-2 py-1 rounded bg-muted tabular-nums">
              {CAT_LABEL[k]} {categories[k] ?? '—'}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 6: `CheckList.tsx`**

```tsx
'use client'
import { useState, useMemo } from 'react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'

type Check = {
  id: string; category: string; status: 'pass' | 'warn' | 'fail' | 'skip'
  title: string; message: string; detail?: any; fix?: string; docs?: string
}

const CAT_ORDER = ['meta', 'content', 'technical', 'performance'] as const
const CAT_LABEL: Record<string, string> = { meta: '메타데이터', content: '콘텐츠 구조', technical: '기술적 SEO', performance: '성능' }
const ICON: Record<string, string> = { pass: '✓', warn: '⚠', fail: '✗', skip: '−' }
const COLOR: Record<string, string> = {
  pass: 'text-emerald-600', warn: 'text-amber-600', fail: 'text-red-600', skip: 'text-muted-foreground',
}

export function CheckList({ checks }: { checks: Check[] }) {
  const [filter, setFilter] = useState<'all' | 'pass' | 'warn' | 'fail'>('all')

  const filtered = useMemo(() => filter === 'all' ? checks : checks.filter((c) => c.status === filter), [checks, filter])
  const grouped = useMemo(() => {
    const m = new Map<string, Check[]>()
    for (const c of filtered) {
      if (!m.has(c.category)) m.set(c.category, [])
      m.get(c.category)!.push(c)
    }
    return m
  }, [filtered])

  const counts = useMemo(() => {
    const c = { pass: 0, warn: 0, fail: 0 }
    for (const x of checks) if (x.status in c) (c as any)[x.status]++
    return c
  }, [checks])

  return (
    <section className="mt-8">
      <div className="flex gap-2 mb-4">
        {(['all', 'pass', 'warn', 'fail'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`text-sm px-3 py-1 rounded border ${filter === k ? 'bg-primary text-primary-foreground' : ''}`}
          >
            {k === 'all' ? `전체 ${checks.length}` : k === 'pass' ? `통과 ${counts.pass}` : k === 'warn' ? `경고 ${counts.warn}` : `실패 ${counts.fail}`}
          </button>
        ))}
      </div>

      {CAT_ORDER.map((cat) => {
        const items = grouped.get(cat) ?? []
        if (items.length === 0) return null
        const hasIssue = items.some((c) => c.status === 'warn' || c.status === 'fail')
        return (
          <Accordion key={cat} type="single" collapsible defaultValue={hasIssue ? cat : undefined} className="mb-4 border rounded">
            <AccordionItem value={cat}>
              <AccordionTrigger className="px-4">{CAT_LABEL[cat]} ({items.length})</AccordionTrigger>
              <AccordionContent className="px-4">
                <ul className="space-y-2">
                  {items.map((c) => (
                    <li key={c.id} className="border-b py-2 last:border-b-0">
                      <div className="flex items-start gap-2">
                        <span className={`${COLOR[c.status]} mt-0.5`}>{ICON[c.status]}</span>
                        <div className="flex-1">
                          <p className="font-medium">{c.title}</p>
                          <p className="text-sm text-muted-foreground mt-1">{c.message}</p>
                          {(c.fix || c.docs || c.detail) && (
                            <details className="mt-2 text-sm">
                              <summary className="cursor-pointer text-xs text-primary">자세히</summary>
                              {c.detail && (
                                <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto">{JSON.stringify(c.detail, null, 2)}</pre>
                              )}
                              {c.fix && <p className="mt-2"><strong>권장 조치:</strong> {c.fix}</p>}
                              {c.docs && <p className="mt-1"><a href={c.docs} target="_blank" rel="noopener" className="text-primary hover:underline">관련 문서</a></p>}
                            </details>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )
      })}
    </section>
  )
}
```

- [ ] **Step 7: `Actions.tsx`**

```tsx
'use client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function Actions({ publicId, status }: { publicId: string; status: string }) {
  const done = status === 'DONE'
  const copy = async () => {
    await navigator.clipboard.writeText(window.location.href)
  }
  return (
    <div className="flex flex-wrap gap-2 items-center justify-between">
      <Button asChild variant="secondary" size="sm"><Link href="/">← 새 검사</Link></Button>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={copy}>URL 복사</Button>
        {done && <Button asChild size="sm" variant="outline"><a href={`/r/${publicId}/pdf`}>PDF</a></Button>}
        {done && <Button asChild size="sm" variant="outline"><a href={`/r/${publicId}.json`}>JSON</a></Button>}
      </div>
    </div>
  )
}
```

- [ ] **Step 8: 빌드 + 로컬 확인**

Run:
```bash
npm run build
npm run dev
```

브라우저: `http://localhost:4500` → URL 입력 → `/r/<id>` 로 이동 → 결과 표시.

- [ ] **Step 9: 커밋**

```bash
git add src/app/r src/components/result
git commit -m "feat(ui): result page (progress/done/failed) with accordion + filter chips"
```

---

## Task 16: JSON 응답 (`/r/[id].json` + Accept negotiation)

**Goal:** 같은 publicId에 대해 JSON으로도 결과를 제공. CI에서 fetch 가능하도록.

**Files:**
- Create: `src/app/r/[id].json/route.ts` (점이 들어간 동적 라우트는 Next.js 15에서 디렉토리명에 점 그대로 사용 가능)
- Modify: 위 라우트로 충분 — Accept negotiation은 v1에서 단순화 위해 미구현, `/r/[id].json` 만 제공
- Test: `tests/integration/result-json.test.ts`

**Interfaces:**
- Consumes: `prisma`
- Produces: `GET /r/[id].json` → 결과 JSON

설계 노트: Next.js에서 `r/[id].json` 디렉토리 이름은 동적 세그먼트로 인식되지 않을 수 있다. 대신 `/r/[id]/json/route.ts` (path: `/r/abc/json`) 또는 `/api/r/[id]/route.ts`로 가는 게 안전. **결정: `/api/r/[id]/route.ts` 추가 + 결과 페이지의 "JSON" 버튼은 그 경로로**. (사용자에게 노출되는 URL이 `/r/[id].json`이어야 한다면 별도 rewrite 추가 가능하지만 v1 단순화)

수정사항:
- 디자인 문서의 `/r/[id].json`은 구현 편의를 위해 **`/api/r/[id]`로 변경**. 사용자 UI 버튼도 그 경로를 가리킴.
- 디자인 문서 자체도 이 변경 반영 (구현 후 별도 커밋으로 반영).

- [ ] **Step 1: 라우트 작성 — `src/app/api/r/[id]/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const scan = await prisma.scan.findUnique({ where: { publicId: id } })
  if (!scan) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({
    publicId: scan.publicId,
    targetUrl: scan.targetUrl,
    normalizedUrl: scan.normalizedUrl,
    status: scan.status,
    errorCode: scan.errorCode,
    errorMessage: scan.errorMessage,
    fetchStatus: scan.fetchStatus,
    totalScore: scan.totalScore,
    categoryScores: scan.categoryScores,
    checks: scan.checks,
    createdAt: scan.createdAt,
    completedAt: scan.completedAt,
  })
}
```

- [ ] **Step 2: 결과 페이지의 JSON 버튼과 ResultClient 폴링 fetch 경로 갱신**

`src/components/result/Actions.tsx`:
```tsx
{done && <Button asChild size="sm" variant="outline"><a href={`/api/r/${publicId}`}>JSON</a></Button>}
```

`src/app/r/[id]/ResultClient.tsx`:
```ts
const full = await fetch(`/api/r/${scan.publicId}`).then((r) => r.json())
```

- [ ] **Step 3: 테스트**

`tests/integration/result-json.test.ts`:
```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { GET } from '@/app/api/r/[id]/route'
import { prisma } from '@/lib/db'

beforeAll(async () => { await prisma.scan.deleteMany() })

describe('GET /api/r/[id]', () => {
  it('존재 → 200', async () => {
    const s = await prisma.scan.create({
      data: { publicId: 'json-test-1', targetUrl: 'https://x.test/', normalizedUrl: 'https://x.test/' },
    })
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: s.publicId }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.publicId).toBe(s.publicId)
  })
  it('없음 → 404', async () => {
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'missing' }) })
    expect(res.status).toBe(404)
  })
})
```

Run: `npm test -- result-json.test`
Expected: PASS.

- [ ] **Step 4: 디자인 문서 path 변경 메모 추가 + 커밋**

```bash
git add src/app/api/r src/components/result/Actions.tsx src/app/r/[id]/ResultClient.tsx tests/integration/result-json.test.ts
git commit -m "feat(api): GET /api/r/[id] JSON output (replaces /r/[id].json)"
```

---

## Task 17: PDF — pdf 워커 + 라우트 (long-polling)

**Goal:** PDF 요청 시 캐시 있으면 즉시, 없으면 `pdf` 큐 enqueue 후 워커 완료까지 최대 60초 대기.

**Files:**
- Create: `src/worker/pdf.ts`, `src/app/r/[id]/pdf/route.ts`
- Modify: `src/worker/index.ts` (pdf worker 등록)
- Modify: `src/app/globals.css` (print 스타일)
- Test: `tests/integration/pdf.test.ts` (Chromium은 mock으로 — 캐시 파일 시뮬레이션)

**Interfaces:**
- Consumes: `pdfQueue`, `prisma`, `puppeteer-core`, `@sparticuz/chromium`
- Produces:
  - Worker가 처리: `/data/pdf/{publicId}.pdf` 파일 생성
  - 라우트: 캐시 hit → 즉시 PDF / miss → enqueue + `waitUntilFinished(60s)`

- [ ] **Step 1: 캐시 디렉토리 결정**

환경변수로 분리: `.env.example`에 추가:
```bash
PDF_CACHE_DIR=/tmp/crawl-lens-pdf
```

`src/lib/env.ts`의 schema에 추가:
```ts
PDF_CACHE_DIR: z.string().default('/tmp/crawl-lens-pdf'),
```

운영(.env): `/data/pdf` (compose에서 호스트 `/opt/stack/data/crawl-lens/pdf` 마운트).

- [ ] **Step 2: `src/worker/pdf.ts`**

```ts
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'
import { env } from '@/lib/env'

export async function processPdf(publicId: string): Promise<string> {
  await mkdir(env.PDF_CACHE_DIR, { recursive: true })
  const out = join(env.PDF_CACHE_DIR, `${publicId}.pdf`)
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  })
  try {
    const page = await browser.newPage()
    await page.emulateMediaType('print')
    await page.goto(`${env.PUBLIC_BASE_URL}/r/${publicId}?print=1`, { waitUntil: 'networkidle0', timeout: 60_000 })
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' } })
    await writeFile(out, pdf)
    return out
  } finally {
    await browser.close()
  }
}
```

- [ ] **Step 3: worker index에 pdf 등록**

`src/worker/index.ts` 추가:
```ts
import { processPdf } from './pdf'

const pdfWorker = new Worker(
  'pdf',
  async (job) => { await processPdf(job.data.publicId) },
  { connection: redisConnection, concurrency: 1 },
)

pdfWorker.on('failed', (job, err) => {
  console.error(JSON.stringify({ level: 'error', queue: 'pdf', jobId: job?.id, msg: err.message }))
})
```

- [ ] **Step 4: 라우트 `src/app/r/[id]/pdf/route.ts`**

```ts
import { stat, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { pdfQueue } from '@/lib/queue'
import { env } from '@/lib/env'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const file = join(env.PDF_CACHE_DIR, `${id}.pdf`)

  const cached = await stat(file).catch(() => null)
  if (cached) return streamPdf(file)

  const scan = await prisma.scan.findUnique({ where: { publicId: id }, select: { status: true } })
  if (!scan) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (scan.status !== 'DONE') return NextResponse.json({ error: 'scan not completed' }, { status: 409 })

  const job = await pdfQueue.add('pdf', { publicId: id }, { removeOnComplete: 100, removeOnFail: 100 })
  try {
    await job.waitUntilFinished(/* QueueEvents 인스턴스 필요 */ undefined as any, 60_000)
  } catch {
    return NextResponse.json({ error: 'pdf generation timeout' }, { status: 504 })
  }
  return streamPdf(file)
}

async function streamPdf(file: string) {
  const buf = await readFile(file)
  return new Response(buf, {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'cache-control': 'public, max-age=31536000, immutable',
      'content-disposition': `inline; filename="crawl-lens-${Date.now()}.pdf"`,
    },
  })
}
```

Note: `waitUntilFinished`는 BullMQ `QueueEvents` 인스턴스가 필요. `lib/queue.ts`에 추가:
```ts
import { QueueEvents } from 'bullmq'
export const pdfQueueEvents = new QueueEvents('pdf', { connection: redisConnection })
```

라우트에서 `import { pdfQueueEvents } from '@/lib/queue'` 후 `await job.waitUntilFinished(pdfQueueEvents, 60_000)`.

- [ ] **Step 5: print CSS — `src/app/globals.css`**

기존 globals.css에 추가:
```css
@media print {
  /* 액션 영역 숨김 */
  .no-print, header { display: none !important; }
  /* 아코디언 강제 펼침 */
  [data-state="closed"][data-radix-collection-item],
  [data-radix-accordion-content][data-state="closed"] { display: block !important; height: auto !important; }
  details:not([open]) { display: block; }
  details summary { display: none; }
  body { background: white; color: black; }
}
```

`Actions.tsx`의 최상위 div에 `className="no-print ..."` 추가.

- [ ] **Step 6: 테스트 (Chromium 호출 mock)**

`tests/integration/pdf.test.ts`:
```ts
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { GET } from '@/app/r/[id]/pdf/route'
import { prisma } from '@/lib/db'

const CACHE = '/tmp/crawl-lens-pdf-test'

vi.mock('@/lib/env', async (orig) => {
  const e = (await orig<typeof import('@/lib/env')>()).env
  return { env: { ...e, PDF_CACHE_DIR: CACHE } }
})

beforeAll(async () => { await mkdir(CACHE, { recursive: true }); await prisma.scan.deleteMany() })

describe('GET /r/[id]/pdf', () => {
  it('캐시 hit 시 즉시 PDF', async () => {
    const publicId = 'pdf-cached'
    await prisma.scan.create({
      data: { publicId, targetUrl: 'https://x.test/', normalizedUrl: 'https://x.test/', status: 'DONE' },
    })
    await writeFile(join(CACHE, `${publicId}.pdf`), Buffer.from('%PDF-stub'))
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: publicId }) })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
  })

  it('Scan 없음 → 404', async () => {
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'missing' }) })
    expect(res.status).toBe(404)
  })

  it('Scan PENDING → 409', async () => {
    await prisma.scan.create({ data: { publicId: 'pdf-pending', targetUrl: 'https://x/', normalizedUrl: 'https://x/' } })
    const res = await GET(new Request('http://localhost'), { params: Promise.resolve({ id: 'pdf-pending' }) })
    expect(res.status).toBe(409)
  })
})
```

(실제 Puppeteer를 호출하는 long-polling 테스트는 Chromium 의존성이 크므로 E2E에서만.)

Run: `npm test -- pdf.test`
Expected: PASS.

- [ ] **Step 7: 커밋**

```bash
git add src/worker/pdf.ts src/worker/index.ts src/app/r/[id]/pdf src/lib/queue.ts src/lib/env.ts src/app/globals.css src/components/result/Actions.tsx tests/integration/pdf.test.ts
git commit -m "feat(pdf): puppeteer worker + long-polling route + print CSS"
```

---

## Task 18: Dockerfile + docker-compose.yml

**Goal:** OrbStack에서 web/worker 두 컨테이너 + Chromium 포함.

**Files:**
- Create: `Dockerfile`, `docker-compose.yml`, `.dockerignore`

**Interfaces:**
- Consumes: `package.json`, build 산출물

- [ ] **Step 1: `.dockerignore`**

```
node_modules
.next
.env
.env.*
!.env.example
.git
coverage
test-results
playwright-report
tests
docs
data
```

- [ ] **Step 2: `Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=optional

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build
# tsx 워커 산출물 컴파일 (worker는 별도 컴파일)
RUN npx tsc -p tsconfig.worker.json

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Chromium 의존성
RUN apk add --no-cache \
  chromium nss freetype harfbuzz ca-certificates ttf-freefont \
  libstdc++ libgcc \
  && rm -rf /var/cache/apk/*
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.mjs ./next.config.mjs
EXPOSE 4500
CMD ["node_modules/.bin/next", "start", "-p", "4500"]
```

Note: `tsconfig.worker.json` 별도 필요 — worker/lib만 컴파일:
`tsconfig.worker.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "noEmit": false,
    "module": "commonjs",
    "target": "es2022"
  },
  "include": ["src/worker/**/*", "src/lib/**/*", "src/analyzers/**/*"],
  "exclude": ["node_modules", "tests"]
}
```

워커 실행 시 puppeteer 가 시스템 chromium 을 쓰도록 환경변수:
- 운영 .env에 `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser` 추가
- worker/pdf.ts 에서 환경변수 우선 적용:
  ```ts
  const execPath = process.env.PUPPETEER_EXECUTABLE_PATH ?? await chromium.executablePath()
  ```

- [ ] **Step 3: web entrypoint에 prisma migrate 추가**

Dockerfile CMD를 entrypoint 스크립트로:
```dockerfile
COPY docker-entrypoint.sh /
RUN chmod +x /docker-entrypoint.sh
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node_modules/.bin/next", "start", "-p", "4500"]
```

`docker-entrypoint.sh`:
```bash
#!/bin/sh
set -e
if [ "$RUN_MIGRATIONS" = "1" ]; then
  npx prisma migrate deploy
fi
exec "$@"
```

- [ ] **Step 4: `docker-compose.yml`**

```yaml
name: crawl-lens

services:
  web:
    build: .
    image: crawl-lens:latest
    container_name: crawl-lens-web
    environment:
      RUN_MIGRATIONS: "1"
    env_file: ../.env
    extra_hosts:
      - "host.docker.internal:host-gateway"
    networks: [edge_shared]
    healthcheck:
      test: ["CMD", "wget", "-q", "-O", "-", "http://localhost:4500/api/health"]
      interval: 10s
      timeout: 5s
      retries: 6
      start_period: 30s
    ports:
      - "127.0.0.1:4500:4500"

  worker:
    image: crawl-lens:latest
    container_name: crawl-lens-worker
    command: ["node", "dist/worker/index.js"]
    env_file: ../.env
    extra_hosts:
      - "host.docker.internal:host-gateway"
    networks: [edge_shared]
    depends_on:
      web:
        condition: service_healthy
    volumes:
      - /opt/stack/data/crawl-lens/pdf:/data/pdf

networks:
  edge_shared:
    external: true
```

- [ ] **Step 5: 로컬 빌드 검증**

Run:
```bash
docker compose build
```

Expected: 빌드 성공. (`edge_shared` 네트워크가 로컬에 없어 `up`은 실패할 수 있음. 빌드만 검증.)

- [ ] **Step 6: 커밋**

```bash
git add Dockerfile docker-compose.yml docker-entrypoint.sh .dockerignore tsconfig.worker.json src/worker/pdf.ts
git commit -m "build: Dockerfile (multi-stage) + docker-compose with edge_shared"
```

---

## Task 19: deploy.sh + GitHub Actions + Caddy 안내

**Goal:** `main` push → 맥미니 self-hosted runner → 컨테이너 재배포 → 헬스체크.

**Files:**
- Create: `scripts/deploy.sh`, `.github/workflows/deploy.yml`, `CLAUDE.md` (저장소 가이드)
- Modify: `README.md`

**Interfaces:**
- Consumes: 호스트 환경 `/opt/stack/...` 경로
- Produces: 운영 자동 배포

- [ ] **Step 1: `scripts/deploy.sh`**

```bash
#!/bin/sh
set -eu

APP_DIR="/opt/stack/services/public/myazit.kr/crawl-lens"
REPO_DIR="$APP_DIR/repo"

cd "$REPO_DIR"
git fetch --prune origin
git reset --hard origin/main

docker compose --env-file ../.env -f docker-compose.yml up -d --build --force-recreate --remove-orphans
docker image prune -f

# 헬스체크
for i in $(seq 1 60); do
  if docker exec crawl-lens-web wget -q -O- http://localhost:4500/api/health 2>/dev/null | grep -q '"ok":true'; then
    echo "healthy"; exit 0
  fi
  sleep 1
done
echo "health check failed"; exit 1
```

Run: `chmod +x scripts/deploy.sh`

- [ ] **Step 2: `.github/workflows/deploy.yml`**

```yaml
name: deploy
on:
  push: { branches: [main] }
  workflow_dispatch:
jobs:
  deploy:
    runs-on: self-hosted
    steps:
      - run: /opt/stack/services/public/myazit.kr/crawl-lens/repo/scripts/deploy.sh
```

- [ ] **Step 3: Caddyfile 라우트 추가 안내 (README + CLAUDE.md)**

`CLAUDE.md` 신규 작성 (저장소 가이드):
```markdown
# crawl-lens

URL 하나를 넣으면 메타·콘텐츠·기술·성능 SEO를 진단하는 Next.js 웹서비스.

## 배포 운영 메모

- 운영 트리: `/opt/stack/services/public/myazit.kr/crawl-lens/`
- 도메인: `crawl-lens.myazit.kr` (Caddy 라우트 1줄로 노출)
- 포트: 컨테이너 내부 `4500` (Caddy 업스트림)
- self-hosted runner: `~/actions-runner-crawl-lens/`

## 새 배포 추가 시 손볼 곳 (1회성)

1. 맥미니에 `/opt/stack/services/public/myazit.kr/crawl-lens/` 디렉토리 생성
2. 그 안에 `.env` (`/opt/stack/services/public/myazit.kr/crawl-lens/.env`) 작성 (0600)
3. `repo/` 에 이 저장소 clone (deploy key + `~/.ssh/config` 별칭 `github-crawl-lens`)
4. `~/actions-runner-crawl-lens/` 러너 등록 (launchd, 다른 앱 패턴 그대로)
5. `edge-caddy` 저장소의 `Caddyfile`에 아래 1줄 추가 후 push:

```caddy
http://crawl-lens.myazit.kr {
    import common
    reverse_proxy crawl-lens-web:4500
}
```

6. 첫 배포는 GitHub Actions `workflow_dispatch`로 수동 트리거 또는 `main` push

## 로컬 개발

```bash
cp .env.example .env  # 값 채우기 (호스트 Postgres/Redis)
npm install
npx prisma migrate dev
npm run dev         # 웹 (4500)
npm run worker:dev  # 워커 (별 터미널)
```

## 테스트

```bash
npm run lint
npm run typecheck
npm test            # unit + integration
npm run test:e2e    # Playwright
```
```

- [ ] **Step 4: README.md 최소화**

```markdown
# crawl-lens

웹사이트 SEO 분석 도구. URL 하나 → 메타/콘텐츠/기술/성능 진단.

상세 운영·개발 가이드는 [CLAUDE.md](./CLAUDE.md) 참고.

데모: https://crawl-lens.myazit.kr
```

- [ ] **Step 5: 커밋**

```bash
git add scripts/deploy.sh .github/workflows/deploy.yml CLAUDE.md README.md
git commit -m "ci: deploy.sh + self-hosted runner workflow + ops docs"
```

---

## Task 20: E2E 테스트 + 마무리

**Goal:** Playwright로 홈→검사→결과 한 사이클 검증. PSI는 mock. 최종 lint/typecheck 청소.

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/scan-flow.spec.ts`, `tests/e2e/setup/msw-server.ts`
- Modify: `package.json`, `.github/workflows/ci.yml` (e2e 단계)

**Interfaces:**
- Consumes: 개발 서버 + worker
- Produces: E2E 통과 보고

- [ ] **Step 1: `playwright.config.ts`**

```ts
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
        DATABASE_URL: process.env.DATABASE_URL!,
        REDIS_URL: process.env.REDIS_URL!,
        PSI_API_KEY: 'e2e-key',
        PUBLIC_BASE_URL: 'http://localhost:4500',
        IP_HASH_SALT: 'e2e-salt-1234567890',
        RATE_LIMIT_ALLOWLIST: '127.0.0.1',
      },
    },
    {
      command: 'npm run worker:dev',
      port: 0,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: {
        NODE_ENV: 'test',
        DATABASE_URL: process.env.DATABASE_URL!,
        REDIS_URL: process.env.REDIS_URL!,
        PSI_API_KEY: 'e2e-key',
        PUBLIC_BASE_URL: 'http://localhost:4500',
        IP_HASH_SALT: 'e2e-salt-1234567890',
        RATE_LIMIT_ALLOWLIST: '127.0.0.1',
      },
    },
  ],
})
```

- [ ] **Step 2: E2E 테스트**

PSI/대상 URL은 워커가 직접 fetch하므로 mocking이 까다롭다 (Playwright는 브라우저 인터셉트만 가능). 워커의 fetch를 mock하려면 환경변수로 fixture 서버 URL을 주입하는 게 단순.

대안: 워커에 **테스트용 fixture 모드** — `NODE_ENV=test` 시 fixture HTML/Robots/Sitemap을 인메모리로 반환하도록 분기. v1 E2E 범위로는 과한 작업.

**결정: E2E는 "홈에서 입력 → /r/ 경로로 이동 → 504(타임아웃) 또는 FAILED 화면을 정상 표시"만 검증.** 실제 검사가 도는 통합 테스트는 Task 10이 이미 커버.

`tests/e2e/scan-flow.spec.ts`:
```ts
import { test, expect } from '@playwright/test'

test('홈에서 잘못된 URL 입력 시 400/에러 표시', async ({ page }) => {
  await page.goto('/')
  await page.getByPlaceholder('https://example.com/blog/post').fill('not-a-url-and-no-dot')
  await page.getByRole('button', { name: /검사 시작/ }).click()
  // URL이 자동 보정되어도 결국 fetch에서 실패 → 결과 페이지가 FAILED 표시 또는 폼이 에러 표시
  // 둘 중 하나가 일정 시간 안에 나타나면 PASS
  await expect(page.getByText(/검사할 수 없었어요|검사를 시작할 수 없|네트워크/)).toBeVisible({ timeout: 90_000 })
})

test('홈 페이지 4개 카테고리 카드 노출', async ({ page }) => {
  await page.goto('/')
  for (const label of ['메타', '콘텐츠', '기술', '성능']) {
    await expect(page.getByText(label).first()).toBeVisible()
  }
})
```

- [ ] **Step 3: CI에 e2e 단계 추가**

`.github/workflows/ci.yml`의 jobs에 추가:
```yaml
  e2e:
    runs-on: ubuntu-latest
    needs: test
    services:
      postgres:
        image: postgres:16-alpine
        env: { POSTGRES_USER: crawl_lens, POSTGRES_PASSWORD: changeme, POSTGRES_DB: crawl_lens_test }
        ports: ['5432:5432']
        options: --health-cmd pg_isready
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
    env:
      DATABASE_URL: postgresql://crawl_lens:changeme@localhost:5432/crawl_lens_test
      REDIS_URL: redis://localhost:6379/3
      PSI_API_KEY: dummy
      PUBLIC_BASE_URL: http://localhost:4500
      IP_HASH_SALT: ci-test-salt-1234567890
      NODE_ENV: test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22', cache: 'npm' }
      - run: npm ci
      - run: npx prisma generate && npx prisma migrate deploy
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
```

- [ ] **Step 4: 최종 lint/typecheck/test 일괄 실행**

Run:
```bash
npm run lint
npm run typecheck
npm test
```

Expected: 모두 통과.

- [ ] **Step 5: 마지막 커밋**

```bash
git add playwright.config.ts tests/e2e .github/workflows/ci.yml
git commit -m "test: e2e flow tests + ci e2e job"
```

---

## 자체 리뷰

### 스펙 커버리지
- ✅ 4개 카테고리 검사 → Task 5~8
- ✅ 점수 집계 (부분 실패 재정규화 포함) → Task 9
- ✅ 공유 URL `/r/[publicId]` + JSON → Task 15, 16
- ✅ PDF → Task 17
- ✅ 진행/완료/실패 분기 + 폴링 → Task 11, 15
- ✅ Rate limit 30회/시간 → Task 12
- ✅ robots.txt 정책 (검사 진행 + 경고) → Task 7
- ✅ User-Agent 일관 → Task 4
- ✅ 호스트 Postgres/Redis 재사용 → Task 18 compose
- ✅ Caddy 라우트 + self-hosted runner → Task 19
- ✅ 헬스체크 + worker heartbeat → Task 13
- ✅ 로깅 (pino) — Task 1 의존성, Task 10/13 실제 사용
- ✅ 메트릭 카운터 → Task 13
- ✅ Prisma 마이그레이션 운영 (entrypoint) → Task 18
- ⚠️ localStorage 이력 → Task 14 추가/Task 15에서 점수 갱신

### 디자인 문서와 변경된 부분 (구현 편의)
- JSON 경로: `/r/[id].json` → `/api/r/[id]` (Next.js 동적 라우트 제약). Task 16 메모로 남김.

### Placeholder 스캔
- 검사 완료: TBD/TODO/`fill in` 없음.

### 타입 일관성
- `CheckResult.weight` 모든 analyzer에서 number ✓
- `ScanStatus` 4개 enum 일관 ✓
- `ScanJobData = { publicId: string }` Task 10, 11, 15 모두 동일 ✓
- `aggregate` 반환 `categories: Record<Category, number | null>` Task 9, 15에서 일치 ✓

---

## 실행 핸드오프

플랜 완료. `docs/superpowers/plans/2026-06-26-crawl-lens.md` 에 저장됨.

두 가지 실행 방식 중 선택해주세요:

**1. Subagent-Driven (권장)** — task마다 새 subagent 디스패치, task 사이마다 사용자/리뷰어 체크포인트, 빠른 반복

**2. Inline Execution** — 이 세션에서 task를 묶음 실행, 체크포인트마다 사용자 검토

어느 쪽으로 가시겠어요?
