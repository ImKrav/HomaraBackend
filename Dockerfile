# ============================================
# Homara Backend — Production Dockerfile
# ============================================
# Multi-stage build: deps → builder → production
#   - Stage "deps":     installs all npm dependencies (incl. dev for tsx/prisma)
#   - Stage "builder":  generates the Prisma client + type-checks the source
#   - Stage "production": minimal runtime image with source + generated client
#
# Build:
#   docker build -t homara-backend .
# Run (recommended via docker compose):
#   docker compose up -d
# ============================================

# ── Stage 1: Install dependencies ──
FROM node:22-alpine AS deps
WORKDIR /app

# openssl is required by @prisma/client + @prisma/adapter-pg
RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci

# ── Stage 2: Generate Prisma client + type-check ──
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

# Generate the Prisma client (output goes to src/generated/prisma)
RUN npx prisma generate

# Type-check the source code (no emit — we run via tsx at runtime per AGENTS.md)
RUN npx tsc --noEmit

# ── Stage 3: Production runtime ──
FROM node:22-alpine AS production
WORKDIR /app

# openssl for Prisma; wget for the healthcheck
RUN apk add --no-cache openssl wget

ENV NODE_ENV=production
ENV PORT=5000

# Copy node_modules (dev deps are required: tsx, prisma, typescript)
COPY --from=deps /app/node_modules ./node_modules

# Copy application source (includes the generated Prisma client) + prisma schema
COPY --from=builder /app/src ./src
COPY --from=builder /app/prisma ./prisma
COPY package*.json tsconfig.json ./

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/ || exit 1

EXPOSE 5000

# On startup: push schema (idempotent), seed (skips if data exists), start API.
# Uses the package.json `start` script, which is: db push → seed → api.
CMD ["npm", "start"]
