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
import { sendOrderNotificationEmail } from '../notifications/email.js';
import { sendPushoverNotification } from '../notifications/pushover.js';
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

  const discountAmount = Number(session.metadata?.discount_amount ?? '0') || 0;

  const compactItems = JSON.parse(itemsMeta) as Array<{
    pid: string;
    vid: number;
    qty: number;
  }>;

  const liveEnabled = (await getSetting(env.DB, 'live_orders_enabled')) === 'true';
  const mode = getEffectivePrintifyMode(request, liveEnabled);
  const fulfillmentProvider = (await getSetting(env.DB, 'fulfillment_provider')) === 'manual' ? 'manual' : 'printify';
  const orderId = crypto.randomUUID();

  const customerEmail = session.customer_details?.email ?? session.customer_email ?? 'unknown';
  const customerName  = session.customer_details?.name ?? null;

  // Stripe moved shipping across API versions:
  //   < 2024-09-30: session.shipping / session.shipping_details
  //   >= 2024-09-30: session.collected_information.shipping_details
  const sessionAny = session as unknown as Record<string, unknown>;
  type ShippingShape = { name?: string; address?: { country?: string; state?: string; line1?: string; line2?: string | null; city?: string; postal_code?: string } } | null;
  const shipping: ShippingShape =
    (sessionAny['collected_information'] as Record<string, ShippingShape> | undefined)?.['shipping_details'] ??
    (session.shipping_details as ShippingShape) ??
    (sessionAny['shipping'] as ShippingShape) ??
    null;

  logger.info('Webhook shipping data', {
    sessionId,
    hasShipping: !!shipping,
    shippingName: shipping?.name ?? null,
    country: shipping?.address?.country ?? null,
  });

  const fullName = shipping?.name ?? customerName ?? '';
  const address = {
    firstName: fullName.split(' ')[0] ?? '',
    lastName:  fullName.split(' ').slice(1).join(' ') || '',
    email:     customerEmail,
    phone:     session.customer_details?.phone ?? '',
    country:   shipping?.address?.country ?? 'GB',
    region:    shipping?.address?.state ?? '',
    address1:  shipping?.address?.line1 ?? '',
    address2:  shipping?.address?.line2 ?? '',
    city:      shipping?.address?.city ?? '',
    zip:       shipping?.address?.postal_code ?? '',
  };

  await createOrder(env.DB, {
    id:                  orderId,
    stripeSessionId:     sessionId,
    stripePaymentIntent: typeof session.payment_intent === 'string' ? session.payment_intent : null,
    customerEmail,
    customerName,
    amountTotal:         session.amount_total ?? 0,
    currency:            session.currency ?? 'gbp',
    printifyMode:        mode,
    fulfillmentProvider,
    discountCode:        session.metadata?.discount_code ?? null,
    discountAmount,
    shipping: {
      name:     fullName,
      phone:    address.phone,
      address1: address.address1,
      address2: address.address2,
      city:     address.city,
      region:   address.region,
      zip:      address.zip,
      country:  address.country,
    },
  });

  await updateOrderStatus(env.DB, orderId, 'fulfillment_started');

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

  const itemSummary = lineItems.length > 0
    ? lineItems.map((item) => `${item.quantity}x ${item.printifyId} (variant ${item.variantId})`).join(', ')
    : 'No items';

  await sendPushoverNotification(env, {
    title:   fulfillmentProvider === 'manual' ? 'New order — action needed' : 'New paid order',
    message: `${customerEmail} · ${((session.amount_total ?? 0) / 100).toFixed(2)} ${(session.currency ?? 'gbp').toUpperCase()}\n${itemSummary}\nShip to: ${fullName}, ${address.address1}, ${address.city}, ${address.zip}, ${address.country}`,
    url:     new URL('/admin/orders', new URL(request.url).origin).toString(),
    urlTitle: 'Open Admin Orders',
  });

  await sendOrderNotificationEmail(env, {
    subject: fulfillmentProvider === 'manual' ? `New order awaiting action: ${customerEmail}` : `New paid order: ${customerEmail}`,
    text: `${customerEmail} · ${((session.amount_total ?? 0) / 100).toFixed(2)} ${(session.currency ?? 'gbp').toUpperCase()}\n${itemSummary}\nShip to: ${fullName}, ${address.address1}, ${address.city}, ${address.zip}, ${address.country}`,
  });

  if (fulfillmentProvider === 'manual') {
    await updateOrderStatus(env.DB, orderId, 'awaiting_fulfillment');
    logger.info('Order awaiting manual fulfillment', { orderId });

    return;
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
