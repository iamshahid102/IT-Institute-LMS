import pinoHttp from 'pino-http';
import type { IncomingMessage } from 'node:http';
import { logger } from '../lib/logger';
import { env } from '../config/env';

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req: IncomingMessage) => (req as IncomingMessage & { requestId?: string }).requestId ?? '',
  autoLogging: {
    ignore: (req) => req.url === '/health' || req.url === '/health/ready',
  },
  customLogLevel: (_req, res, error) => {
    if (error || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return env.isTest ? 'silent' : 'info';
  },
  serializers: {
    req: (req: { method?: string; url?: string; id?: string }) => ({
      method: req.method,
      url: req.url,
      id: req.id,
    }),
    res: (res: { statusCode?: number }) => ({ statusCode: res.statusCode }),
  },
});
