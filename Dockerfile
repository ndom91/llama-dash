FROM node:22-slim AS base
RUN corepack enable pnpm
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

FROM base AS build
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM base AS amdgpu-top
ARG AMDGPU_TOP_VERSION=0.11.3
ARG TARGETARCH
RUN mkdir -p /opt/amdgpu_top && \
    if [ "$TARGETARCH" = "amd64" ]; then \
      apt-get update && apt-get install -y --no-install-recommends curl ca-certificates && \
      curl -fsSL "https://github.com/Umio-Yasuno/amdgpu_top/releases/download/v${AMDGPU_TOP_VERSION}/amdgpu_top-${AMDGPU_TOP_VERSION}-x86_64-unknown-linux-musl.tar.gz" \
        | tar -xz -C /opt/amdgpu_top --strip-components=1 && \
      rm -rf /var/lib/apt/lists/*; \
    fi

FROM base
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY --from=amdgpu-top /opt/amdgpu_top/ /usr/local/bin/
COPY package.json prod-server.mjs ./

EXPOSE 3000
CMD ["node", "prod-server.mjs"]
