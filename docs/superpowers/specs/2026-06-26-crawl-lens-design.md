# crawl-lens 디자인 문서

작성일: 2026-06-26
상태: 초안 (사용자 검토 대기)

## 1. 개요

### 1.1 제품 한 줄 정의

URL 하나를 넣으면 수십 초 안에 메타·콘텐츠·기술·성능 SEO를 한 번에 진단해 공유 가능한 결과 페이지를 돌려주는 도구. 결과 페이지는 그대로 PDF 리포트가 된다.

### 1.2 타깃 사용자

- **개인 블로거 / 1인 사업자**: 자기 사이트 한두 개를 직접 점검. "왜 이게 문제이고 어떻게 고치는지" 친절한 설명이 가치.
- **개발자 / 사내 엔지니어링 팀**: 기술적 SEO에 정확한 진단, 결과 페이지가 곧 JSON API (`/r/{publicId}` ↔ `/r/{publicId}.json`)로 CI에서 fetch 가능.

두 사용자가 동시에 만족하려면 "기술적으로 정확하되, 결과 설명은 친절"한 톤이 일관되어야 한다.

### 1.3 핵심 가치

1. **공유 가능한 영구 URL**이 그 자체로 리포트이자 마케팅 (`crawl-lens.myazit.kr/r/abc123xyz0`).
2. **결과 페이지 = PDF = JSON** 같은 컨텐츠의 세 가지 표현.
3. **점수보다 항목별 Pass/Warn/Fail 리스트가 1급 시민** — 점수는 한 번 보고 지나가는 위치.

### 1.4 의도적으로 빼는 것 (YAGNI)

- 회원가입 / 로그인 (v2)
- 사이트 전체 크롤링 (v2, 단 모듈 경계는 미리 잡음)
- SPA(JS 렌더링) 분석 (v2)
- 접근성(a11y) 검사 (v2)
- 백링크 / 키워드 순위 (외부 유료 API 의존, 별도 제품)
- 정기 모니터링 / 이메일 리포트 (v2)
- 외부 analytics (개인정보 우려)

---

## 2. 검사 카테고리와 점수

### 2.1 4개 카테고리 (각 가중치 25점, 총 100점)

| 카테고리 | 검사 항목 |
|---|---|
| **메타데이터** | `<title>` 존재·길이, meta description 존재·길이, canonical, Open Graph, Twitter Card, hreflang, viewport, `<html lang>` |
| **콘텐츠 구조** | h1 유일성, heading 계층(h1~h6), 이미지 alt 비율, 워드카운트, 내부/외부 링크 수, nofollow 비율, 깨진 링크 샘플링 |
| **기술적 SEO** | HTTPS, robots.txt 접근성·해당 페이지 허용 여부, sitemap.xml 발견, JSON-LD schema 파싱·검증, mobile viewport, `x-robots-tag` 헤더 |
| **성능** | Google PageSpeed Insights API의 LCP / INP / CLS / TBT (모바일 기준) |

### 2.2 점수 산출

- 각 카테고리의 점수는 그 카테고리 안 항목들의 가중 평균. `pass=1.0`, `warn=0.5`, `fail=0.0`, `skip`은 분모에서 제외.
- 카테고리 점수의 단순 평균이 총점(0~100).
- **부분 실패는 DONE**: 4개 카테고리 중 일부만 실패(예: PSI 할당량 초과 → 성능 SKIP)해도 결과 표시. 그 카테고리는 점수 분모에서 제외하고 나머지로 재정규화한다.

### 2.3 결과 표시 우선순위

점수는 한 번 보는 요약일 뿐이다. 실제 가치는 항목별 **Pass / Warn / Fail / Skip** 리스트와 각 항목의 메시지·권장 조치·문서 링크에서 나온다.

---

## 3. 시스템 아키텍처

### 3.1 인프라 (기존 맥미니 인프라 재사용)

`/opt/stack/CLAUDE.md`에 정의된 패턴을 그대로 따른다.

- **DB**: 호스트 PostgreSQL (`/opt/stack/services/database/postgres`, `127.0.0.1:5432`). `crawl_lens` DB만 신규 생성.
- **큐**: 호스트 Redis (`/opt/stack/services/database/redis`, `127.0.0.1:6379`). DB index 3번 사용.
- **외부 노출**: cloudflared → Caddy(`:80`) → 앱 컨테이너. TLS는 Cloudflare가 종단.
- **도메인**: `crawl-lens.myazit.kr` (와일드카드 `*.myazit.kr → caddy:80`이 이미 흡수).
- **내부 포트**: `4500` (현재 비어있는 슬롯).
- **자동 배포**: GitHub Actions self-hosted runner `~/actions-runner-crawl-lens/`. `main` push → `repo/scripts/deploy.sh`.

### 3.2 컨테이너 구성 (2개)

```
crawl-lens-web      Next.js (Node 22 alpine)   내부 :4500   외부 노출 O (Caddy 업스트림)
crawl-lens-worker   같은 이미지, command 다름                 외부 노출 X (큐 consumer 전용)
```

둘 다 `edge_shared` 도커 네트워크에 합류. Caddy는 `crawl-lens-web:4500`만 본다.

### 3.3 호스트 인프라 접근

컨테이너 → 호스트 Postgres/Redis는 OrbStack의 `host.docker.internal` 사용. `extra_hosts: ["host.docker.internal:host-gateway"]`를 compose에 명시한다.

### 3.4 트래픽 흐름

```
사용자 ──HTTPS──▶ Cloudflare ──▶ cloudflared
                                       │
                                       ▼
                                    Caddy :80
                                       │
                                       │  Caddyfile:
                                       │  http://crawl-lens.myazit.kr {
                                       │      import common
                                       │      reverse_proxy crawl-lens-web:4500
                                       │  }
                                       ▼
                              ┌──────────────────┐
                              │ crawl-lens-web   │──enqueue──▶ host:redis/3
                              │ Next.js :4500    │
                              └──────────────────┘
                                       ▲
                                       │ status poll
                              ┌──────────────────┐
                              │ crawl-lens-worker│──pull/save──▶ host:redis/3,
                              │ (no port)        │              host:postgres/crawl_lens
                              └──────────────────┘
```

### 3.5 모듈 경계 (소스 구조)

```
src/
├── app/                       Next.js 앱 라우터
│   ├── page.tsx               URL 입력 폼 (홈)
│   ├── r/[id]/page.tsx        결과 페이지 (진행/완료/실패 분기)
│   ├── r/[id]/route.ts        JSON 응답 (Accept 헤더 분기 + .json 라우트)
│   ├── r/[id]/pdf/route.ts    PDF 응답
│   └── api/
│       ├── scan/route.ts                POST 신규 검사
│       ├── scan/[id]/status/route.ts    GET 폴링 (가벼운 status 응답)
│       └── health/route.ts              GET 헬스체크
├── analyzers/                 카테고리별 독립 모듈
│   ├── types.ts               CheckResult, Analyzer, AnalyzeContext
│   ├── meta.ts
│   ├── content.ts
│   ├── technical.ts
│   └── performance.ts
├── lib/
│   ├── fetcher.ts             공통 HTTP 클라이언트 (UA, timeout, redirect 정책)
│   ├── queue.ts               BullMQ 큐 정의: `scan` (검사 실행), `pdf` (리포트 생성)
│   ├── db.ts                  Prisma client
│   ├── url.ts                 URL 정규화
│   ├── score.ts               점수 집계
│   └── ratelimit.ts           Redis 기반 IP rate limit
└── worker/                    별도 프로세스 진입점
    └── index.ts               BullMQ Worker (scan + pdf 잡 처리)
```

### 3.6 핵심 인터페이스

```ts
type CheckStatus = 'pass' | 'warn' | 'fail' | 'skip'
type Category = 'meta' | 'content' | 'technical' | 'performance'

type CheckResult = {
  id: string              // "meta.title.length" 안정적 식별자
  category: Category
  status: CheckStatus
  title: string           // "Title 태그 길이" (한국어)
  message: string         // 친절한 설명 (블로거용)
  detail?: object         // 원본 값 (개발자용)
  fix?: string            // 권장 조치
  docs?: string           // 외부 문서 링크
  weight: number          // 카테고리 내 가중치
}

type AnalyzeContext = {
  targetUrl: string
  normalizedUrl: string
  html: string             // 페이지 본문
  $: cheerio.Root          // 파싱된 DOM
  responseHeaders: Headers
  responseStatus: number
  finalUrl: string         // 리다이렉트 추적 후
}

interface Analyzer {
  name: Category
  run(ctx: AnalyzeContext): Promise<CheckResult[]>
}
```

새 검사 항목 추가는 해당 analyzer 파일만 건드리면 된다. v2에서 사이트 크롤링이 추가되어도 페이지별로 같은 analyzer를 돌리고 결과를 집계한다.

### 3.7 검사 실행 흐름 (Worker 내부)

1. URL fetch (공통 HTTP 클라이언트, 타임아웃 15초, 리다이렉트 최대 5회)
2. HTML 파싱 (cheerio) → `AnalyzeContext` 생성
3. 4개 analyzer **병렬 실행** (`Promise.all`)
   - `performance`(PSI API)는 20~40초, 나머지는 1~3초
4. 결과 집계 → 점수 계산 → PostgreSQL에 저장 → `status = 'done'`
5. 부분 실패는 해당 analyzer 결과를 비우고 카테고리 SKIP 처리

### 3.8 클라이언트 동기화

- `POST /api/scan` → 즉시 `{ publicId, status: 'pending' }` 반환 (목표 < 200ms)
- 클라이언트는 `/r/{publicId}`로 즉시 이동
- 결과 페이지에서 1초 간격 polling (`/api/scan/{publicId}/status`)
- 30초 후에도 미완료면 폴링 간격을 2초 → 5초로 늘림
- SSE는 v1에서 도입하지 않음 (복잡도 대비 이득 적음)

**진행률(progress) 산출**: worker가 단계 진입마다 Redis에 `scan:progress:{publicId}` 키 값을 갱신(0~100). 단계 가중치는 `fetch=10, meta+content+technical 병렬 완료=40, performance(PSI)=50`. 클라이언트는 status API 응답의 `progress` 필드를 받아 진행률 바에 그대로 반영.

### 3.9 Caddyfile 추가 라인

```caddy
http://crawl-lens.myazit.kr {
    import common
    reverse_proxy crawl-lens-web:4500
}
```

CLAUDE.md의 함정 회피 규칙 준수: `http://` 접두사 필수, 디렉티브 한 줄에 묶지 말 것, 한글 주석/HSTS 금지.

---

## 4. 데이터 모델

### 4.1 설계 원칙

- 테이블은 `Scan` 하나로 시작. 결과는 JSONB로 통째 저장. 항목별 통계가 필요해지면 `CheckResult` 테이블로 분해(YAGNI).
- Rate limit는 Redis로 처리 (DB 카운터 X).
- 공유 URL은 추측 불가능한 `publicId`(nanoid 10자).

### 4.2 Prisma 스키마

```prisma
generator client { provider = "prisma-client-js" }
datasource db    { provider = "postgresql"; url = env("DATABASE_URL") }

model Scan {
  // 식별자
  id            String     @id @default(cuid())          // 내부 PK
  publicId      String     @unique                       // /r/{publicId}, nanoid(10)

  // 입력
  targetUrl     String                                   // 사용자가 넣은 그대로
  normalizedUrl String                                   // 정규화된 URL

  // 진행 상태
  status        ScanStatus @default(PENDING)
  errorMessage  String?                                  // 사용자에게 표시 가능한 사유
  errorCode     String?                                  // 내부 분류 (DNS_FAIL, TIMEOUT, ...)
  fetchStatus   Int?                                     // 대상 페이지 HTTP 상태코드

  // 결과 (status=DONE일 때 채워짐)
  totalScore       Int?                                  // 0-100
  categoryScores   Json?                                 // { meta:88, content:70, ... }
  checks           Json?                                 // CheckResult[] 통째

  // 운영 메타
  ipHash        String?                                  // SHA-256(ip + salt)
  userAgent     String?                                  // 요청자 UA (디버깅용)

  // 시간
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

### 4.3 `checks` JSONB 예시

```jsonc
[
  {
    "id": "meta.title.length",
    "category": "meta",
    "status": "warn",
    "title": "Title 태그 길이",
    "message": "현재 12자입니다. 검색 결과에서 잘리지 않으려면 30~60자가 적당합니다.",
    "detail": { "value": "내 블로그", "length": 12 },
    "fix": "페이지 제목을 30~60자로 늘려보세요. 핵심 키워드를 앞쪽에 두면 클릭률에 유리합니다.",
    "docs": "https://developers.google.com/search/docs/appearance/title-link",
    "weight": 5
  }
]
```

### 4.4 URL 정규화 규칙

- protocol / host 소문자
- 기본 포트(`:80`, `:443`) 제거
- fragment(`#…`) 제거
- 트레일링 슬래시: 루트(`/`)는 유지, 그 외는 입력 그대로
- query string 유지 (분석 대상이 달라짐)
- 정규화는 표시 일관성 용도. 결과 캐시(같은 URL 재검사 시 이전 결과 반환)는 하지 않음 — 매번 새로 검사.

### 4.5 publicId 생성

- `nanoid(10)` (URL-safe 알파벳, 충돌 확률 무시 가능)
- 형식: `/r/abc123xyz0`

### 4.6 보관 정책

- v1: 무기한 보관. 공유 URL이 영구 식별자라는 가치가 핵심.
- 90일 지난 검사의 `checks[].detail` 절단은 v2에서 검토.

### 4.7 v2 확장 자리 (지금은 추가하지 않음)

- `userId` — 로그인 사용자 귀속
- `crawlId` — 사이트 크롤링 그룹
- `parentScanId` — 재검사 / 변동 비교

마이그레이션 한 번에 추가 가능한 형태라 미리 넣지 않는다.

### 4.8 Prisma 마이그레이션 운영

- `web` 컨테이너 entrypoint에서 `prisma migrate deploy` 1회 실행
- `worker` 컨테이너는 `web`의 헬스체크 통과 후 기동 (`depends_on: { web: { condition: service_healthy } }`)

---

## 5. UI / UX

### 5.1 페이지 맵

| 경로 | 역할 |
|---|---|
| `/` | URL 입력 (홈) |
| `/r/[publicId]` | 진행 + 결과 + 실패 (status에 따라 화면 분기) |
| `/r/[publicId]/pdf` | 결과 페이지 PDF |
| `/r/[publicId].json` 또는 Accept negotiation | JSON 응답 |

### 5.2 홈 `/`

레이아웃 요소:
- 헤더: 제품명 `crawl-lens`, 다크/라이트 토글
- 한 줄 카피: "내 사이트가 검색에 잘 노출되는지 30초 안에 알아보세요."
- URL 입력 박스 + 검사 시작 버튼. 자동 `https://` 보정, URL 유효성 검사
- 4개 카테고리 카드 (클릭 시 "이 카테고리에서 검사하는 항목" 모달)
- 최근 검사 이력 (localStorage 기반, 계정 없는 v1의 "내 기록" 대용)

### 5.3 `/r/[publicId]` 진행 화면 (status=PENDING/RUNNING)

- 검사 대상 URL 표시
- 진행률 바 (4단계 가중 평균, 성능 단계 가중치 더 큼)
- 현재 단계 표시:
  - ✓ 페이지 가져오기
  - ✓ 메타 / 콘텐츠 / 기술 검사
  - ⟳ 성능 측정 중 (Google PageSpeed Insights)
- 공유 URL 복사 버튼은 **진행 중에도 활성** — 누구에게 보내면 그 사람이 결과까지 자동으로 보게 됨

### 5.4 `/r/[publicId]` 결과 화면 (status=DONE)

상단:
- 검사 URL, 검사 시각
- 액션 버튼: URL 복사, PDF, JSON, 다시 검사
- 총점 (큰 원형) + 카테고리 4개 점수 (작게)

본문:
- 상단 칩 필터: 전체 / 통과 / 경고 / 실패
- 카테고리별 아코디언 (메타 / 콘텐츠 / 기술 / 성능)
- 첫 진입 시 경고/실패가 있는 카테고리만 펼쳐져 있음
- 각 항목:
  - 상태 아이콘 (✓ ⚠ ✗ −) + 한 줄 제목
  - 펼치면: 친절한 메시지 → 원본 값(detail) → 권장 조치(fix) → 문서 링크(docs)

### 5.5 `/r/[publicId]` 실패 화면 (status=FAILED)

- 친절한 에러 메시지 (errorCode → 한국어 메시지 매핑)
- 확인해볼 것 체크리스트
- 다시 검사 / 홈으로 버튼

### 5.6 PDF `/r/[publicId]/pdf`

- 동작: Puppeteer headless로 결과 페이지를 렌더 → PDF 출력
- 결과 페이지에 `@media print` CSS: 헤더 버튼/네비 숨김, 아코디언 강제 전체 펼침
- 캐시: 최초 생성 후 `/opt/stack/data/crawl-lens/pdf/{publicId}.pdf`에 저장. 두 번째 요청부터 즉시 응답
- Chromium은 worker 이미지에만 포함 (web 이미지 가볍게 유지). PDF 요청은 web → `pdf` 큐 → worker 처리

**첫 요청 처리 (long-polling)**

1. 클라이언트가 `GET /r/[publicId]/pdf` 호출
2. 서버: 캐시 파일 있으면 즉시 `application/pdf` 스트리밍 (200)
3. 캐시 없으면: 검사가 DONE인지 확인 → DONE 아니면 `409 Conflict + JSON 메시지` 반환 (결과 페이지에서 PDF 버튼은 검사 완료 후에만 활성화하므로 일반적으로 발생 X)
4. 검사 DONE인 경우: `pdf` 큐에 잡 enqueue → 서버가 워커 완료를 최대 60초까지 기다림(BullMQ `waitUntilFinished`) → 완료되면 캐시 파일에서 스트리밍
5. 60초 안에 안 끝나면 `504 Gateway Timeout + JSON` 반환. 클라이언트는 5초 뒤 재시도 안내

캐시 파일은 결과의 일부 영구화이므로 `Cache-Control: public, max-age=31536000, immutable` 헤더 부여.

### 5.7 JSON 응답

두 방식 모두 제공:
- `GET /r/[publicId].json` — 명시적, CI 스크립트 친화적 (`curl ... | jq`)
- `GET /r/[publicId]` with `Accept: application/json` — REST 관용

응답:
```json
{
  "publicId": "abc123xyz0",
  "targetUrl": "https://example.com/blog/post",
  "normalizedUrl": "https://example.com/blog/post",
  "status": "done",
  "totalScore": 78,
  "categoryScores": { "meta": 88, "content": 70, "technical": 95, "performance": 60 },
  "checks": [ /* CheckResult[] */ ],
  "createdAt": "2026-06-26T05:32:00Z",
  "completedAt": "2026-06-26T05:32:34Z"
}
```

### 5.8 디자인 톤

- **Tailwind CSS + shadcn/ui** (필요한 컴포넌트만 차용)
- 모노톤 베이스 + 액센트 1색
- 다크모드 1급 지원 (개발자 호감)
- 폰트: 영문 Inter, 한글 Pretendard
- 상태 색: pass=초록, warn=황금색, fail=빨강, skip=중성회색. 컬러블라인드 대응으로 아이콘 병행

### 5.9 다국어

- v1: 한국어만
- 구조는 i18n 키 분리. v2에서 영어 매핑 추가

### 5.10 접근성 최소선

- 키보드 네비게이션 (아코디언, 필터 칩)
- 의미적 HTML (`<section>`, `<h2>`, `<details>`)
- 상태는 색 + 아이콘 + 텍스트 3중 표시

### 5.11 외부 analytics 미사용

v1은 GA 등을 붙이지 않는다. 운영 통계는 DB 직접 조회로 충분.

---

## 6. API

### 6.1 내부 API (브라우저 ↔ Next.js)

| Method | Path | 용도 |
|---|---|---|
| `POST` | `/api/scan` | 신규 검사 생성. body: `{ url }`. 응답: `{ publicId, status }` |
| `GET` | `/api/scan/[publicId]/status` | 폴링용 가벼운 응답. `{ status, progress?: number }` |
| `GET` | `/api/health` | DB/Redis ping + worker heartbeat 확인 (deploy.sh가 호출) |

### 6.2 공개 API (외부에서 fetch)

| Method | Path | 응답 |
|---|---|---|
| `GET` | `/r/[publicId]` | HTML (Accept에 따라 JSON) |
| `GET` | `/r/[publicId].json` | JSON |
| `GET` | `/r/[publicId]/pdf` | PDF (binary) |

### 6.3 헬스체크 응답

```json
{
  "ok": true,
  "checks": {
    "db": "ok",
    "redis": "ok",
    "worker": { "active": true, "lastHeartbeat": "2026-06-26T05:30:00Z" }
  },
  "metrics": {
    "scanDoneToday": 142,
    "scanFailedToday": 8,
    "psiQuotaUsedToday": 142
  }
}
```

`/api/health`는 인증 없이 노출. 민감 정보 아님.

---

## 7. 에러 처리

### 7.1 에러 분류

| `errorCode` | 사용자 메시지 (한국어) | Scan 상태 |
|---|---|---|
| `DNS_FAIL` | "도메인을 찾을 수 없어요" | FAILED |
| `CONN_FAIL` | "서버에 연결할 수 없었어요" | FAILED |
| `TIMEOUT` (15초) | "응답이 너무 느려요" | FAILED |
| `HTTP_4XX` | "페이지가 {code}를 반환했어요" | FAILED |
| `HTTP_5XX` | "서버 오류({code})가 발생했어요. 잠시 후 다시 시도해보세요" | FAILED |
| `PARSE_FAIL` | "페이지가 HTML이 아니거나 깨져 있어요" | FAILED |
| `ROBOTS_BLOCKED` | (검사 진행, 결과에 경고 항목 추가) | DONE |
| `PSI_QUOTA` | (성능만 SKIP, 사용자에게 메시지 표시) | DONE |
| `PSI_TIMEOUT` (60초) | (성능만 SKIP, 측정 실패 메시지) | DONE |

### 7.2 부분 실패 정책

검사 4개 카테고리 중 일부만 실패하면 그 카테고리만 SKIP하고 나머지 결과는 표시. 점수 분모에서 해당 카테고리 제외.

---

## 8. 운영

### 8.1 환경 변수 (`.env`)

```bash
DATABASE_URL=postgresql://crawl_lens:***@host.docker.internal:5432/crawl_lens
REDIS_URL=redis://host.docker.internal:6379/3

PSI_API_KEY=***                  # Google Cloud Console에서 발급. 일일 25,000회 / 분당 240회
PUBLIC_BASE_URL=https://crawl-lens.myazit.kr
IP_HASH_SALT=***                 # ipHash 생성용
RATE_LIMIT_ALLOWLIST=             # 콤마 구분 IP, 운영자/로컬 화이트리스트
NODE_ENV=production
```

`.env`는 `/opt/stack/services/public/myazit.kr/crawl-lens/.env`에 0600. git 제외(`.env*` gitignore).

PSI 키는 worker 컨테이너에만 노출(web에는 필요 없음).

### 8.2 로깅

- 두 컨테이너 모두 `pino` 기반 구조화 JSON 로그를 stdout으로 출력
- 호스트에서 `docker logs -f crawl-lens-web` / `docker logs -f crawl-lens-worker`로 확인
- 외부 로그 수집은 v2

### 8.3 메트릭 (Redis 카운터)

worker가 Redis에 누적:
- `metric:scan:done:{yyyy-mm-dd}`
- `metric:scan:failed:{yyyy-mm-dd}`
- `metric:psi:quota_used:{yyyy-mm-dd}`

매일 자정 TTL 만료. 별도 시계열 DB 도입하지 않음.

### 8.4 Rate limiting

- IP당 시간당 30회 제출 제한
- 키: `ratelimit:{ipHash}:{yyyy-mm-dd-hh}`, INCR + EXPIRE 3600
- 초과 시 `429 Too Many Requests` + 한국어 메시지
- `RATE_LIMIT_ALLOWLIST` 의 IP는 우회

### 8.5 robots.txt 정책

- v1: 대상 URL이 자체 robots.txt로 차단되어 있어도 검사는 진행. 단, 결과에 `technical.robots.disallowed` 항목을 fail로 표시
- 우리 크롤러가 외부에 보내는 요청: 대상 URL 1회 + robots.txt 1회 + sitemap.xml 1회 (있으면). 페이지당 ≤3회
- User-Agent: `crawl-lens/1.0 (+https://crawl-lens.myazit.kr)`

### 8.6 백업

- DB는 기존 호스트 PostgreSQL 백업 체계(`/opt/stack/backups/`)에 자동 포함
- PDF 캐시(`/opt/stack/data/crawl-lens/pdf/`)는 재생성 가능하므로 백업 대상 아님

### 8.7 배포

1. 로컬에서 `git push origin main`
2. 맥미니 `~/actions-runner-crawl-lens/`가 받음
3. `repo/scripts/deploy.sh` 실행:
   - `git fetch --prune origin && git reset --hard origin/main`
   - `docker compose --env-file ../.env -f repo/docker-compose.yml up -d --build --force-recreate --remove-orphans`
   - `docker image prune -f`
   - web 컨테이너 entrypoint가 `prisma migrate deploy`
   - `/api/health` 60초 헬스체크 (실패 시 배포 실패)

실패 시 이전 컨테이너가 살아남는지 여부: docker compose의 `--force-recreate`는 이전 컨테이너를 멈추고 새 것을 띄운다. 새 컨테이너가 안 뜨면 이전 컨테이너는 이미 사라진 상태. → **deploy.sh가 빌드 실패를 먼저 잡아내고**, 빌드 성공 후 force-recreate. 그래도 헬스체크 실패 시 알람은 GitHub Actions 빨강. (자동 롤백은 v1 범위 밖.)

### 8.8 docker-compose.yml 골자

```yaml
name: crawl-lens

services:
  web:
    build: .
    container_name: crawl-lens-web
    command: ["node", "server.js"]
    networks: [edge_shared]
    extra_hosts: ["host.docker.internal:host-gateway"]
    env_file: ["../.env"]
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:4500/api/health"]
      interval: 10s
      timeout: 5s
      retries: 6
    ports:
      - "127.0.0.1:4500:4500"

  worker:
    build: .
    container_name: crawl-lens-worker
    command: ["node", "worker/index.js"]
    networks: [edge_shared]
    extra_hosts: ["host.docker.internal:host-gateway"]
    env_file: ["../.env"]
    depends_on:
      web:
        condition: service_healthy
    volumes:
      - /opt/stack/data/crawl-lens/pdf:/data/pdf

networks:
  edge_shared:
    external: true
```

---

## 9. 테스트 전략

### 9.1 3계층 테스트

| 계층 | 도구 | 대상 | 실행 위치 |
|---|---|---|---|
| Unit | Vitest | 각 analyzer를 HTML fixture로 테스트, URL 정규화 함수, 점수 집계 함수 | GitHub-hosted runner (PR마다) |
| Integration | Vitest + testcontainers (Redis/PG) | POST /api/scan → worker 픽업 → JSON 응답까지. PSI는 mock | GitHub-hosted runner (PR마다) |
| E2E | Playwright | 홈 → URL 입력 → 진행 → 결과. PSI mock | GitHub-hosted runner (PR마다, 5분 이내) |

### 9.2 Fixture

- 디렉토리: `tests/fixtures/html/{good-meta, no-h1, broken-canonical, ...}.html`
- 새 검사 항목 추가 시 fixture + expected 추가가 변경 셋의 일부

### 9.3 외부 사이트 fetch 금지 (CI)

- 불안정 + 매너 문제
- `nock` 또는 `msw`로 HTTP 인터셉트
- PSI 응답도 mock

### 9.4 self-hosted runner와 CI runner 구분

- 테스트는 GitHub-hosted runner에서 실행
- 배포만 self-hosted runner

---

## 10. v2 확장 포인트

지금 만들지 않지만 충돌 없이 추가 가능한 형태로 v1을 설계.

| v2 기능 | v1에서 미리 한 것 | v2에서 할 것 |
|---|---|---|
| 사이트 크롤링 | analyzer 인터페이스가 페이지 단위 | `Crawl` 테이블 + 크롤러 워커 + URL frontier |
| 로그인/계정 | `Scan.userId?` 자리 비워둠 | 인증 (Auth.js), 익명 결과 귀속 마이그레이션 |
| 변동 추적/모니터링 | `Scan.parentScanId?` 자리, URL 정규화 일관 | 스케줄러 (BullMQ repeatable jobs), diff 뷰 |
| 이메일 리포트 | 결과 페이지 자체가 PDF로 변환됨 | 발송 큐 + SMTP/Resend 연동 + 구독 모델 |
| SPA 렌더링 | fetcher가 인터페이스로 추상화 | worker 이미지에 Playwright(Chromium은 이미 PDF용으로 있음) |
| 접근성 검사 | 5번째 카테고리 추가는 점수 가중치만 재배분 | axe-core 통합 |
| 영어 UI | i18n 키 분리 | 영어 매핑 추가 |
| 항목별 통계 | `checks[].id`가 안정적 식별자 | `CheckResult` 테이블로 분해 마이그레이션 |

---

## 11. 결정 사항 요약

| 영역 | 결정 |
|---|---|
| 타깃 | 개인 블로거 + 개발자 동시 (친절한 설명 + 기술적 정확성) |
| 분석 단위 | MVP는 단일 URL, 모듈 경계는 사이트 크롤링 대비 |
| 검사 범위 | 메타 / 콘텐츠 / 기술 / 성능(PSI) 4개 카테고리 |
| 점수 | 카테고리 평균 100점, 부분 실패는 분모 재정규화 |
| 결과 | 점수보다 항목별 Pass/Warn/Fail 리스트 중심 |
| 사용 흐름 | 익명 + 공유 URL (`/r/{publicId}`). 로그인은 v2 |
| 스택 | Next.js + TypeScript + BullMQ + Prisma + Puppeteer |
| 인프라 | OrbStack + 호스트 Postgres/Redis + Caddy + Cloudflare Tunnel |
| 도메인/포트 | `crawl-lens.myazit.kr` / `4500` |
| 컨테이너 | web, worker 2개 (같은 이미지, command 다름) |
| 폴링 | 1초 간격, 30초 후 backoff |
| publicId | nanoid 10자 |
| 결과 저장 | `Scan` 단일 테이블, `checks`는 JSONB |
| Rate limit | IP 시간당 30회 (Redis) |
| robots.txt | 검사 진행 + 경고 표시 (v1) |
| 배포 | self-hosted runner, main push → deploy.sh |
| 백업 | 호스트 Postgres 백업 체계 자동 포함 |
| 다국어 | v1 한국어만, 키 구조만 분리 |
| 외부 analytics | 미사용 |
