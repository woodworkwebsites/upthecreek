import type { D1Database } from '@cloudflare/workers-types';
import type {
  PrintifyMode,
  PrintifyOrderPayload,
  PrintifyVariant,
} from '../../types/index.js';
import { createOrder as printifyCreateOrder } from './client.js';
import { writePrintifyLog } from '../orders/repository.js';
import { logger } from '../logging.js';

export interface FulfillmentItem {
  printifyId: string;
  variantId: number;
  quantity: number;
}

export interface ShippingAddress {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  region: string;
  address1: string;
  address2: string;
  city: string;
  zip: string;
}

export function buildPrintifyPayload(
  orderId: string,
  items: FulfillmentItem[],
  address: ShippingAddress,
): PrintifyOrderPayload {
  return {
    external_id: orderId,
    line_items: items.map((item) => ({
      product_id: item.printifyId,
      variant_id: item.variantId,
      quantity:   item.quantity,
    })),
    shipping_method: 1,
    send_shipping_notification: true,
    address_to: {
      first_name: address.firstName,
      last_name:  address.lastName,
      email:      address.email,
      phone:      address.phone,
      country:    address.country,
      region:     address.region,
      address1:   address.address1,
      address2:   address.address2,
      city:       address.city,
      zip:        address.zip,
    },
  };
}

export interface FulfillmentResult {
  printifyOrderId: string;
  payload: PrintifyOrderPayload;
  response: unknown;
}

export async function fulfillOrder(
  db: D1Database,
  orderId: string,
  mode: PrintifyMode,
  payload: PrintifyOrderPayload,
  token: string,
  shopId: string,
): Promise<FulfillmentResult> {
  logger.info('Fulfilling order', { orderId, mode });

  if (mode === 'dry_run') {
    const dryRunId = `dryrun_${crypto.randomUUID().replace(/-/g, '').substring(0, 16)}`;
    const result = { id: dryRunId, status: 'dry_run', mode: 'dry_run' };

    await writePrintifyLog(db, orderId, mode, 'dry_run', 'success', payload, result, null);
    logger.info('Dry run complete', { orderId, dryRunId });

    return { printifyOrderId: dryRunId, payload, response: result };
  }

  try {
    const response = await printifyCreateOrder(token, shopId, payload);

    await writePrintifyLog(db, orderId, mode, 'create_order', 'success', payload, response, null);
    logger.info('Printify order created', { orderId, printifyOrderId: response.id, mode });

    return { printifyOrderId: response.id, payload, response };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await writePrintifyLog(db, orderId, mode, 'create_order', 'error', payload, null, error);
    logger.error('Printify order creation failed', { orderId, error });
    throw err;
  }
}

export function resolveVariantDetails(
  variants: PrintifyVariant[],
  variantId: number,
): { color: string; size: string; price: number } | null {
  const v = variants.find((v) => v.id === variantId);
  if (!v) return null;
  return { color: v.color, size: v.size, price: v.price };
}
