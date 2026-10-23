import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { AppError } from '../utils/errors';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(404, 'NOT_FOUND', `No route matches ${req.method} ${req.path}.`));
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred.';
  let details: Array<{ field: string; message: string }> | undefined;

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;
    details = error.details;
  } else if (error instanceof ZodError) {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = 'The request contains invalid fields.';
    details = error.issues.map((issue) => ({
      field: issue.path.length > 0 ? issue.path.join('.') : 'request',
      message: issue.message,
    }));
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      statusCode = 409;
      code = 'CONFLICT';
      message = 'A record with these unique values already exists.';
    } else if (error.code === 'P2025') {
      statusCode = 404;
      code = 'NOT_FOUND';
      message = 'The requested record was not found.';
    } else if (error.code === 'P2003') {
      statusCode = 409;
      code = 'CONFLICT';
      message = 'This record is referenced by other records and cannot be changed this way.';
    }
  } else if (error instanceof SyntaxError && 'body' in error) {
    statusCode = 400;
    code = 'BAD_REQUEST';
    message = 'The request body is not valid JSON.';
  }

  if (statusCode >= 500) {
    logger.error(
      { err: error, requestId: req.requestId, method: req.method, path: req.path },
      'Unhandled request error',
    );
    if (env.isProduction) {
      message = 'An unexpected error occurred.';
    }
  }

  res.status(statusCode).json({
    error: {
      code,
      message,
      ...(details ? { details } : {}),
      requestId: req.requestId,
    },
  });
};
