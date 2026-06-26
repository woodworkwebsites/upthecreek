import type { Env } from '../../../types/env.js';
import type { CheckoutRequest, CheckoutResponse } from '../../../types/index.js';
import {
  createStripeClient,
  resolveLineItems,
  createCheckoutSession,
} from '../../../server/stripe/checkout.js';
import { getStripeKeys } from '../../../server/env.js';
import { getSetting } from '../../../server/settings/repository.js';
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
    const stripeTestMode = (await getSetting(context.env.DB, 'stripe_test_mode')) === 'true';
    const { secretKey } = getStripeKeys(context.request, context.env, stripeTestMode);
    const stripe = createStripeClient(secretKey);
    const resolved = await resolveLineItems(context.env.DB, items);
    const session  = await createCheckoutSession(stripe, resolved, new URL(context.request.url).origin);

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
