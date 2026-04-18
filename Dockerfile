FROM node:22-slim AS base
RUN corepack enable pnpm

WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm db:migrate

EXPOSE 5173
CMD ["pnpm", "dev", "--host", "0.0.0.0"]
