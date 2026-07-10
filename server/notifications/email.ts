import nodemailer from 'nodemailer';
import type { Env } from '../../types/env.js';
import { logger } from '../logging.js';

export interface OrderNotificationEmail {
  subject: string;
  text: string;
  html?: string;
}

function hasSmtpConfig(env: Env): boolean {
  return !!(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASSWORD);
}

export async function sendOrderNotificationEmail(
  env: Env,
  email: OrderNotificationEmail,
): Promise<void> {
  if (!hasSmtpConfig(env)) {
    logger.warn('SMTP not configured — skipping order email notification', { subject: email.subject });
    return;
  }

  const ccRecipient = env.ORDER_NOTIFICATION_EMAIL_CC || 'woodworkwebsites+UTC@gmail.com';
  const toRecipient = env.ORDER_NOTIFICATION_EMAIL_TO || ccRecipient;
  const shouldCc = toRecipient !== ccRecipient;
  const secure = env.SMTP_SECURE === 'true' || env.SMTP_PORT === '465';

  try {
    const transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT),
      secure,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASSWORD,
      },
    });

    await transport.sendMail({
      from: env.SMTP_FROM || env.SMTP_USER,
      to: toRecipient,
      ...(shouldCc ? { cc: ccRecipient } : {}),
      subject: email.subject,
      text: email.text,
      ...(email.html ? { html: email.html } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Order notification email failed', { error: message, subject: email.subject });
  }
}
