# Imagem de produção da API. Build a partir da raiz do monorepo:
#   docker build -f apps/api/Dockerfile -t supplysync-api .

FROM node:22-bookworm-slim AS build
WORKDIR /repo
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/mobile/package.json apps/mobile/
COPY apps/api/prisma apps/api/prisma
RUN npm ci --workspace @supplysync/api --workspace @supplysync/shared --include-workspace-root
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @supplysync/api && npm prune --omit=dev --workspace @supplysync/api

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl tini && rm -rf /var/lib/apt/lists/* \
  && useradd --system --uid 10001 --home /app supplysync
COPY --from=build --chown=supplysync /repo/node_modules ./node_modules
COPY --from=build --chown=supplysync /repo/apps/api/dist ./dist
COPY --from=build --chown=supplysync /repo/apps/api/prisma ./prisma
COPY --from=build --chown=supplysync /repo/apps/api/package.json ./package.json
# Processo sem privilégios de root.
USER supplysync
EXPOSE 3333
ENTRYPOINT ["/usr/bin/tini", "--"]
# Migrações rodam como etapa separada do deploy (ver docs/DEPLOY.md), nunca no boot de cada réplica.
CMD ["node", "dist/server.js"]
