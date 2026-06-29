#!/bin/sh
set -e
if [ "$RUN_MIGRATIONS" = "1" ]; then
  npx prisma migrate deploy
fi
exec "$@"
