# syntax = docker/dockerfile:1

ARG NODE_VERSION=20-slim
FROM node:${NODE_VERSION} as base

WORKDIR /app
ENV NODE_ENV="production"

# Build stage
FROM base as build

# Install dependencies needed for node-gyp if any
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential pkg-config python-is-python3

COPY package-lock.json package.json ./
RUN npm ci --include=dev

COPY . .
RUN npm run build
RUN npm prune --omit=dev

# Production runner stage
FROM base

COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/dist /app/dist
COPY --from=build /app/server.mjs /app/server.mjs

EXPOSE 8080
ENV PORT=8080

CMD ["node", "server.mjs"]
