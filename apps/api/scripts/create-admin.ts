/**
 * Bootstraps the first Super Admin. Intended for a fresh environment only.
 *
 *   SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... npm run seed:admin -w @lms/api
 *
 * There is deliberately no default password. Refuses to run if any Super Admin
 * already exists, so it cannot be used to silently add privileged accounts later.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hash as argonHash } from '@node-rs/argon2';
import { z } from 'zod';

const prisma = new PrismaClient();

const schema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z
    .string()
    .min(10, 'Password must be at least 10 characters.')
    .max(128)
    .regex(/[A-Za-z]/, 'Password must contain a letter.')
    .regex(/\d/, 'Password must contain a number.'),
  name: z.string().trim().min(2),
});

async function main() {
  const parsed = schema.safeParse({
    email: process.env.SEED_ADMIN_EMAIL ?? '',
    password: process.env.SEED_ADMIN_PASSWORD ?? '',
    name: process.env.SEED_ADMIN_NAME ?? 'Institute Administrator',
  });

  if (!parsed.success) {
    console.error('Bootstrap configuration is invalid:');
    for (const issue of parsed.error.issues) console.error(`- ${issue.path.join('.')}: ${issue.message}`);
    console.error('Set SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD and optionally SEED_ADMIN_NAME.');
    process.exitCode = 1;
    return;
  }

  const existing = await prisma.user.count({ where: { role: 'SUPER_ADMIN', status: 'ACTIVE' } });
  if (existing > 0) {
    console.error('An active Super Admin already exists. Refusing to bootstrap another privileged account.');
    process.exitCode = 1;
    return;
  }

  const passwordHash = await argonHash(parsed.data.password, {
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      fullName: parsed.data.name,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
      passwordHash,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      actorRole: 'SUPER_ADMIN',
      action: 'BOOTSTRAP_SUPER_ADMIN',
      entityType: 'User',
      entityId: user.id,
      metadata: { source: 'create-admin-script' },
    },
  });

  console.log(`Created Super Admin ${user.email}. Sign in and change the password immediately.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
