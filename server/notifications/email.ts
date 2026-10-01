import nodemailer from 'nodemailer';
import type { Env } from '../../types/env.js';
import type { Order } from '../../types/index.js';
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


function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function sendCustomerOrderConfirmationEmail(env: Env, order: Order): Promise<void> {
  if (!hasSmtpConfig(env) || !order.customerEmail || order.customerEmail === 'unknown') {
    logger.warn('Customer order confirmation email skipped', { orderId: order.id });
    return;
  }

  const orderRef = order.id.slice(0, 8).toUpperCase();
  const items = order.items ?? [];
  const itemLines = items.map((item) => [
    `${item.quantity} × ${item.title} (${item.color}, ${item.size})`,
    item.personalization ? `Personalisation: ${item.personalization}` : '',
  ].filter(Boolean).join('\n  '));
  const text = [
    'Thanks for your order.',
    `Order reference: ${orderRef}`,
    '',
    'Items:',
    ...itemLines.map((line) => `- ${line}`),
    '',
    `Total: ${new Intl.NumberFormat('en-GB', { style: 'currency', currency: order.currency.toUpperCase() }).format(order.amountTotal / 100)}`,
  ].join('\n');

  const htmlItems = items.map((item) => `
    <li style="margin:0 0 16px;">
      <strong>${escapeHtml(item.quantity + ' × ' + item.title)}</strong>
      <div style="color:#667085;">${escapeHtml(item.color)} · ${escapeHtml(item.size)}</div>
      ${item.personalization ? `<div style="margin-top:6px;padding:8px 10px;border-radius:8px;background:#fff7ed;color:#7c2d12;"><strong>Personalisation:</strong> ${escapeHtml(item.personalization).replace(/\n/g, '<br />')}</div>` : ''}
    </li>
  `).join('');
  const html = `<!doctype html>
<html lang="en"><body style="margin:0;background:#f4f1ea;font-family:Arial,sans-serif;color:#0b1531;">
  <main style="max-width:600px;margin:24px auto;padding:28px;background:#fff;border-radius:18px;">
    <h1 style="margin-top:0;">Thanks for your order</h1>
    <p>Order reference: <strong>${escapeHtml(orderRef)}</strong></p>
    <h2 style="font-size:16px;">Your items</h2>
    <ul style="padding-left:20px;">${htmlItems}</ul>
    <p style="padding-top:12px;border-top:1px solid #e5e7eb;"><strong>Total: ${escapeHtml(new Intl.NumberFormat('en-GB', { style: 'currency', currency: order.currency.toUpperCase() }).format(order.amountTotal / 100))}</strong></p>
    <p style="color:#667085;font-size:13px;">We’ll send a shipping confirmation when your order is on its way.</p>
  </main>
</body></html>`;

  try {
    const secure = env.SMTP_SECURE === 'true' || env.SMTP_PORT === '465';
    const transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT),
      secure,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    });
    await transport.sendMail({
      from: env.SMTP_FROM || env.SMTP_USER,
      to: order.customerEmail,
      subject: `Order confirmation ${orderRef}`,
      text,
      html,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Customer order confirmation email failed', { error: message, orderId: order.id });
  }
}
