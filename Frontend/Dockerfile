# ─────────────────────────────────────────────────────────────
# FreshSense AI — Frontend Dockerfile
# React/Vite — Multi-Stage Production Build
# Served via Nginx:alpine
# ─────────────────────────────────────────────────────────────

# ── Stage 1: Build ──
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --silent

# Copy source code
COPY . .

# Build production bundle
RUN npm run build

# ── Stage 2: Serve with Nginx ──
FROM nginx:alpine

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx config for SPA routing + API proxy
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
