export interface ErrorDetail {
  field: string;
  message: string;
}

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: ErrorDetail[];

  constructor(statusCode: number, code: string, message: string, details?: ErrorDetail[]) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const unauthorized = (message = 'Authentication is required.') =>
  new AppError(401, 'UNAUTHENTICATED', message);

export const invalidCredentials = () =>
  new AppError(401, 'INVALID_CREDENTIALS', 'The email or password is incorrect.');

export const accountInactive = () =>
  new AppError(403, 'ACCOUNT_INACTIVE', 'This account is not active. Contact the institute administrator.');

export const forbidden = (message = 'You do not have permission to perform this action.') =>
  new AppError(403, 'FORBIDDEN', message);

export const notFound = (message = 'The requested record was not found.') =>
  new AppError(404, 'NOT_FOUND', message);

export const conflict = (message: string) => new AppError(409, 'CONFLICT', message);

export const businessRule = (message: string) =>
  new AppError(422, 'BUSINESS_RULE_VIOLATION', message);

export const validationError = (details: ErrorDetail[], message = 'The request contains invalid fields.') =>
  new AppError(400, 'VALIDATION_ERROR', message, details);

export const rateLimited = (message = 'Too many requests. Please try again later.') =>
  new AppError(429, 'RATE_LIMITED', message);

export const internalError = () => new AppError(500, 'INTERNAL_ERROR', 'An unexpected error occurred.');
