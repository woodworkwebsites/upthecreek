import type { Env } from '../../types/env.js';
import type {
  PrintifyVariant,
  PrintifyProductImage,
  OrderStatus,
  PartnerInput,
  PartnerStockOrderStatus,
} from '../../types/index.js';
import {
  listOrders,
  getOrderWithItems,
  createOrder,
  createOrderItem,
  deleteOrderById,
  updateOrderStatus,
  listSyncLogs,
  listWebhookLogs,
} from '../orders/repository.js';
import {
  buildOrderReceiptFilename,
  buildOrderReceiptHtml,
} from '../orders/receipt.js';
import {
  getAllProductsForAdmin,
  deleteProductByPrintifyId,
  updateProductFields,
  updateHiddenColors,
  updateSizeGuideImage,
  updateProductImages,
  getProductByPrintifyIdForAdmin,
  upsertProduct,
} from '../products/repository.js';
import { getProductByPrintifyId } from '../products/repository.js';
import { deriveProductAggregates } from '../products/aggregates.js';
import { getAllSettings, setSetting, getSetting } from '../settings/repository.js';
import {
  listDiscountCodes,
  createDiscountCode,
  updateDiscountCode,
  deleteDiscountCode,
  getDiscountCodeById,
} from '../discount-codes/repository.js';
import {
  listPartners,
  createPartner,
  updatePartner,
  deletePartner,
  getPartnerById,
  syncPartnerCommissionStatusByOrderId,
} from '../partners/repository.js';
import {
  listRanges,
  createRange,
  updateRange,
  deleteRange,
  getRangeById,
} from '../ranges/repository.js';
import {
  listPartnerStockOrders,
  deletePartnerStockOrder,
  getPartnerStockOrderWithItems,
  updatePartnerStockOrderStatus,
} from '../partner-stock-orders/repository.js';
import { logger } from '../logging.js';
import { deleteAsset, storeAssetData } from '../assets/storage.js';

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

export async function handleGetOrderReceipt(env: Env, id: string): Promise<Response> {
  const order = await getOrderWithItems(env.DB, id);
  if (!order) return json({ error: 'Order not found' }, 404);

  const html = buildOrderReceiptHtml(order);
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="${buildOrderReceiptFilename(order)}"`,
      'Cache-Control': 'no-store',
    },
  });
}

export async function handleDeleteOrder(env: Env, id: string): Promise<Response> {
  const deleted = await deleteOrderById(env.DB, id);
  if (!deleted) return json({ error: 'Order not found' }, 404);
  return json({ success: true });
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
  await syncPartnerCommissionStatusByOrderId(env.DB, id, 'fulfilled');

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
  await syncPartnerCommissionStatusByOrderId(env.DB, id, status as OrderStatus);

  return json({ success: true, status });
}

export async function handleListProducts(env: Env): Promise<Response> {
  const products = await getAllProductsForAdmin(env.DB);
  return json({ products });
}

export async function handleListRanges(env: Env): Promise<Response> {
  const ranges = await listRanges(env.DB);
  return json({ ranges });
}

export async function handleCreateRange(env: Env, request: Request): Promise<Response> {
  let body: {
    name?: string;
    storefrontEnabled?: boolean;
    partnerEnabled?: boolean;
    sortOrder?: number | string;
  };

  try {
    body = await request.json().catch(() => ({})) as typeof body;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const name = body.name?.trim();
  if (!name) return json({ error: 'Range name is required' }, 400);

  try {
    const range = await createRange(env.DB, {
      name,
      storefrontEnabled: body.storefrontEnabled,
      partnerEnabled: body.partnerEnabled,
      sortOrder: parseOptionalInt(body.sortOrder ?? null) ?? 0,
    });
    return json({ range }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 400);
  }
}

export async function handleUpdateRange(env: Env, id: string, request: Request): Promise<Response> {
  let body: {
    name?: string;
    storefrontEnabled?: boolean;
    partnerEnabled?: boolean;
    sortOrder?: number | string;
  };

  try {
    body = await request.json().catch(() => ({})) as typeof body;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const existing = await getRangeById(env.DB, id);
  if (!existing) return json({ error: 'Range not found' }, 404);

  const nextSortOrder = body.sortOrder !== undefined ? parseOptionalInt(body.sortOrder) ?? existing.sortOrder : undefined;
  const range = await updateRange(env.DB, id, {
    name: body.name?.trim() || undefined,
    storefrontEnabled: body.storefrontEnabled ?? existing.storefrontEnabled,
    partnerEnabled: body.partnerEnabled ?? existing.partnerEnabled,
    sortOrder: nextSortOrder,
  });

  if (!range) return json({ error: 'Range not found' }, 404);
  return json({ range });
}

export async function handleDeleteRange(env: Env, id: string): Promise<Response> {
  const existing = await getRangeById(env.DB, id);
  if (!existing) return json({ error: 'Range not found' }, 404);

  const inUse = await env.DB
    .prepare('SELECT COUNT(*) AS count FROM products WHERE range_id = ?')
    .bind(id)
    .first<{ count: number }>();
  if ((inUse?.count ?? 0) > 0) {
    return json({ error: 'Move products off this range before deleting it' }, 400);
  }

  await deleteRange(env.DB, id);
  return json({ success: true });
}

export async function handleDeleteProduct(
  env: Env,
  printifyId: string,
): Promise<Response> {
  const product = await getProductByPrintifyIdForAdmin(env.DB, printifyId);
  if (!product) return json({ error: 'Product not found' }, 404);

  await Promise.all(
    product.images
      .filter((image) => Boolean(image.storageKey))
      .map((image) => deleteAsset(env.IMAGES, image.storageKey as string)),
  );

  const deleted = await deleteProductByPrintifyId(env.DB, printifyId);
  if (!deleted) return json({ error: 'Product not found' }, 404);

  return json({ success: true });
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

interface ManualPricingMatrix {
  audience: string;
  product: string;
  garment: string;
  printSurface: string;
  manufacturingCost: string;
  saleCost: string;
  deliveryRetail: string;
  deliveryPartner: string;
  deliveryOnlinePartnership: string;
  salePrice: string;
  partnerPrice: string;
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

function normalizeColorName(value: string): string {
  return value.trim().toLowerCase();
}

function isKnownColor(color: string, knownColors: Array<{ name: string }>): boolean {
  const target = normalizeColorName(color);
  return knownColors.some((entry) => normalizeColorName(entry.name) === target);
}

function getVariantIdsForColor(product: { variants: PrintifyVariant[] }, color: string): number[] {
  const target = normalizeColorName(color);
  return product.variants
    .filter((variant) => normalizeColorName(variant.color) === target)
    .map((variant) => variant.id);
}

function parseCatalogColors(settings: Record<string, string>): Array<{ name: string; hex: string }> {
  const raw = settings.catalog_color_options;
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((value): value is { name: string; hex: string } => (
        Boolean(
          value &&
          typeof value === 'object' &&
          typeof value.name === 'string' &&
          typeof value.hex === 'string',
        )
      ))
      .map((value) => ({
        name: value.name.trim(),
        hex: value.hex.trim() || '#111827',
      }))
      .filter((value) => value.name.length > 0);
  } catch {
    return [];
  }
}

async function getAllowedImageColors(env: Env, product: { colors: Array<{ name: string; hex: string }> }) {
  const settings = await getAllSettings(env.DB);
  const catalogColors = parseCatalogColors(settings);
  const combined = [...catalogColors, ...product.colors];
  const seen = new Set<string>();
  return combined.filter((color) => {
    const key = normalizeColorName(color.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
  const rangeIdRaw = (form.get('rangeId') as string | null)?.trim() || '';
  const audience = (form.get('audience') as string | null)?.trim() || '';
  const productType = (form.get('productType') as string | null)?.trim() || '';
  const garment = (form.get('garment') as string | null)?.trim() || '';
  const isEnabled = (form.get('isEnabled') as string | null) !== 'false';

  if (!title) return json({ error: 'Title is required' }, 400);

  let variantRows: ManualVariantRow[];
  try {
    variantRows = JSON.parse((form.get('variants') as string | null) ?? '[]');
  } catch {
    return json({ error: 'Invalid variants payload' }, 400);
  }
  if (!Array.isArray(variantRows)) {
    variantRows = [];
  }

  let imagesMeta: ManualImageMeta[];
  try {
    imagesMeta = JSON.parse((form.get('imagesMeta') as string | null) ?? '[]');
  } catch {
    return json({ error: 'Invalid imagesMeta payload' }, 400);
  }

  let pricingMatrix: ManualPricingMatrix | null = null;
  const rawPricingMatrix = (form.get('pricingMatrix') as string | null) ?? '';
  if (rawPricingMatrix.trim().length > 0) {
    try {
      const parsed = JSON.parse(rawPricingMatrix) as Partial<ManualPricingMatrix> | null;
      if (parsed && typeof parsed === 'object') {
        pricingMatrix = {
          audience: parsed.audience?.trim() ?? '',
          product: parsed.product?.trim() ?? '',
          garment: parsed.garment?.trim() ?? '',
          printSurface: parsed.printSurface?.trim() ?? '',
          manufacturingCost: parsed.manufacturingCost?.trim() ?? '',
          saleCost: parsed.saleCost?.trim() ?? '',
          deliveryRetail: parsed.deliveryRetail?.trim() ?? parsed.delivery?.trim() ?? '',
          deliveryPartner: parsed.deliveryPartner?.trim() ?? parsed.delivery?.trim() ?? '',
          deliveryOnlinePartnership: parsed.deliveryOnlinePartnership?.trim() ?? parsed.delivery?.trim() ?? '',
          salePrice: parsed.salePrice?.trim() ?? '',
          partnerPrice: parsed.partnerPrice?.trim() ?? '',
        };
      }
    } catch {
      return json({ error: 'Invalid pricingMatrix payload' }, 400);
    }
  }

  if (pricingMatrix && pricingMatrix.salePrice.trim().length === 0) {
    pricingMatrix.salePrice = '24.99';
  }

  const imageFiles = form.getAll('images').filter((v): v is File => v instanceof File);
  if (variantRows.length === 0) {
    return json({ error: 'Select at least one colour' }, 400);
  }

  const ranges = await listRanges(env.DB);
  const defaultRange = ranges.find((range) => range.storefrontEnabled && range.partnerEnabled) ?? ranges[0] ?? null;
  const rangeId = rangeIdRaw || defaultRange?.id || null;
  if (rangeId && !(await getRangeById(env.DB, rangeId))) {
    return json({ error: 'Selected range not found' }, 400);
  }

  const colorSource = variantRows
    .filter((row) => row.color?.trim())
    .map((row) => ({ name: row.color.trim(), hex: row.hex || '#cccccc' }));

  const id = crypto.randomUUID();
  const printifyId = crypto.randomUUID();

  const salePrice = pricingMatrix?.salePrice ? Math.round(parseFloat(pricingMatrix.salePrice) * 100) : 0;
  const variants: PrintifyVariant[] = variantRows.map((row, index) => ({
    id:        index + 1,
    color:     row.color?.trim() ?? '',
    size:      row.size?.trim() ?? '',
    price:     Math.round(row.price) || 0,
    available: true,
  }));

  const colorHexByName = new Map(
    colorSource.map((color) => [color.name.trim(), color.hex.trim() || '#cccccc'] as const),
  );

  const { colors, sizes, minPrice, maxPrice } = deriveProductAggregates(variants, colorHexByName, Number.isFinite(salePrice) ? salePrice : 0);

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
    rangeId,
    audience,
    productType,
    garment,
    images,
    variants,
    colors,
    pricingMatrix,
    hiddenColors: [],
    isEnabled,
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
    rangeId?: string | null;
    audience?: string;
    productType?: string;
    garment?: string;
    pricingMatrix?: {
      audience?: string;
      product?: string;
      garment?: string;
      printSurface?: string;
      manufacturingCost?: string;
      saleCost?: string;
      delivery?: string;
      salePrice?: string;
      partnerPrice?: string;
    } | null;
    isEnabled?: boolean;
    sizeGuideImage?: string | null;
    hiddenColors?: unknown;
    colors?: Array<{ name?: string; hex?: string }>;
  };
  try {
    body = await request.json() as {
      title?: string;
      description?: string;
      category?: string;
      rangeId?: string | null;
      audience?: string;
      productType?: string;
      garment?: string;
      pricingMatrix?: {
        audience?: string;
        product?: string;
        garment?: string;
        printSurface?: string;
        manufacturingCost?: string;
        saleCost?: string;
        delivery?: string;
        salePrice?: string;
        partnerPrice?: string;
      } | null;
      isEnabled?: boolean;
      sizeGuideImage?: string | null;
      hiddenColors?: unknown;
      colors?: Array<{ name?: string; hex?: string }>;
    };
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  if (
    !('title' in body) &&
    !('description' in body) &&
    !('category' in body) &&
    !('rangeId' in body) &&
    !('audience' in body) &&
    !('productType' in body) &&
    !('garment' in body) &&
    !('pricingMatrix' in body) &&
    !('isEnabled' in body) &&
    !('sizeGuideImage' in body) &&
    !('hiddenColors' in body) &&
    !('colors' in body)
  ) {
    return json({ error: 'No recognised fields to update' }, 400);
  }

  const title = body.title !== undefined ? body.title.trim() : undefined;
  if (title !== undefined && title.length === 0) {
    return json({ error: 'Title cannot be empty' }, 400);
  }

  const description = body.description !== undefined ? body.description.trim() : undefined;
  const category = body.category !== undefined ? body.category.trim() : undefined;
  const rangeId = body.rangeId !== undefined ? body.rangeId?.trim() || null : undefined;
  const audience = body.audience !== undefined ? body.audience.trim() : undefined;
  const productType = body.productType !== undefined ? body.productType.trim() : undefined;
  const garment = body.garment !== undefined ? body.garment.trim() : undefined;
  const sizeGuideImage = body.sizeGuideImage !== undefined ? body.sizeGuideImage?.trim() || null : undefined;
  const pricingMatrix = body.pricingMatrix === null
    ? null
    : body.pricingMatrix !== undefined
      ? {
          audience: body.pricingMatrix.audience?.trim() || '',
          product: body.pricingMatrix.product?.trim() || '',
          garment: body.pricingMatrix.garment?.trim() || '',
          printSurface: body.pricingMatrix.printSurface?.trim() || '',
          manufacturingCost: body.pricingMatrix.manufacturingCost?.trim() || '',
          saleCost: body.pricingMatrix.saleCost?.trim() || '',
          deliveryRetail: body.pricingMatrix.deliveryRetail?.trim() || body.pricingMatrix.delivery?.trim() || '',
          deliveryPartner: body.pricingMatrix.deliveryPartner?.trim() || body.pricingMatrix.delivery?.trim() || '',
          deliveryOnlinePartnership: body.pricingMatrix.deliveryOnlinePartnership?.trim() || body.pricingMatrix.delivery?.trim() || '',
          salePrice: body.pricingMatrix.salePrice?.trim() || '',
          partnerPrice: body.pricingMatrix.partnerPrice?.trim() || '',
        }
      : undefined;
  const colors = body.colors !== undefined
    ? body.colors
        .filter((color): color is { name: string; hex: string } => typeof color?.name === 'string')
        .map((color) => ({
          name: color.name.trim(),
          hex: typeof color.hex === 'string' && color.hex.trim().length > 0 ? color.hex.trim() : '#111827',
        }))
        .filter((color) => color.name.length > 0)
    : undefined;

  if (rangeId !== undefined && rangeId !== null) {
    const range = await getRangeById(env.DB, rangeId);
    if (!range) return json({ error: 'Selected range not found' }, 400);
  }

  let updated = await updateProductFields(env.DB, printifyId, {
    title,
    description,
    category,
    rangeId,
    audience,
    productType,
    garment,
    pricingMatrix,
    colors,
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

  const knownColors = await getAllowedImageColors(env, product);
  if (color && !isKnownColor(color, knownColors)) {
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
      ? getVariantIdsForColor(product, color)
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

export async function handleDeleteProductImage(
  env: Env,
  printifyId: string,
  request: Request,
): Promise<Response> {
  const url = new URL(request.url);
  const storageKey = url.searchParams.get('storageKey')?.trim() || '';
  if (!storageKey) {
    return json({ error: 'Missing storageKey' }, 400);
  }

  const product = await getProductByPrintifyIdForAdmin(env.DB, printifyId);
  if (!product) return json({ error: 'Product not found' }, 404);

  const image = product.images.find((entry) => entry.storageKey === storageKey);
  if (!image) return json({ error: 'Image not found' }, 404);

  if (image.storageKey) {
    await deleteAsset(env.IMAGES, image.storageKey);
  }

  const remaining = product.images.filter((entry) => entry.storageKey !== storageKey);
  if (remaining.length > 0 && !remaining.some((entry) => entry.isDefault)) {
    remaining[0].isDefault = true;
  }

  const updated = await updateProductImages(env.DB, printifyId, remaining);
  if (!updated) return json({ error: 'Product not found' }, 404);

  return json({ success: true });
}

export async function handleUpdateProductImage(
  env: Env,
  printifyId: string,
  request: Request,
): Promise<Response> {
  let body: { storageKey?: string; color?: string | null; isDefault?: boolean; order?: string[] };
  try {
    body = await request.json() as { storageKey?: string; color?: string | null; isDefault?: boolean; order?: string[] };
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const product = await getProductByPrintifyIdForAdmin(env.DB, printifyId);
  if (!product) return json({ error: 'Product not found' }, 404);

  if (Array.isArray(body.order) && body.order.length > 0) {
    const knownImages = new Map(
      product.images
        .filter((entry) => Boolean(entry.storageKey))
        .map((entry) => [entry.storageKey as string, entry] as const),
    );
    const seen = new Set<string>();
    const reordered = body.order
      .map((key) => key.trim())
      .filter((key) => key.length > 0 && knownImages.has(key) && !seen.has(key))
      .map((key) => {
        seen.add(key);
        return { ...knownImages.get(key)! };
      });

    for (const image of product.images) {
      if (!image.storageKey || seen.has(image.storageKey)) continue;
      reordered.push({ ...image });
    }

    if (!reordered.some((entry) => entry.isDefault) && reordered.length > 0) {
      reordered[0].isDefault = true;
    }

    const updated = await updateProductImages(env.DB, printifyId, reordered);
    if (!updated) return json({ error: 'Product not found' }, 404);

    return json({ success: true, images: reordered });
  }

  const storageKey = body.storageKey?.trim() || '';
  if (!storageKey) {
    return json({ error: 'Missing storageKey' }, 400);
  }

  const index = product.images.findIndex((entry) => entry.storageKey === storageKey);
  if (index < 0) return json({ error: 'Image not found' }, 404);

  const knownColors = await getAllowedImageColors(env, product);
  const nextColor = body.color === null ? '' : body.color?.trim() ?? '';
  if (nextColor && !isKnownColor(nextColor, knownColors)) {
    return json({ error: `Unknown colour: ${nextColor}` }, 400);
  }

    const images = product.images.map((entry) => ({ ...entry }));
  const image = images[index];
  image.color = nextColor || undefined;
  image.variantIds = nextColor
    ? getVariantIdsForColor(product, nextColor)
    : product.variants.map((variant) => variant.id);

  if (body.isDefault === true) {
    images.forEach((entry) => {
      entry.isDefault = entry.storageKey === storageKey;
    });
    images.sort((a, b) => {
      if (a.isDefault === b.isDefault) return 0;
      return a.isDefault ? -1 : 1;
    });
  }

  if (!images.some((entry) => entry.isDefault) && images.length > 0) {
    images[0].isDefault = true;
  }

  const updated = await updateProductImages(env.DB, printifyId, images);
  if (!updated) return json({ error: 'Product not found' }, 404);

  return json({ success: true, image, images });
}

export async function handleListLogs(env: Env): Promise<Response> {
  const [syncLogs, webhookLogs] = await Promise.all([
    listSyncLogs(env.DB),
    listWebhookLogs(env.DB),
  ]);
  return json({ syncLogs, webhookLogs });
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
  const allowedCatalogKeys = [
    'catalog_audience_options',
    'catalog_product_options',
    'catalog_garment_options',
    'catalog_color_options',
    'catalog_pricing_rows',
  ];
  for (const [key, value] of Object.entries(body)) {
    if (!allowed.includes(key) && !allowedCatalogKeys.includes(key)) return json({ error: `Unknown setting: ${key}` }, 400);
    if (key === 'fulfillment_provider') {
      await setSetting(env.DB, key, 'manual');
      continue;
    }
    await setSetting(env.DB, key, value);
  }

  return json({ success: true });
}

export async function handleListDiscountCodes(env: Env): Promise<Response> {
  const discountCodes = await listDiscountCodes(env.DB);
  return json({ discountCodes });
}

export async function handleCreateDiscountCode(env: Env, request: Request): Promise<Response> {
  let body: {
    code?: string;
    kind?: string;
    value?: number | string;
    usageLimit?: number | string | null;
    active?: boolean;
    expiresAt?: string | null;
    notes?: string | null;
  };

  try {
    body = await request.json() as typeof body;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const code = body.code?.trim();
  const kind = body.kind === 'fixed' || body.kind === 'percent' ? body.kind : null;
  const value = typeof body.value === 'string' ? Number(body.value) : body.value;

  if (!code) return json({ error: 'Code is required' }, 400);
  if (!kind) return json({ error: 'Kind must be percent or fixed' }, 400);
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return json({ error: 'Value must be greater than zero' }, 400);
  }

  try {
    const discountCode = await createDiscountCode(env.DB, {
      code,
      kind,
      value,
      usageLimit: parseOptionalInt(body.usageLimit),
      active: body.active ?? true,
      expiresAt: body.expiresAt ?? null,
      notes: body.notes ?? null,
    });
    return json({ discountCode }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 400);
  }
}

export async function handleUpdateDiscountCode(env: Env, id: string, request: Request): Promise<Response> {
  let body: {
    code?: string;
    kind?: string;
    value?: number | string;
    usageLimit?: number | string | null;
    active?: boolean;
    expiresAt?: string | null;
    notes?: string | null;
  };

  try {
    body = await request.json() as typeof body;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const existing = await getDiscountCodeById(env.DB, id);
  if (!existing) return json({ error: 'Discount code not found' }, 404);

  const code = body.code?.trim() ?? existing.code;
  const kind = body.kind === 'fixed' || body.kind === 'percent' ? body.kind : existing.kind;
  const valueRaw = typeof body.value === 'string' ? Number(body.value) : body.value;
  const value = valueRaw ?? existing.value;
  if (!code) return json({ error: 'Code is required' }, 400);
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return json({ error: 'Value must be greater than zero' }, 400);
  }

  try {
    const discountCode = await updateDiscountCode(env.DB, id, {
      code,
      kind,
      value,
      usageLimit: parseOptionalInt(body.usageLimit) ?? existing.usageLimit,
      active: body.active ?? existing.active,
      expiresAt: body.expiresAt ?? existing.expiresAt,
      notes: body.notes ?? existing.notes,
    });

    if (!discountCode) return json({ error: 'Discount code not found' }, 404);
    return json({ discountCode });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 400);
  }
}

export async function handleDeleteDiscountCode(env: Env, id: string): Promise<Response> {
  const existing = await getDiscountCodeById(env.DB, id);
  if (!existing) return json({ error: 'Discount code not found' }, 404);

  await deleteDiscountCode(env.DB, id);
  return json({ success: true });
}

export async function handleListPartners(env: Env): Promise<Response> {
  const partners = await listPartners(env.DB);
  return json({ partners });
}

export async function handleCreatePartner(env: Env, request: Request): Promise<Response> {
  let body: {
    slug?: string;
    name?: string;
    discountCode?: string | null;
    accessToken?: string;
    commissionRate?: number | string;
    description?: string | null;
    active?: boolean;
    collaborationEnabled?: boolean;
    collaborationDesign?: PartnerInput['collaborationDesign'];
  };

  try {
    body = await request.json().catch(() => ({})) as typeof body;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const slug = body.slug?.trim();
  const name = body.name?.trim();
  const accessToken = body.accessToken?.trim();
  const commissionRate = typeof body.commissionRate === 'string' ? Number(body.commissionRate) : body.commissionRate;

  if (!slug) return json({ error: 'Partner code is required' }, 400);
  if (!name) return json({ error: 'Name is required' }, 400);
  if (!accessToken) return json({ error: 'Access token is required' }, 400);
  if (typeof commissionRate !== 'number' || !Number.isFinite(commissionRate) || commissionRate < 0) {
    return json({ error: 'Commission rate must be a non-negative number' }, 400);
  }

  try {
    const partner = await createPartner(env.DB, {
      slug,
      name,
      discountCode: body.discountCode?.trim() || null,
      accessToken,
      commissionRate,
      description: body.description?.trim() || null,
      active: body.active !== false,
      collaborationEnabled: body.collaborationEnabled === true,
      collaborationDesign: body.collaborationDesign ?? null,
    });
    return json({ partner }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 400);
  }
}

export async function handleUpdatePartner(env: Env, id: string, request: Request): Promise<Response> {
  let body: {
    slug?: string;
    name?: string;
    discountCode?: string | null;
    accessToken?: string;
    commissionRate?: number | string;
    description?: string | null;
    active?: boolean;
    collaborationEnabled?: boolean;
    collaborationDesign?: PartnerInput['collaborationDesign'];
  };

  try {
    body = await request.json().catch(() => ({})) as typeof body;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const existing = await getPartnerById(env.DB, id);
  if (!existing) return json({ error: 'Partner not found' }, 404);

  const slug = body.slug?.trim() ?? existing.slug;
  const name = body.name?.trim() ?? existing.name;
  const accessToken = body.accessToken?.trim();
  const commissionRate = typeof body.commissionRate === 'string' ? Number(body.commissionRate) : (body.commissionRate ?? existing.commissionRate);

  if (!slug) return json({ error: 'Partner code is required' }, 400);
  if (!name) return json({ error: 'Name is required' }, 400);
  if (!Number.isFinite(commissionRate) || commissionRate < 0) {
    return json({ error: 'Commission rate must be a non-negative number' }, 400);
  }

  try {
    const partner = await updatePartner(env.DB, id, {
      slug,
      name,
      discountCode: body.discountCode?.trim() || null,
      accessToken: accessToken || undefined,
      commissionRate,
      description: body.description?.trim() || null,
      active: body.active ?? existing.active,
      collaborationEnabled: body.collaborationEnabled ?? existing.collaborationEnabled,
      collaborationDesign: body.collaborationDesign === undefined ? undefined : body.collaborationDesign,
    });

    if (!partner) return json({ error: 'Partner not found' }, 404);
    return json({ partner });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 400);
  }
}

export async function handleDeletePartner(env: Env, id: string): Promise<Response> {
  const existing = await getPartnerById(env.DB, id);
  if (!existing) return json({ error: 'Partner not found' }, 404);

  await deletePartner(env.DB, id);
  return json({ success: true });
}

export async function handleListPartnerStockOrders(env: Env): Promise<Response> {
  const orders = await listPartnerStockOrders(env.DB);
  return json({ orders });
}

export async function handleDeletePartnerStockOrder(env: Env, id: string): Promise<Response> {
  const existing = await getPartnerStockOrderWithItems(env.DB, id);
  if (!existing) return json({ error: 'Stock order not found' }, 404);
  if (existing.status !== 'archived') {
    return json({ error: 'Archive the stock order before deleting it' }, 400);
  }

  const deleted = await deletePartnerStockOrder(env.DB, id);
  if (!deleted) return json({ error: 'Stock order not found' }, 404);
  return json({ success: true });
}

const validPartnerStockOrderStatuses: PartnerStockOrderStatus[] = ['submitted', 'fulfilled', 'cancelled', 'archived'];

export async function handleUpdatePartnerStockOrderStatus(
  env: Env,
  id: string,
  request: Request,
): Promise<Response> {
  let body: { status?: string };
  try {
    body = await request.json() as { status?: string };
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const status = body.status?.trim();
  if (!status || !validPartnerStockOrderStatuses.includes(status as PartnerStockOrderStatus)) {
    return json({ error: 'Invalid status' }, 400);
  }

  const updated = await updatePartnerStockOrderStatus(env.DB, id, status as PartnerStockOrderStatus);
  if (!updated) return json({ error: 'Stock order not found' }, 404);

  return json({ success: true, status });
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function parseOptionalInt(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}
