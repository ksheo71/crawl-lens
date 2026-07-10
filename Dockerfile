# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
# Dummy build-time values. Next.js's zod env validation runs during `next build`.
# These never leak to the runtime image (separate stage), and they are NOT secrets.
ARG DATABASE_URL=postgresql://build:build@localhost/build
ARG REDIS_URL=redis://localhost:6379
ARG PSI_API_KEY=build-placeholder
ARG PUBLIC_BASE_URL=http://localhost:4500
ARG IP_HASH_SALT=build-placeholder-salt-32c
ENV DATABASE_URL=${DATABASE_URL} \
    REDIS_URL=${REDIS_URL} \
    PSI_API_KEY=${PSI_API_KEY} \
    PUBLIC_BASE_URL=${PUBLIC_BASE_URL} \
    IP_HASH_SALT=${IP_HASH_SALT}
RUN npm run build
# Compile worker to CJS, then rewrite @/* path aliases to real relative paths
# (Node has no concept of TS path aliases at runtime).
RUN npx tsc -p tsconfig.worker.json && npx tsc-alias -p tsconfig.worker.json

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache \
  chromium nss freetype harfbuzz ca-certificates ttf-freefont \
  font-noto-cjk fontconfig \
  libstdc++ libgcc \
  openssl \
  && fc-cache -f
COPY --from=deps /app/node_modules ./node_modules
# Prisma client was generated in the build stage; deps stage doesn't have it.
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/.next ./.next
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.ts ./next.config.ts
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh
EXPOSE 4500
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node_modules/.bin/next", "start", "-p", "4500"]
