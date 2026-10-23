import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../lib/logger';

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.smtpConfigured) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      ...(env.SMTP_USER && env.SMTP_PASS
        ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } }
        : {}),
    });
  }
  return transporter;
}

/**
 * Returns true only when the provider accepted the message. Callers must not
 * claim an email was delivered when this returns false.
 */
export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
  const transport = getTransporter();
  if (!transport) {
    logger.warn({ to }, 'SMTP is not configured; password reset email was not sent');
    return false;
  }

  try {
    await transport.sendMail({
      from: env.SMTP_FROM,
      to,
      subject: 'Reset your IT Institute portal password',
      text: [
        'A password reset was requested for your IT Institute account.',
        '',
        `Open this single-use link within one hour: ${resetUrl}`,
        '',
        'If you did not request this, you can ignore this email.',
      ].join('\n'),
      html: `<p>A password reset was requested for your IT Institute account.</p>
<p><a href="${resetUrl}">Reset your password</a> (single use, expires in one hour).</p>
<p>If you did not request this, you can ignore this email.</p>`,
    });
    return true;
  } catch (error) {
    logger.error({ err: error }, 'Failed to send password reset email');
    return false;
  }
}
