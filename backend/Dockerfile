FROM node:24.22.1-bookworm-slim AS builder

RUN apt-get update \
    && apt-get install -y --no-install-recommends --only-upgrade apt libapt-pkg6.0 \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g npm@11.21.2 \
    && npm cache clean --force

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npx prisma generate --config prisma7.config.ts

RUN npm run build

FROM builder AS migrate

USER node

CMD ["npx", "prisma", "migrate", "deploy", "--config", "prisma7.config.ts"]

FROM node:24.22.1-bookworm-slim AS runner

RUN apt-get update \
    && apt-get install -y --no-install-recommends --only-upgrade apt libapt-pkg6.0 \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/* \
    && npm install -g npm@11.21.2 \
    && npm cache clean --force \
    && groupadd -r app \
    && useradd -r -g app -M -s /usr/sbin/nologin app

ENV NODE_ENV=production
ENV TZ=Asia/Makassar
ENV PORT=3001

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

RUN mkdir -p uploads \
    && chown app:app uploads

USER app

EXPOSE 3001

CMD ["node", "dist/main"]