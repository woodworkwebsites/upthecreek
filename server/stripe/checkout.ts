import Stripe from 'stripe';
import type { D1Database } from '@cloudflare/workers-types';
import type { CheckoutItem } from '../../types/index.js';
import { getProductByPrintifyId } from '../products/repository.js';
import { logger } from '../logging.js';

export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    apiVersion: '2024-06-20',
  });
}

export interface ResolvedLineItem {
  printifyId: string;
  variantId: number;
  quantity: number;
  title: string;
  color: string;
  size: string;
  unitPrice: number;
  images: string[];
}

export async function resolveLineItems(
  db: D1Database,
  items: CheckoutItem[],
): Promise<ResolvedLineItem[]> {
  const resolved: ResolvedLineItem[] = [];

  for (const item of items) {
    const product = await getProductByPrintifyId(db, item.printifyId);
    if (!product) {
      throw Object.assign(
        new Error(`Product not found: ${item.printifyId}`),
        { status: 404 },
      );
    }

    const variant = product.variants.find((v) => v.id === item.variantId);
    if (!variant) {
      throw Object.assign(
        new Error(`Variant not found: ${item.variantId} in product ${item.printifyId}`),
        { status: 404 },
      );
    }

    if (!variant.available) {
      throw Object.assign(
        new Error(`Variant not available: ${item.variantId}`),
        { status: 409 },
      );
    }

    resolved.push({
      printifyId: item.printifyId,
      variantId:  item.variantId,
      quantity:   item.quantity,
      title:      product.title,
      color:      variant.color,
      size:       variant.size,
      unitPrice:  variant.price,
      images:     product.images
        .filter((i) => i.isDefault && typeof i.src === 'string' && i.src.startsWith('https://'))
        .map((i) => i.src)
        .slice(0, 1),
    });
  }

  return resolved;
}

export async function createCheckoutSession(
  stripe: Stripe,
  items: ResolvedLineItem[],
  siteUrl: string,
): Promise<Stripe.Checkout.Session> {
  const compactItems = items.map((i) => ({
    pid: i.printifyId,
    vid: i.variantId,
    qty: i.quantity,
  }));

  logger.info('Creating Stripe checkout session', {
    itemCount: items.length,
    images: items.map((i) => i.images),
    siteUrl,
  });

  return stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    customer_creation: 'always',
    line_items: items.map((item) => ({
      price_data: {
        currency: 'gbp',
        product_data: {
          name: `${item.title} — ${item.color} / ${item.size}`,
          images: item.images,
        },
        unit_amount: item.unitPrice,
      },
      quantity: item.quantity,
    })),
    shipping_address_collection: {
      allowed_countries: ['GB', 'US', 'CA', 'AU', 'DE', 'FR', 'ES', 'IT', 'NL', 'SE'],
    },
    metadata: {
      items: JSON.stringify(compactItems),
    },
    success_url: `${siteUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/checkout`,
    phone_number_collection: { enabled: true },
  });
}
