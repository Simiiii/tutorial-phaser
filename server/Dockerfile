# ── Stage 1: install dependencies ─────────────────────────────────────────────
FROM node:lts-alpine AS deps
WORKDIR /app
RUN apk add --no-cache git
COPY package*.json ./
RUN npm install

# ── Stage 2: production image ──────────────────────────────────────────────────
FROM node:lts-alpine AS production
ENV NODE_ENV=production
WORKDIR /app

# Non-root user
RUN addgroup --system colyseus \
    && adduser --system --ingroup colyseus colyseus

# git is required by some npm install hooks on Alpine
RUN apk add --no-cache git

# Prod-only deps, plus tsx added separately.
# tsx is used instead of running compiled JS because the tsconfig outputs ESNext
# modules without .js extensions, which Node.js ESM requires. tsx handles
# TypeScript resolution natively without that constraint.
COPY package*.json ./
RUN npm install --omit=dev
RUN npm install -g tsx

COPY tsconfig.json ./
COPY src/ ./src/

USER colyseus
EXPOSE 2567
CMD ["tsx", "src/index.ts"]
