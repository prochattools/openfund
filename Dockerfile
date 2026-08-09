# =====================================
# ChurchFinance - Next.js + Prisma Dockerfile (final version)
# Works on macOS + Linux (Dokploy safe)
# =====================================

# ---------- Build Stage ----------
FROM node:20-bullseye AS builder
WORKDIR /app

# Copy dependency files
COPY package*.json .npmrc ./

# Install dependencies (including devDeps for Tailwind + Prisma)
RUN npm ci --ignore-scripts || npm install --ignore-scripts

# Copy app source
COPY . .

# Compile the client with the same auth mode used by production runtime.
# Clerk stays available as an optional public client key, but Finance is owner-configured with auth disabled.
ARG NEXT_PUBLIC_AUTH_PROVIDER=disabled
ENV NEXT_PUBLIC_AUTH_PROVIDER=$NEXT_PUBLIC_AUTH_PROVIDER
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

# Generate Prisma client
RUN npx prisma generate

# Build production output
RUN DISABLE_TS_CHECK=1 SKIP_ENV_VALIDATION=1 npm run build

# ---- New Relic deps (isolated, no npm cache in final image) ----
FROM node:20-slim AS newrelic-deps
WORKDIR /nr
RUN echo '{"dependencies":{"newrelic":"^13.18.0"}}' > package.json
RUN npm install --omit=dev --ignore-scripts

# ---------- Runtime Stage ----------
FROM node:20-slim AS runner
WORKDIR /app

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ARG BUILD_SHA=unknown
ARG BUILD_REF=unknown

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV NODE_PATH=/app/node_modules
ENV BUILD_SHA=$BUILD_SHA
ENV BUILD_REF=$BUILD_REF

# Copy necessary runtime files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/scripts/start-prod.mjs ./scripts/start-prod.mjs
COPY --from=builder /app/scripts/production-email-send-verify.mjs ./scripts/production-email-send-verify.mjs
COPY --from=newrelic-deps /nr/node_modules ./node_modules

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/api/health', res => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "scripts/start-prod.mjs"]
