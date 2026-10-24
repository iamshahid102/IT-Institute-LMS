import { createApp } from './app';

/**
 * Vercel Function entry point.
 *
 * Vercel recognises an Express app exported as the default export from `src/index.ts`
 * and routes every request for the project to this single function, running on Fluid
 * compute. Express then matches the *original* path, so `/api/v1/*` and `/health`
 * keep working exactly as they do locally.
 *
 * `server.ts` stays the long-running local entry (`app.listen`) used by `npm run dev`
 * and `npm start`; it is never imported from here.
 */
export default createApp();
