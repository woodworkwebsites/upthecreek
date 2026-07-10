import type { D1Database, R2Bucket } from '@cloudflare/workers-types';

export interface Env {
  DB: D1Database;
  IMAGES: R2Bucket;
  STRIPE_SECRET_KEY_TEST: string;
  STRIPE_SECRET_KEY_LIVE: string;
  STRIPE_WEBHOOK_SECRET_TEST: string;
  STRIPE_WEBHOOK_SECRET_LIVE: string;
  PRINTIFY_API_TOKEN: string;
  PRINTIFY_SHOP_ID: string;
  LIVE_ORDERS_ENABLED: string;
  ADMIN_TOKEN: string;
  PUSHOVER_APP_TOKEN?: string;
  PUSHOVER_USER_KEY?: string;
  SMTP_HOST?: string;
  SMTP_PORT?: string;
  SMTP_USER?: string;
  SMTP_PASSWORD?: string;
  SMTP_FROM?: string;
  SMTP_SECURE?: string;
  ORDER_NOTIFICATION_EMAIL_TO?: string;
  ORDER_NOTIFICATION_EMAIL_CC?: string;
}
