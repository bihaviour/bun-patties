# syntax=docker/dockerfile:1
# Multi-stage build for a Patties app on the `bun` adapter.
# Build:  docker build -t {{name}} .
# Run:    docker run -p 3000:3000 {{name}}

FROM oven/bun:1.3 AS base
WORKDIR /app

# --- deps: install once, cached on package.json changes ---
FROM base AS deps
COPY package.json bun.lock* ./
RUN bun install

# --- build: produce the production server bundle in .patties/ ---
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bunx patties build --target bun

# --- release: minimal runtime image ---
FROM base AS release
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.patties ./.patties
COPY package.json ./
EXPOSE 3000
CMD ["bun", ".patties/server/server-entry.js"]
