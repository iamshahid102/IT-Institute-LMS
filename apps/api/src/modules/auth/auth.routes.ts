import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { loginLimiter, passwordResetLimiter } from '../../middleware/rate-limit';
import * as controller from './auth.controller';

export const authRouter = Router();

authRouter.get('/csrf', controller.getCsrfToken);
authRouter.post('/login', loginLimiter, controller.login);
authRouter.post('/logout', requireAuth, controller.logout);
authRouter.post('/logout-all', requireAuth, controller.logoutAllSessions);
authRouter.get('/me', requireAuth, controller.me);
authRouter.post('/forgot-password', passwordResetLimiter, controller.forgotPassword);
authRouter.post('/reset-password', passwordResetLimiter, controller.resetPassword);
authRouter.patch('/change-password', requireAuth, controller.changePassword);
