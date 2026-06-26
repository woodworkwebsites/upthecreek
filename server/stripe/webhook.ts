import Stripe from 'stripe';
import type { Env } from '../../types/env.js';
import { createStripeClient } from './checkout.js';
import {
  getOrderBySessionId,
  createOrder,
  createOrderItem,
  updateOrderStatus,
  writeWebhookLog,
} from '../orders/repository.js';
import { getProductByPrintifyId } from '../products/repository.js';
import { buildPrintifyPayload, fulfillOrder } from '../printify/orders.js';
import { getEffectivePrintifyMode, getStripeKeys } from '../env.js';
import { getSetting } from '../settings/repository.js';
import { logger } from '../logging.js';

export async function handleStripeWebhook(
  request: Request,
  env: Env,
): Promise<Response> {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    logger.warn('Webhook missing stripe-signature header');
    return new Response('Missing stripe-signature', { status: 400 });
  }

  const rawBody = await request.text();

  const stripeTestMode = (await getSetting(env.DB, 'stripe_test_mode')) === 'true';
  const { secretKey, webhookSecret } = getStripeKeys(request, env, stripeTestMode);
  const stripe = createStripeClient(secretKey);

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Webhook signature verification failed', { error: message });
    await writeWebhookLog(env.DB, 'unknown', null, 'error', null, message).catch(() => {});
    return new Response(`Webhook signature verification failed: ${message}`, { status: 400 });
  }

  logger.info('Webhook received', { type: event.type, id: event.id });
  await writeWebhookLog(env.DB, event.type, null, 'received', null, null).catch(() => {});

  if (event.type !== 'checkout.session.completed') {
    await writeWebhookLog(env.DB, event.type, null, 'ignored', null, null).catch(() => {});
    return new Response('OK', { status: 200 });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  try {
    await processCompletedSession(session, request, env);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Webhook processing failed', { sessionId: session.id, error: message });
    await writeWebhookLog(env.DB, event.type, session.id, 'error', null, message).catch(() => {});
    return new Response('Internal error', { status: 500 });
  }

  await writeWebhookLog(env.DB, event.type, session.id, 'processed', null, null).catch(() => {});
  return new Response('OK', { status: 200 });
}

async function processCompletedSession(
  session: Stripe.Checkout.Session,
  request: Request,
  env: Env,
): Promise<void> {
  const sessionId = session.id;

  const existing = await getOrderBySessionId(env.DB, sessionId);
  if (existing) {
    logger.info('Order already processed — idempotent return', { sessionId, orderId: existing.id });
    return;
  }

  const itemsMeta = session.metadata?.items;
  if (!itemsMeta) {
    throw new Error(`No items metadata on session ${sessionId}`);
  }

  const compactItems = JSON.parse(itemsMeta) as Array<{
    pid: string;
    vid: number;
    qty: number;
  }>;

  const liveEnabled = (await getSetting(env.DB, 'live_orders_enabled')) === 'true';
  const mode = getEffectivePrintifyMode(request, liveEnabled);
  const orderId = crypto.randomUUID();

  const customerEmail = session.customer_details?.email ?? session.customer_email ?? 'unknown';
  const customerName  = session.customer_details?.name ?? null;

  await createOrder(env.DB, {
    id:                  orderId,
    stripeSessionId:     sessionId,
    stripePaymentIntent: typeof session.payment_intent === 'string' ? session.payment_intent : null,
    customerEmail,
    customerName,
    amountTotal:         session.amount_total ?? 0,
    currency:            session.currency ?? 'gbp',
    printifyMode:        mode,
  });

  await updateOrderStatus(env.DB, orderId, 'fulfillment_started');

  // Stripe renamed 'shipping' → 'shipping_details' in newer API versions;
  // fall back to the old field if the webhook endpoint is on an older version.
  const shipping =
    session.shipping_details ??
    (session as unknown as Record<string, typeof session.shipping_details>)['shipping'];

  logger.info('Webhook shipping data', {
    sessionId,
    hasShipping: !!shipping,
    shippingName: shipping?.name ?? null,
    country: shipping?.address?.country ?? null,
  });

  const address = {
    firstName: (shipping?.name ?? customerName ?? '').split(' ')[0] ?? '',
    lastName:  (shipping?.name ?? customerName ?? '').split(' ').slice(1).join(' ') || '',
    email:     customerEmail,
    phone:     session.customer_details?.phone ?? '',
    country:   shipping?.address?.country ?? 'GB',
    region:    shipping?.address?.state ?? '',
    address1:  shipping?.address?.line1 ?? '',
    address2:  shipping?.address?.line2 ?? '',
    city:      shipping?.address?.city ?? '',
    zip:       shipping?.address?.postal_code ?? '',
  };

  const lineItems: Array<{
    printifyId: string;
    variantId: number;
    quantity: number;
  }> = [];

  for (const compact of compactItems) {
    const product = await getProductByPrintifyId(env.DB, compact.pid);
    if (!product) {
      logger.warn('Product not found during fulfillment', { printifyId: compact.pid });
      continue;
    }

    const variant = product.variants.find((v) => v.id === compact.vid);
    if (!variant) {
      logger.warn('Variant not found during fulfillment', { printifyId: compact.pid, variantId: compact.vid });
      continue;
    }

    await createOrderItem(env.DB, {
      id:         crypto.randomUUID(),
      orderId,
      printifyId: compact.pid,
      variantId:  compact.vid,
      title:      product.title,
      color:      variant.color,
      size:       variant.size,
      quantity:   compact.qty,
      unitPrice:  variant.price,
    });

    lineItems.push({
      printifyId: compact.pid,
      variantId:  compact.vid,
      quantity:   compact.qty,
    });
  }

  const payload = buildPrintifyPayload(orderId, lineItems, address);

  try {
    const result = await fulfillOrder(
      env.DB,
      orderId,
      mode,
      payload,
      env.PRINTIFY_API_TOKEN,
      env.PRINTIFY_SHOP_ID,
    );

    await updateOrderStatus(env.DB, orderId, 'fulfilled', {
      printifyOrderId:  result.printifyOrderId,
      printifyPayload:  result.payload,
      printifyResponse: result.response,
    });

    logger.info('Order fulfilled', { orderId, printifyOrderId: result.printifyOrderId, mode });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await updateOrderStatus(env.DB, orderId, 'failed', { error: message });
    throw err;
  }
}
