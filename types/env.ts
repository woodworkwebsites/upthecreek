import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import type { PrintifyMode } from './index.js';

export interface Env {
  DB: D1Database;
  IMAGES: R2Bucket;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  PRINTIFY_API_TOKEN: string;
  PRINTIFY_SHOP_ID: string;
  PRINTIFY_MODE: PrintifyMode;
  LIVE_ORDERS_ENABLED: string;
  ADMIN_TOKEN: string;
  SITE_URL: string;
  ENVIRONMENT: string;
}
