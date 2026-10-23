import type { Prisma } from '@prisma/client';

export type TxClient = Prisma.TransactionClient;

/**
 * Allocates the next value for a yearly sequence inside a transaction so that
 * concurrent admissions or payments can never receive the same business number.
 */
export async function nextSequence(tx: TxClient, name: string): Promise<number> {
  const counter = await tx.counter.upsert({
    where: { name },
    create: { name, value: 1 },
    update: { value: { increment: 1 } },
    select: { value: true },
  });
  return counter.value;
}

export async function nextBusinessNumber(
  tx: TxClient,
  kind: 'student' | 'invoice' | 'receipt' | 'certificate',
  prefix: string,
  date = new Date(),
): Promise<string> {
  const year = date.getUTCFullYear();
  const value = await nextSequence(tx, `${kind}:${year}`);
  return `${prefix}-${year}-${String(value).padStart(6, '0')}`;
}
