# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS base
RUN apk add --no-cache postgresql16-client age curl
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

# --- Deps stage ---
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json apps/web/
COPY packages packages
RUN pnpm install --frozen-lockfile

# --- Builder stage ---
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages ./packages
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* vars are baked into the client bundle by `next build`. The
# auth client falls back to localhost:3000 if NEXT_PUBLIC_APP_URL is unset
# at build time, which then tries to make CORS calls to localhost from the
# deployed origin. The CI workflow passes this via --build-arg.
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
RUN pnpm --filter @opentab/web build

# --- Runner stage ---
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Web entrypoint
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/web/scripts ./apps/web/scripts
COPY --from=builder /app/apps/web/worker.ts ./apps/web/worker.ts
COPY --from=builder /app/apps/web/lib ./apps/web/lib
COPY --from=builder /app/apps/web/instrumentation.ts ./apps/web/instrumentation.ts
# tsx resolves the `@/*` path alias via tsconfig.json at runtime — the
# worker (run via `tsx ./worker.ts`) imports `@/lib/...` and breaks
# without it.
COPY --from=builder /app/apps/web/tsconfig.json ./apps/web/tsconfig.json

WORKDIR /app/apps/web
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD curl --fail http://localhost:3000/api/healthz || exit 1
CMD ["pnpm", "start"]
