import type { Env } from '../../types/env.js';
import type {
  TestPayloadRequest,
  TestOrderHandoffRequest,
} from '../../types/index.js';
import {
  listOrders,
  getOrderWithItems,
  createOrder,
  createOrderItem,
  updateOrderStatus,
  listSyncLogs,
  listWebhookLogs,
  listPrintifyLogs,
} from '../orders/repository.js';
import { getAllProductsForAdmin, updateSizeGuideImage } from '../products/repository.js';
import { getProductByPrintifyId } from '../products/repository.js';
import { syncProducts } from '../printify/sync.js';
import { buildPrintifyPayload, fulfillOrder } from '../printify/orders.js';
import { getEffectivePrintifyMode } from '../env.js';
import { getAllSettings, setSetting, getSetting } from '../settings/repository.js';
import { logger } from '../logging.js';
import { storeAssetData } from '../assets/storage.js';

export async function handleSyncProducts(env: Env): Promise<Response> {
  logger.info('Admin: triggering product sync');
  try {
    const result = await syncProducts(
      env.DB,
      env,
      env.PRINTIFY_API_TOKEN,
      env.PRINTIFY_SHOP_ID,
    );
    return json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }
}

export async function handleListOrders(env: Env, url: URL): Promise<Response> {
  const limit  = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 100);
  const offset = parseInt(url.searchParams.get('offset') ?? '0');
  const orders = await listOrders(env.DB, limit, offset);
  return json({ orders });
}

export async function handleGetOrder(env: Env, id: string): Promise<Response> {
  const order = await getOrderWithItems(env.DB, id);
  if (!order) return json({ error: 'Order not found' }, 404);
  return json({ order });
}

export async function handleListProducts(env: Env): Promise<Response> {
  const products = await getAllProductsForAdmin(env.DB);
  return json({ products });
}

export async function handleUpdateProduct(
  env: Env,
  printifyId: string,
  request: Request,
): Promise<Response> {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const file = form.get('file');

    if (!(file instanceof File)) {
      return json({ error: 'Missing file upload' }, 400);
    }

    if (file.size === 0) {
      return json({ error: 'Uploaded file is empty' }, 400);
    }

    if (!file.type.startsWith('image/')) {
      return json({ error: 'Size guide upload must be an image' }, 400);
    }

    const uploaded = await storeAssetData(
      env.IMAGES,
      new URL(request.url).origin,
      await file.arrayBuffer(),
      file.type,
      {
        kind: 'size-guide',
        keyPrefix: `size-guides/${printifyId}`,
        keySeed: `${printifyId}:${file.name}:${file.size}:${file.type}`,
        sourceHint: file.name,
        metadata: {
          printifyId,
        },
      },
    );

    const sizeGuideImage = uploaded.url;
    const updated = await updateSizeGuideImage(env.DB, printifyId, sizeGuideImage);
    if (!updated) return json({ error: 'Product not found' }, 404);

    return json({ success: true, sizeGuideImage });
  }

  let body: { sizeGuideImage?: string | null };
  try {
    body = await request.json() as { sizeGuideImage?: string | null };
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  if (!('sizeGuideImage' in body)) {
    return json({ error: 'No recognised fields to update' }, 400);
  }

  const updated = await updateSizeGuideImage(env.DB, printifyId, body.sizeGuideImage ?? null);
  if (!updated) return json({ error: 'Product not found' }, 404);

  return json({ success: true });
}

export async function handleListLogs(env: Env): Promise<Response> {
  const [syncLogs, webhookLogs, printifyLogs] = await Promise.all([
    listSyncLogs(env.DB),
    listWebhookLogs(env.DB),
    listPrintifyLogs(env.DB),
  ]);
  return json({ syncLogs, webhookLogs, printifyLogs });
}

export async function handleTestPrintifyPayload(
  env: Env,
  request: Request,
): Promise<Response> {
  let body: TestPayloadRequest;
  try {
    body = await request.json() as TestPayloadRequest;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { printifyId, variantId, quantity, address } = body;
  if (!printifyId || !variantId || !quantity || !address) {
    return json({ error: 'Missing required fields: printifyId, variantId, quantity, address' }, 400);
  }

  const product = await getProductByPrintifyId(env.DB, printifyId);
  if (!product) return json({ error: `Product not found: ${printifyId}` }, 404);

  const variant = product.variants.find((v) => v.id === variantId);
  if (!variant) return json({ error: `Variant not found: ${variantId}` }, 404);

  const payload = buildPrintifyPayload(
    `test_${crypto.randomUUID().substring(0, 8)}`,
    [{ printifyId, variantId, quantity }],
    {
      firstName: address.firstName,
      lastName:  address.lastName,
      email:     address.email,
      phone:     address.phone,
      country:   address.country,
      region:    '',
      address1:  address.address1,
      address2:  address.address2 ?? '',
      city:      address.city,
      zip:       address.zip,
    },
  );

  return json({
    payload,
    product: { title: product.title, variant: { color: variant.color, size: variant.size } },
    mode: 'test (payload only — no API call)',
  });
}

export async function handleTestOrderHandoff(
  env: Env,
  request: Request,
): Promise<Response> {
  let body: TestOrderHandoffRequest;
  try {
    body = await request.json() as TestOrderHandoffRequest;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { printifyId, variantId, quantity } = body;
  if (!printifyId || !variantId || !quantity) {
    return json({ error: 'Missing required fields: printifyId, variantId, quantity' }, 400);
  }

  const product = await getProductByPrintifyId(env.DB, printifyId);
  if (!product) return json({ error: `Product not found: ${printifyId}` }, 404);

  const variant = product.variants.find((v) => v.id === variantId);
  if (!variant) return json({ error: `Variant not found: ${variantId}` }, 404);

  const liveEnabled = (await getSetting(env.DB, 'live_orders_enabled')) === 'true';
  const mode = getEffectivePrintifyMode(env, liveEnabled);
  const orderId = crypto.randomUUID();
  const fakeSessionId = `cs_test_${crypto.randomUUID().replace(/-/g, '').substring(0, 24)}`;

  await createOrder(env.DB, {
    id:                  orderId,
    stripeSessionId:     fakeSessionId,
    stripePaymentIntent: null,
    customerEmail:       'test@upthecreekpadel.com',
    customerName:        'Test Customer',
    amountTotal:         variant.price * quantity,
    currency:            'gbp',
    printifyMode:        mode,
  });

  await createOrderItem(env.DB, {
    id:         crypto.randomUUID(),
    orderId,
    printifyId,
    variantId,
    title:      product.title,
    color:      variant.color,
    size:       variant.size,
    quantity,
    unitPrice:  variant.price,
  });

  await updateOrderStatus(env.DB, orderId, 'fulfillment_started');

  const payload = buildPrintifyPayload(
    orderId,
    [{ printifyId, variantId, quantity }],
    {
      firstName: 'Test',
      lastName:  'Customer',
      email:     'test@upthecreekpadel.com',
      phone:     '07700000000',
      country:   'GB',
      region:    '',
      address1:  '1 Test Street',
      address2:  '',
      city:      'London',
      zip:       'SW1A 1AA',
    },
  );

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

    logger.info('Test order handoff complete', { orderId, mode });

    return json({
      orderId,
      fakeSessionId,
      mode,
      printifyOrderId: result.printifyOrderId,
      payload: result.payload,
      response: result.response,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await updateOrderStatus(env.DB, orderId, 'failed', { error: message });
    return json({ error: message, orderId }, 500);
  }
}


export async function handleGetSettings(env: Env): Promise<Response> {
  const settings = await getAllSettings(env.DB);
  return json({ settings });
}

export async function handleUpdateSettings(env: Env, request: Request): Promise<Response> {
  let body: Record<string, string>;
  try {
    body = await request.json() as Record<string, string>;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const allowed = ['live_orders_enabled', 'printify_mode'];
  for (const [key, value] of Object.entries(body)) {
    if (!allowed.includes(key)) return json({ error: `Unknown setting: ${key}` }, 400);
    await setSetting(env.DB, key, value);
  }

  return json({ success: true });
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
