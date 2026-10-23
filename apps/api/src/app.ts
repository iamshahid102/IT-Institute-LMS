import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { prisma } from './lib/prisma';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { httpLogger } from './middleware/http-logger';
import { requestId } from './middleware/request-context';
import { ensureCsrfCookie } from './middleware/csrf';
import { requireCsrf } from './middleware/csrf';
import { noStore } from './middleware/request-context';
import { apiLimiter } from './middleware/rate-limit';
import { apiRouter } from './routes';

export function createApp(): express.Express {
  const app = express();

  if (env.TRUST_PROXY) app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || env.allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error('Origin is not allowed by CORS.'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Request-Id', 'Idempotency-Key'],
      exposedHeaders: ['X-Request-Id'],
      maxAge: 600,
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(requestId);
  app.use(httpLogger);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'lms-api' });
  });

  app.get('/health/ready', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ready' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });

  app.use('/api/v1', noStore, apiLimiter, ensureCsrfCookie, requireCsrf, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
