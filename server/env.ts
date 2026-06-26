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
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
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

export function getEffectivePrintifyMode(env: Env): PrintifyMode {
  const environment = env.ENVIRONMENT ?? 'local';
  const requestedMode = (env.PRINTIFY_MODE ?? 'dry_run') as PrintifyMode;
  const liveEnabled = env.LIVE_ORDERS_ENABLED === 'true';

  if (environment === 'local') {
    if (requestedMode === 'live') return 'dry_run';
    return requestedMode === 'draft' ? 'draft' : 'dry_run';
  }

  if (requestedMode === 'live') {
    if (!liveEnabled) {
      throw new EnvError(
        'Live mode requested but LIVE_ORDERS_ENABLED is not "true". ' +
        'Set LIVE_ORDERS_ENABLED=true and ENVIRONMENT=production to enable live orders.',
      );
    }
    if (environment !== 'production') {
      throw new EnvError(
        'Live mode is only allowed when ENVIRONMENT=production.',
      );
    }
    return 'live';
  }

  return requestedMode;
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
