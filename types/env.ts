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
}
