# Multi-stage build. bookworm-slim (glibc) rather than alpine so better-sqlite3
# uses its prebuilt binaries instead of compiling from source.

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./

# SQLite lives on a volume mounted at /data (see docker-compose.yml).
RUN mkdir -p /data && chown node:node /data
USER node
ENV DATABASE_URL=/data/splatbook.db
ENV PORT=3000
EXPOSE 3000

CMD ["node", "build"]
