# ============================================
# Homara Backend — Production Dockerfile
# ============================================

FROM node:22-alpine

WORKDIR /app

# Install dependencies (including devDependencies for tsx and Prisma)
COPY package*.json ./
RUN npm ci || npm install

# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy the rest of the backend files
COPY . .

# Compile TypeScript
RUN npm run build

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/ || exit 1

EXPOSE 5000

ENV NODE_ENV=production
ENV PORT=5000

# Use tsx to run the entrypoint (needed for Prisma v7 .ts generated files)
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && npx tsx prisma/seed.ts && npx tsx src/infrastructure/entrypoints/api.ts"]
