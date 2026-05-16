# ── Stage 1: build the Vite app ───────────────────────────────────────────────
FROM node:lts-alpine AS builder
WORKDIR /app
RUN apk add --no-cache git
COPY package*.json ./
RUN npm install
COPY . .
# Vite uses esbuild, which strips `import type` declarations before module
# resolution, so server source files are not needed here despite the imports
# in the scene files.
RUN npm run build

# ── Stage 2: serve with nginx ──────────────────────────────────────────────────
FROM nginx:alpine AS production
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
