import type { Env } from '../../types/env.js';
import type {
  TestPayloadRequest,
  TestOrderHandoffRequest,
  PrintifyVariant,
  PrintifyProductImage,
  OrderStatus,
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
import {
  getAllProductsForAdmin,
  updateProductFields,
  updateHiddenColors,
  updateSizeGuideImage,
  updateProductImages,
  getProductByPrintifyIdForAdmin,
  upsertProduct,
} from '../products/repository.js';
import { getProductByPrintifyId } from '../products/repository.js';
import { deriveProductAggregates } from '../products/aggregates.js';
import { previewPrintifySync, reconcileSyncedProducts, syncProductsPageByPage } from '../printify/sync.js';
import { buildPrintifyPayload, fulfillOrder } from '../printify/orders.js';
import { getEffectivePrintifyMode } from '../env.js';
import { getAllSettings, setSetting, getSetting } from '../settings/repository.js';
import { logger } from '../logging.js';
import { storeAssetData } from '../assets/storage.js';

type SyncProductsRequest = {
  preview?: boolean;
  page?: number;
  limit?: number;
  finalize?: boolean;
  syncedPrintifyIds?: string[];
};

export async function handleSyncProducts(env: Env, request: Request): Promise<Response> {
  logger.info('Admin: triggering product sync');
  try {
    const body = await request.json().catch(() => ({})) as SyncProductsRequest;

    if (body.finalize) {
      const syncedPrintifyIds = body.syncedPrintifyIds ?? [];
      const result = await reconcileSyncedProducts(env.DB, syncedPrintifyIds);
      return json({ success: true, finalized: true, ...result });
    }

    if (body.preview) {
      const result = await previewPrintifySync(
        env.DB,
        env,
        env.PRINTIFY_API_TOKEN,
        env.PRINTIFY_SHOP_ID,
      );
      return json({ success: true, preview: true, ...result });
    }

    const result = await syncProductsPageByPage(
      env.DB,
      env,
      env.PRINTIFY_API_TOKEN,
      env.PRINTIFY_SHOP_ID,
      body.page ?? 1,
      body.limit ?? 1,
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

export async function handleFulfillOrder(
  env: Env,
  id: string,
  request: Request,
): Promise<Response> {
  let body: { externalOrderRef?: string };
  try {
    body = await request.json().catch(() => ({})) as { externalOrderRef?: string };
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const order = await getOrderWithItems(env.DB, id);
  if (!order) return json({ error: 'Order not found' }, 404);

  await updateOrderStatus(env.DB, id, 'fulfilled', {
    externalOrderRef: body.externalOrderRef?.trim() || undefined,
  });

  return json({ success: true });
}

const validOrderStatuses: OrderStatus[] = [
  'pending',
  'paid',
  'fulfillment_started',
  'awaiting_fulfillment',
  'fulfilled',
  'failed',
] as const;

export async function handleUpdateOrderStatus(
  env: Env,
  id: string,
  request: Request,
): Promise<Response> {
  let body: { status?: string; externalOrderRef?: string };
  try {
    body = await request.json().catch(() => ({})) as { status?: string; externalOrderRef?: string };
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const status = body.status?.trim();
  if (!status || !validOrderStatuses.includes(status as OrderStatus)) {
    return json({ error: 'Invalid status' }, 400);
  }

  const order = await getOrderWithItems(env.DB, id);
  if (!order) return json({ error: 'Order not found' }, 404);

  await updateOrderStatus(env.DB, id, status as OrderStatus, {
    externalOrderRef: body.externalOrderRef?.trim() || undefined,
  });

  return json({ success: true, status });
}

export async function handleListProducts(env: Env): Promise<Response> {
  const products = await getAllProductsForAdmin(env.DB);
  return json({ products });
}

interface ManualVariantRow {
  color: string;
  hex: string;
  size: string;
  price: number;
  available: boolean;
}

interface ManualImageMeta {
  color?: string;
  isDefault?: boolean;
}

function normalizeHiddenColors(hiddenColors: unknown): string[] {
  if (!Array.isArray(hiddenColors)) return [];
  return Array.from(
    new Set(
      hiddenColors
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  );
}

export async function handleCreateProduct(env: Env, request: Request): Promise<Response> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    return json({ error: 'Expected multipart/form-data' }, 400);
  }

  const form = await request.formData();
  const title = (form.get('title') as string | null)?.trim() ?? '';
  const description = (form.get('description') as string | null)?.trim() ?? '';
  const category = (form.get('category') as string | null)?.trim() || 'apparel';

  if (!title) return json({ error: 'Title is required' }, 400);

  let variantRows: ManualVariantRow[];
  try {
    variantRows = JSON.parse((form.get('variants') as string | null) ?? '[]');
  } catch {
    return json({ error: 'Invalid variants payload' }, 400);
  }
  if (!Array.isArray(variantRows) || variantRows.length === 0) {
    return json({ error: 'At least one variant is required' }, 400);
  }

  let imagesMeta: ManualImageMeta[];
  try {
    imagesMeta = JSON.parse((form.get('imagesMeta') as string | null) ?? '[]');
  } catch {
    return json({ error: 'Invalid imagesMeta payload' }, 400);
  }

  const imageFiles = form.getAll('images').filter((v): v is File => v instanceof File);

  const id = crypto.randomUUID();
  const printifyId = `manual_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

  const variants: PrintifyVariant[] = variantRows.map((row, index) => ({
    id:        index + 1,
    color:     row.color?.trim() ?? '',
    size:      row.size?.trim() ?? '',
    price:     Math.round(row.price) || 0,
    available: row.available !== false,
  }));

  const colorHexByName = new Map(
    variantRows
      .filter((row) => row.color?.trim())
      .map((row) => [row.color.trim(), row.hex || '#cccccc'] as [string, string]),
  );

  const { colors, sizes, minPrice, maxPrice } = deriveProductAggregates(variants, colorHexByName);

  const images: PrintifyProductImage[] = [];
  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i];
    const meta = imagesMeta[i] ?? {};

    const stored = await storeAssetData(
      env.IMAGES,
      await file.arrayBuffer(),
      file.type || 'image/jpeg',
      {
        kind: 'product-image',
        keyPrefix: `product-images/${id}`,
        keySeed: `${id}:${i}:${file.name}:${file.size}`,
        sourceHint: file.name,
        metadata: { productId: id, color: meta.color ?? '' },
      },
    );

    const variantIdsForColor = meta.color
      ? variants.filter((v) => v.color === meta.color).map((v) => v.id)
      : variants.map((v) => v.id);

    images.push({
      src:        stored.url,
      isDefault:  !!meta.isDefault,
      variantIds: variantIdsForColor,
      color:      meta.color || undefined,
      assetKind:  'product-image',
      storageKey: stored.key,
    });
  }

  if (images.length > 0 && !images.some((img) => img.isDefault)) {
    images[0].isDefault = true;
  }

  await upsertProduct(env.DB, {
    id,
    printifyId,
    title,
    description,
    category,
    images,
    variants,
    colors,
    hiddenColors: [],
    sizes,
    minPrice,
    maxPrice,
  });

  const product = await getProductByPrintifyId(env.DB, printifyId);
  return json({ product });
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

  let body: {
    title?: string;
    description?: string;
    category?: string;
    isEnabled?: boolean;
    sizeGuideImage?: string | null;
    hiddenColors?: unknown;
  };
  try {
    body = await request.json() as {
      title?: string;
      description?: string;
      category?: string;
      isEnabled?: boolean;
      sizeGuideImage?: string | null;
      hiddenColors?: unknown;
    };
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  if (!('title' in body) && !('description' in body) && !('category' in body) && !('isEnabled' in body) && !('sizeGuideImage' in body) && !('hiddenColors' in body)) {
    return json({ error: 'No recognised fields to update' }, 400);
  }

  const title = body.title !== undefined ? body.title.trim() : undefined;
  if (title !== undefined && title.length === 0) {
    return json({ error: 'Title cannot be empty' }, 400);
  }

  const description = body.description !== undefined ? body.description.trim() : undefined;
  const category = body.category !== undefined ? body.category.trim() : undefined;
  const sizeGuideImage = body.sizeGuideImage !== undefined ? body.sizeGuideImage?.trim() || null : undefined;

  let updated = await updateProductFields(env.DB, printifyId, {
    title,
    description,
    category,
    isEnabled: body.isEnabled,
    sizeGuideImage,
    hiddenColors: body.hiddenColors !== undefined ? normalizeHiddenColors(body.hiddenColors) : undefined,
  });

  if (!updated) return json({ error: 'Product not found' }, 404);

  return json({ success: true });
}

export async function handleUploadProductImage(
  env: Env,
  printifyId: string,
  request: Request,
): Promise<Response> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    return json({ error: 'Expected multipart/form-data' }, 400);
  }

  const form = await request.formData();
  const file = form.get('file');
  const color = (form.get('color') as string | null)?.trim() || '';
  const isDefault = (form.get('isDefault') as string | null) === 'true';

  if (!(file instanceof File)) {
    return json({ error: 'Missing file upload' }, 400);
  }
  if (file.size === 0) {
    return json({ error: 'Uploaded file is empty' }, 400);
  }
  if (!file.type.startsWith('image/')) {
    return json({ error: 'Product image upload must be an image' }, 400);
  }

  const product = await getProductByPrintifyIdForAdmin(env.DB, printifyId);
  if (!product) return json({ error: 'Product not found' }, 404);

  if (color && !product.colors.some((entry) => entry.name === color)) {
    return json({ error: `Unknown colour: ${color}` }, 400);
  }

  const uploaded = await storeAssetData(
    env.IMAGES,
    await file.arrayBuffer(),
    file.type,
    {
      kind: 'product-image',
      keyPrefix: `product-images/${printifyId}`,
      keySeed: `${printifyId}:${file.name}:${file.size}:${file.type}:${color}:${isDefault}`,
      sourceHint: file.name,
      metadata: {
        printifyId,
        color,
      },
    },
  );

  const image = {
    src: uploaded.url,
    isDefault,
    variantIds: color
      ? product.variants.filter((variant) => variant.color === color).map((variant) => variant.id)
      : product.variants.map((variant) => variant.id),
    color: color || undefined,
    assetKind: 'product-image' as const,
    storageKey: uploaded.key,
  };

  const images = isDefault
    ? [image, ...product.images.map((entry) => ({ ...entry, isDefault: false }))]
    : [...product.images, image];

  if (!images.some((entry) => entry.isDefault) && images.length > 0) {
    images[0].isDefault = true;
  }

  const updated = await updateProductImages(env.DB, printifyId, images);
  if (!updated) return json({ error: 'Product not found' }, 404);

  return json({ success: true, image });
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
  const mode = getEffectivePrintifyMode(request, liveEnabled);
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
    fulfillmentProvider: 'printify',
    shipping: {
      name:     'Test Customer',
      phone:    '07700000000',
      address1: '1 Test Street',
      address2: '',
      city:     'London',
      region:   '',
      zip:      'SW1A 1AA',
      country:  'GB',
    },
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

  const allowed = ['live_orders_enabled', 'stripe_test_mode', 'fulfillment_provider'];
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
