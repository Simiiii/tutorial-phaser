# ── Stage 0: development (hot-reload with tsx watch) ──────────────────────────
FROM node:lts-alpine AS dev
WORKDIR /app
RUN apk add --no-cache git
COPY package*.json ./
RUN npm install           # all deps including tsx devDependency
COPY tsconfig.json ./
COPY src/ ./src/
EXPOSE 2567
# --watch src watches the whole src/ directory, not just statically imported files.
# app.config.ts is loaded dynamically by @colyseus/tools so tsx needs the explicit flag.
CMD ["npx", "tsx", "watch", "--watch", "src", "src/index.ts"]

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
