FROM node:24.22.1-bookworm-slim AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

FROM node:24.22.1-bookworm-slim AS runner

RUN groupadd -r app \
    && useradd -r -g app -M -s /usr/sbin/nologin app

ENV NODE_ENV=production
ENV TZ=Asia/Makassar
ENV PORT=3000

WORKDIR /app

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

RUN chown -R app:app /app

USER app

EXPOSE 3000

CMD ["node", "server.js"]