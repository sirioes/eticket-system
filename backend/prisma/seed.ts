import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import * as bcrypt from 'bcrypt';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';
import { Role } from '../src/common/enums/role.enum';
import { Divisi } from '../src/common/enums/divisi.enum';
import { isValidRoleDivisiCombo } from '../src/common/enums/role-divisi-validator';
import type { ConnectionOptions } from 'tls';

function buildSsl(): ConnectionOptions | undefined {
  if (!process.env.DB_SSL_CA) return undefined;
  return { ca: fs.readFileSync(process.env.DB_SSL_CA), checkServerIdentity: () => undefined };
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
  });
}

const prisma = new PrismaClient({ adapter: buildAdapter() });

function normalizeFullName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

async function main() {
  const csvPath = path.join(__dirname, 'users.csv');
  const raw = fs.readFileSync(csvPath, 'utf-8');
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean);

  let created = 0, updated = 0, failed = 0;

  for (const line of lines) {
    const [fullNameRaw, roleRaw, divisiRaw, password] = line.split(',');
    const fullName = normalizeFullName(fullNameRaw ?? '');
    const role = roleRaw as Role;
    const divisi = divisiRaw?.trim() ? (divisiRaw.trim() as Divisi) : null;

    if (!fullName || !Object.values(Role).includes(role)) {
      console.warn(`SKIP (data tidak valid): ${line}`);
      failed++;
      continue;
    }

    if (!isValidRoleDivisiCombo(role, divisi)) {
      console.warn(`SKIP (kombinasi role↔divisi tidak sah): ${fullName} — ${role} / ${divisi}`);
      failed++;
      continue;
    }

    const existing = await prisma.user.findUnique({ where: { fullName } });

    if (existing) {
      await prisma.user.update({
        where: { fullName },
        data: { divisi: divisi ?? null, role },
      });
      updated++;
    } else {
      const hashed = await bcrypt.hash(password, 10);
      await prisma.user.create({
        data: { fullName, role, divisi: divisi ?? null, password: hashed },
      });
      created++;
    }
  }

  console.log(`Seeder selesai: ${created} created, ${updated} updated, ${failed} failed`);

  const nonFinanceDivisi = Object.values(Divisi).filter((d) => d !== Divisi.FINANCE);
  for (const divisi of nonFinanceDivisi) {
    const count = await prisma.user.count({
      where: { divisi, role: Role.MANAGER_MAIN_OFFICE, isActive: true },
    });
    if (count === 0) console.warn(`⚠️  Divisi ${divisi} belum punya manager aktif!`);
  }
  const financeManagerCount = await prisma.user.count({
    where: { divisi: Divisi.FINANCE, role: Role.FINANCE_MANAGER_MAIN_OFFICE, isActive: true },
  });
  if (financeManagerCount === 0) console.warn(`⚠️  Divisi FINANCE belum punya manager aktif!`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });