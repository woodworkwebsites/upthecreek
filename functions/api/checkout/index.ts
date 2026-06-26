import type { Env } from '../../../types/env.js';
import type { CheckoutRequest, CheckoutResponse } from '../../../types/index.js';
import {
  createStripeClient,
  resolveLineItems,
  createCheckoutSession,
} from '../../../server/stripe/checkout.js';
import { getStripeKeys } from '../../../server/env.js';
import { logger } from '../../../server/logging.js';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  let body: CheckoutRequest;
  try {
    body = await context.request.json() as CheckoutRequest;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { items } = body;
  if (!Array.isArray(items) || items.length === 0) {
    return json({ error: 'items must be a non-empty array' }, 400);
  }

  for (const item of items) {
    if (!item.printifyId || !item.variantId || !item.quantity || item.quantity < 1) {
      return json({ error: 'Each item requires printifyId, variantId, and quantity ≥ 1' }, 400);
    }
  }

  try {
    const { secretKey } = getStripeKeys(context.env);
    const stripe = createStripeClient(secretKey);
    const resolved = await resolveLineItems(context.env.DB, items);
    const siteUrl = getSiteUrl(context.request, context.env.SITE_URL);
    const session  = await createCheckoutSession(stripe, resolved, siteUrl);

    logger.info('Checkout session created', { sessionId: session.id });

    const response: CheckoutResponse = { url: session.url! };
    return json(response);
  } catch (err) {
    const status  = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : 'Internal error';
    logger.error('Checkout creation failed', { error: message });
    return json({ error: message }, status);
  }
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function getSiteUrl(request: Request, configuredSiteUrl: string): string {
  const requestOrigin = new URL(request.url).origin;
  if (isValidAbsoluteUrl(configuredSiteUrl)) {
    return configuredSiteUrl;
  }

  return requestOrigin;
}

function isValidAbsoluteUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return Boolean(url.protocol && url.host);
  } catch {
    return false;
  }
}
