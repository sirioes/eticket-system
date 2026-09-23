import { readFileSync } from 'fs';
import type { ConnectionOptions } from 'tls';
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client';

function buildSsl(): ConnectionOptions | undefined {
  if (!process.env.DB_SSL_CA) return undefined;
  return { ca: readFileSync(process.env.DB_SSL_CA), checkServerIdentity: () => undefined };
}

function buildAdapter() {
  const url = new URL(process.env.DATABASE_URL ?? '');
  return new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    ssl: buildSsl(),
    connectTimeout: 15000,
    acquireTimeout: 20000,
  });
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({ adapter: buildAdapter() });
  }

  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}