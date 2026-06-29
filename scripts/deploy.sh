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
