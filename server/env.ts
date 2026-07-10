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
  ];

  for (const key of required) {
    if (!env[key]) {
      throw new EnvError(`Missing required environment variable: ${key}`);
    }
  }
}

function isLocalDevHost(request: Request): boolean {
  const host = new URL(request.url).host.toLowerCase();
  return (
    host.includes('localhost') ||
    host.startsWith('127.0.0.1') ||
    host.startsWith('[::1]')
  );
}

export function getStripeKeys(request: Request, env: Env, forceTestMode = false): {
  secretKey: string;
  webhookSecret: string;
} {
  const useTestMode = forceTestMode || isLocalDevHost(request);
  return {
    secretKey:     useTestMode ? env.STRIPE_SECRET_KEY_TEST     : env.STRIPE_SECRET_KEY_LIVE,
    webhookSecret: useTestMode ? env.STRIPE_WEBHOOK_SECRET_TEST : env.STRIPE_WEBHOOK_SECRET_LIVE,
  };
}

export function getEffectivePrintifyMode(
  request: Request,
  liveEnabled: boolean,
): PrintifyMode {
  if (isLocalDevHost(request)) return 'dry_run';

  if (liveEnabled) {
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
