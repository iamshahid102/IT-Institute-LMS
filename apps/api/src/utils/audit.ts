import type { Prisma, Role } from '@prisma/client';
import { logger } from '../lib/logger';
import { sha256 } from './crypto';

export interface AuditInput {
  actorId?: string | null;
  actorRole?: Role | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  requestId?: string | null;
  ip?: string | null;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Audit writes are best-effort: a failure to record an audit row must not roll
 * back the business operation that already succeeded, but it must be visible in
 * the server log for investigation.
 */
export async function recordAudit(
  db: { auditLog: { create: (args: Prisma.AuditLogCreateArgs) => Promise<unknown> } },
  input: AuditInput,
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        actorRole: input.actorRole ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        requestId: input.requestId ?? null,
        ipHash: input.ip ? sha256(input.ip) : null,
        metadata: input.metadata,
      },
    });
  } catch (error) {
    logger.error({ err: error, action: input.action, entityType: input.entityType }, 'Failed to write audit log');
  }
}
