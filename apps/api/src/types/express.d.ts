import type { AuthContext } from './auth';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      auth?: AuthContext;
    }
  }
}

export {};
