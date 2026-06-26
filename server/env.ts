import type { Env } from '../types/env.js';
import type { PrintifyMode } from '../types/index.js';

export class EnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvError';
  }
}

export function validateEnv(env: Env): void {
  const required: (keyof Env)[] = [
    'STRIPE_SECRET_KEY_TEST',
    'STRIPE_SECRET_KEY_LIVE',
    'STRIPE_WEBHOOK_SECRET_TEST',
    'STRIPE_WEBHOOK_SECRET_LIVE',
    'PRINTIFY_API_TOKEN',
    'PRINTIFY_SHOP_ID',
    'ADMIN_TOKEN',
    'SITE_URL',
    'ENVIRONMENT',
  ];

  for (const key of required) {
    if (!env[key]) {
      throw new EnvError(`Missing required environment variable: ${key}`);
    }
  }
}

export function getStripeKeys(env: Env): {
  secretKey: string;
  webhookSecret: string;
} {
  const isProduction = env.ENVIRONMENT === 'production';
  return {
    secretKey:     isProduction ? env.STRIPE_SECRET_KEY_LIVE     : env.STRIPE_SECRET_KEY_TEST,
    webhookSecret: isProduction ? env.STRIPE_WEBHOOK_SECRET_LIVE : env.STRIPE_WEBHOOK_SECRET_TEST,
  };
}

export function getEffectivePrintifyMode(
  env: Env,
  liveEnabled: boolean,
): PrintifyMode {
  const environment = env.ENVIRONMENT ?? 'local';

  if (environment === 'local') return 'dry_run';

  if (liveEnabled) {
    if (environment !== 'production') {
      throw new EnvError('Live orders can only be enabled in the production environment.');
    }
    return 'live';
  }

  return 'draft';
}

export function requireAdminToken(request: Request, env: Env): void {
  const auth = request.headers.get('Authorization');
  const token = auth?.replace(/^Bearer\s+/i, '');
  if (!token || token !== env.ADMIN_TOKEN) {
    throw Object.assign(new Error('Unauthorized'), { status: 401 });
  }
}

export function isLocal(env: Env): boolean {
  return env.ENVIRONMENT === 'local';
}
