import { Router } from 'express';
import { getAuth, requireAuth, requirePermission } from '../../middleware/auth';
import { prisma } from '../../lib/prisma';
import { recordAudit } from '../../utils/audit';
import { conflict } from '../../utils/errors';
import { parseBody } from '../../utils/validate';
import { updateSettingsSchema } from './settings.schemas';
import { getSettings } from './settings.service';

export const settingsRouter = Router();

settingsRouter.get('/', requireAuth, requirePermission('settings.read'), async (_req, res) => {
  const settings = await getSettings();
  res.json({ data: settings });
});

settingsRouter.patch('/', requireAuth, requirePermission('settings.manage'), async (req, res) => {
  const auth = getAuth(req);
  const body = parseBody(updateSettingsSchema, req);
  const current = await getSettings();

  if (body.currency && body.currency !== current.currency) {
    const postedFinance = await prisma.invoice.count();
    if (postedFinance > 0) {
      throw conflict(
        'The currency cannot be changed after invoices have been issued. Keep the current currency and start a new environment for a different currency.',
      );
    }
  }

  const updated = await prisma.instituteSetting.update({
    where: { id: 'default' },
    data: {
      ...body,
      ...(body.email !== undefined ? { email: body.email === '' ? null : body.email } : {}),
    },
  });

  await recordAudit(prisma, {
    actorId: auth.userId,
    actorRole: auth.role,
    action: 'SETTINGS_UPDATED',
    entityType: 'InstituteSetting',
    entityId: 'default',
    requestId: req.requestId,
    ip: req.ip,
    metadata: { fields: Object.keys(body) },
  });

  res.json({ data: updated });
});
