import Stripe from 'stripe';
import type { D1Database } from '@cloudflare/workers-types';
import type { CheckoutItem } from '../../types/index.js';
import { getProductByPrintifyId } from '../products/repository.js';
import {
  getDiscountCodeByCode,
  incrementDiscountCodeUsage,
} from '../discount-codes/repository.js';
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
  selectedColor: string;
  title: string;
  color: string;
  size: string;
  unitPrice: number;
  images: string[];
}

interface ResolvedUnitItem {
  printifyId: string;
  variantId: number;
  selectedColor: string;
  title: string;
  color: string;
  size: string;
  unitPrice: number;
  images: string[];
}

export interface AppliedDiscount {
  id: string;
  code: string;
  kind: 'percent' | 'fixed';
  value: number;
  amount: number;
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
    if (item.color && item.color !== variant.color) {
      throw Object.assign(
        new Error(`Selected colour ${item.color} does not match variant ${variant.color}`),
        { status: 409 },
      );
    }

    resolved.push({
      printifyId: item.printifyId,
      variantId:  item.variantId,
      quantity:   item.quantity,
      selectedColor: item.color ?? variant.color,
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

function expandUnits(items: ResolvedLineItem[]): ResolvedUnitItem[] {
  const units: ResolvedUnitItem[] = [];

  for (const item of items) {
    for (let index = 0; index < item.quantity; index += 1) {
      units.push({
        printifyId: item.printifyId,
        variantId: item.variantId,
        selectedColor: item.selectedColor,
        title: item.title,
        color: item.color,
        size: item.size,
        unitPrice: item.unitPrice,
        images: item.images,
      });
    }
  }

  return units;
}

function allocateDiscountedPrices(unitPrices: number[], targetTotal: number): number[] {
  const subtotal = unitPrices.reduce((sum, price) => sum + price, 0);
  if (subtotal <= 0) return unitPrices.map(() => 0);

  const entries = unitPrices.map((price, index) => {
    const exact = (price * targetTotal) / subtotal;
    const floored = Math.floor(exact);
    return {
      index,
      floored,
      fraction: exact - floored,
    };
  });

  let remainder = targetTotal - entries.reduce((sum, entry) => sum + entry.floored, 0);
  entries.sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  for (const entry of entries) {
    if (remainder <= 0) break;
    entry.floored += 1;
    remainder -= 1;
  }

  const discounted = Array.from({ length: unitPrices.length }, () => 0);
  for (const entry of entries) {
    discounted[entry.index] = entry.floored;
  }

  return discounted;
}

async function resolveDiscount(
  db: D1Database,
  discountCodeInput?: string | null,
): Promise<AppliedDiscount | null> {
  const code = discountCodeInput?.trim();
  if (!code) return null;

  const discountCode = await getDiscountCodeByCode(db, code);
  if (!discountCode) {
    throw Object.assign(new Error('Invalid discount code'), { status: 400 });
  }
  if (!discountCode.active) {
    throw Object.assign(new Error('Discount code is disabled'), { status: 400 });
  }
  if (discountCode.expiresAt && new Date(discountCode.expiresAt).getTime() <= Date.now()) {
    throw Object.assign(new Error('Discount code has expired'), { status: 400 });
  }
  if (discountCode.usageLimit !== null && discountCode.usageCount >= discountCode.usageLimit) {
    throw Object.assign(new Error('Discount code has reached its usage limit'), { status: 400 });
  }

  return {
    id: discountCode.id,
    code: discountCode.code,
    kind: discountCode.kind,
    value: discountCode.value,
    amount: 0,
  };
}

export async function createCheckoutSession(
  stripe: Stripe,
  db: D1Database,
  items: ResolvedLineItem[],
  siteUrl: string,
  discountCodeInput?: string | null,
): Promise<Stripe.Checkout.Session> {
  const compactItems = items.map((i) => ({
    pid: i.printifyId,
    vid: i.variantId,
    qty: i.quantity,
    color: i.selectedColor,
  }));
  const discount = await resolveDiscount(db, discountCodeInput);
  const unitItems = expandUnits(items);
  const subtotal = unitItems.reduce((sum, item) => sum + item.unitPrice, 0);
  let discountedUnitPrices = unitItems.map((item) => item.unitPrice);
  let discountAmount = 0;

  if (discount) {
    const rawDiscountAmount =
      discount.kind === 'percent'
        ? Math.round((subtotal * discount.value) / 100)
        : discount.value;
    discountAmount = Math.min(rawDiscountAmount, subtotal);
    const targetTotal = subtotal - discountAmount;
    discountedUnitPrices = allocateDiscountedPrices(
      unitItems.map((item) => item.unitPrice),
      targetTotal,
    );
    discount.amount = discountAmount;
  }

  logger.info('Creating Stripe checkout session', {
    itemCount: items.length,
    images: items.map((i) => i.images),
    siteUrl,
    discountCode: discount?.code ?? null,
    discountAmount,
  });

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_creation: 'always',
      line_items: unitItems.map((item, index) => ({
      price_data: {
        currency: 'gbp',
        product_data: {
          name: `${item.title} — ${item.selectedColor} / ${item.size}`,
          images: item.images,
        },
        unit_amount: discountedUnitPrices[index],
      },
      quantity: 1,
      })),
      shipping_address_collection: {
        allowed_countries: ['GB', 'US', 'CA', 'AU', 'DE', 'FR', 'ES', 'IT', 'NL', 'SE'],
      },
      metadata: {
        items: JSON.stringify(compactItems),
        ...(discount
          ? {
              discount_code_id: discount.id,
              discount_code: discount.code,
              discount_code_kind: discount.kind,
              discount_code_value: String(discount.value),
              discount_amount: String(discount.amount),
            }
          : {}),
      },
      success_url: `${siteUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/checkout`,
      phone_number_collection: { enabled: true },
    });

    if (discount) {
      await incrementDiscountCodeUsage(db, discount.id);
    }

    return session;
  } catch (err) {
    if (discount) {
      await db
        .prepare(`
          UPDATE discount_codes
          SET usage_count = CASE WHEN usage_count > 0 THEN usage_count - 1 ELSE 0 END,
              updated_at = datetime('now')
          WHERE id = ?
        `)
        .bind(discount.id)
        .run()
        .catch(() => {});
    }
    throw err;
  }
}
