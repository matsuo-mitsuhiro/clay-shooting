# ============================================================
# Multi-stage Dockerfile for clay-shooting
#
# - dev:    ホットリロード開発用（docker-compose のデフォルト）
# - runner: 本番相当ビルド（パリティ確認用、本番はVercelで動作）
# ============================================================

# ===== Base =====
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# ===== Dependencies =====
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# ===== Development（ホットリロード）=====
FROM base AS dev
ENV NODE_ENV=development
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Windows 上の Docker Desktop でファイル変更を確実に検知するための polling 設定
ENV WATCHPACK_POLLING=true
ENV CHOKIDAR_USEPOLLING=true
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev:docker"]

# ===== Production builder =====
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build:next

# ===== Production runner =====
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
EXPOSE 3000
CMD ["npm", "run", "start"]
