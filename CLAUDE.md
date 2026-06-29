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
