import type { D1Database } from '@cloudflare/workers-types';
import type {
  PrintifyApiProduct,
  PrintifyProductImage,
  PrintifyVariant,
  PrintifyColor,
} from '../../types/index.js';
import type { Env } from '../../types/env.js';
import { listProducts, listProductsPage } from './client.js';
import {
  disableProductsMissingFromPrintify,
  setProductsEnabledByPrintifyIds,
  upsertProduct,
} from '../products/repository.js';
import { writeSyncLog } from '../orders/repository.js';
import { logger } from '../logging.js';
import { storeRemoteAsset } from '../assets/storage.js';

function extractVariantIdFromUrl(src: string): number | null {
  const match = src.match(/images\.printify\.com\/mockup\/[^/]+\/(\d+)\//);
  return match ? parseInt(match[1], 10) : null;
}

type ProductCore = {
  title: string;
  description: string;
  category: string;
  images: Array<{
    src: string;
    isDefault: boolean;
    variantIds: number[];
    color?: string;
  }>;
  variants: PrintifyVariant[];
  colors: PrintifyColor[];
  sizes: string[];
  minPrice: number;
  maxPrice: number;
};

function buildProductCore(raw: PrintifyApiProduct): ProductCore {
  const colorOption = raw.options.find(
    (o) => o.name.toLowerCase().includes('color'),
  );
  const sizeOption = raw.options.find(
    (o) => o.name.toLowerCase().includes('size'),
  );

  const colorMap = new Map<number, { name: string; hex: string }>();
  if (colorOption) {
    for (const v of colorOption.values) {
      colorMap.set(v.id, {
        name: v.title,
        hex: v.colors?.[0] ?? '#cccccc',
      });
    }
  }

  const sizeMap = new Map<number, string>();
  if (sizeOption) {
    for (const v of sizeOption.values) {
      sizeMap.set(v.id, v.title);
    }
  }

  const enabledVariants = raw.variants.filter((v) => v.is_enabled);

  const colors: PrintifyColor[] = [];
  const colorsSeen = new Set<string>();
  const sizesSeen = new Set<string>();

  const variants: PrintifyVariant[] = enabledVariants.map((v) => {
    let color = '';
    let hex   = '#cccccc';
    let size  = '';

    for (const optId of v.options) {
      if (colorMap.has(optId)) {
        const c = colorMap.get(optId)!;
        color = c.name;
        hex   = c.hex;
      } else if (sizeMap.has(optId)) {
        size = sizeMap.get(optId)!;
      }
    }

    // Fallback: parse the variant title (e.g. "Black / XL")
    if (!color) color = v.title.split(' / ')[0]?.trim() ?? '';
    if (!size)  size  = v.title.split(' / ')[1]?.trim() ?? '';

    if (color && !colorsSeen.has(color)) {
      colorsSeen.add(color);
      colors.push({ name: color, hex });
    }
    if (size) sizesSeen.add(size);

    return {
      id:        v.id,
      color,
      size,
      price:     v.price,
      available: v.is_available,
    };
  });

  const variantColorById = new Map<number, string>();
  for (const variant of variants) {
    variantColorById.set(variant.id, variant.color);
  }

  const images = raw.images
    .filter((image) => image.is_selected_for_publishing)
    .map((img) => {
      const urlVariantId = extractVariantIdFromUrl(img.src);
      const variantIds = urlVariantId !== null ? [urlVariantId] : img.variant_ids;
      const color =
        variantIds
          .map((id) => variantColorById.get(id))
          .find((value): value is string => !!value) ?? undefined;

      return {
        src: img.src,
        isDefault: img.is_default,
        variantIds,
        color,
      };
    });

  const prices = variants.map((v) => v.price);
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const maxPrice = prices.length ? Math.max(...prices) : 0;

  const standardSizeOrder = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
  const sizes = Array.from(sizesSeen).sort((a, b) => {
    const ai = standardSizeOrder.indexOf(a);
    const bi = standardSizeOrder.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return {
    title:       raw.title,
    description: raw.description,
    category:    'apparel',
    images,
    variants,
    colors,
    sizes,
    minPrice,
    maxPrice,
  };
}

async function transformProduct(raw: PrintifyApiProduct, env: Env): Promise<{
  id: string;
  printifyId: string;
  title: string;
  description: string;
  category: string;
  images: PrintifyProductImage[];
  variants: PrintifyVariant[];
  colors: PrintifyColor[];
  sizes: string[];
  minPrice: number;
  maxPrice: number;
}> {
  const core = buildProductCore(raw);
  const publishedImages: PrintifyProductImage[] = [];

  for (const image of core.images) {
    const stored = await storeRemoteAsset(
      env.IMAGES,
      env.SITE_URL,
      image.src,
      {
        kind: 'product-image',
        keyPrefix: `product-images/${raw.id}`,
        keySeed: `${raw.id}:${image.src}:${image.variantIds.join(',')}:${image.isDefault ? 'default' : 'alt'}`,
        metadata: {
          printifyId: raw.id,
          variantIds: JSON.stringify(image.variantIds),
          color: image.color ?? '',
        },
      },
    );

    publishedImages.push({
      src: stored.url,
      isDefault: image.isDefault,
      variantIds: image.variantIds,
      color: image.color,
      assetKind: 'product-image' as const,
      storageKey: stored.key,
      sourceUrl: image.src,
    });
  }

  return {
    id:          crypto.randomUUID(),
    printifyId:  raw.id,
    title:       core.title,
    description: core.description,
    category:    core.category,
    images:      publishedImages,
    variants:    core.variants,
    colors:      core.colors,
    sizes:       core.sizes,
    minPrice:    core.minPrice,
    maxPrice:    core.maxPrice,
  };
}

export interface SyncResult {
  productsFound: number;
  productsSynced: number;
  productsUnchanged: number;
  productsNew: number;
  productsUpdated: number;
  productsRemoved: number;
  errors: string[];
  currentPage: number;
  lastPage: number;
  hasMore: boolean;
  syncedPrintifyIds: string[];
  seenPrintifyIds: string[];
  changedProducts: Array<{
    printifyId: string;
    title: string;
    status: 'new' | 'updated';
  }>;
  removedPrintifyIds: string[];
}

function normalizeImageSnapshot(image: PrintifyProductImage): {
  sourceUrl: string;
  isDefault: boolean;
  variantIds: number[];
  color?: string;
} {
  return {
    sourceUrl: image.sourceUrl ?? image.src,
    isDefault: image.isDefault,
    variantIds: image.variantIds,
    color: image.color,
  };
}

function snapshotProduct(product: {
  title: string;
  description: string;
  category: string;
  images: Array<{
    src: string;
    isDefault: boolean;
    variantIds: number[];
    color?: string;
  }>;
  variants: PrintifyVariant[];
  colors: PrintifyColor[];
  sizes: string[];
  minPrice: number;
  maxPrice: number;
}): string {
  return JSON.stringify({
    title: product.title,
    description: product.description,
    category: product.category,
    images: product.images.map(normalizeImageSnapshot),
    variants: product.variants,
    colors: product.colors,
    sizes: product.sizes,
    minPrice: product.minPrice,
    maxPrice: product.maxPrice,
  });
}

export function previewProduct(raw: PrintifyApiProduct) {
  return buildProductCore(raw);
}

async function syncProductsPage(
  db: D1Database,
  env: Env,
  token: string,
  shopId: string,
  page: number,
  limit: number,
): Promise<SyncResult> {
  const errors: string[] = [];

  logger.info('Starting product sync page from Printify', { page, limit });

  const response = await listProductsPage(token, shopId, page, limit);
  const rawProducts = response.data ?? [];

  logger.info(`Fetched ${rawProducts.length} products from Printify`, {
    page: response.current_page,
    lastPage: response.last_page,
  });

  let synced = 0;
  let unchanged = 0;
  let newCount = 0;
  let updatedCount = 0;
  const syncedPrintifyIds: string[] = [];
  const seenPrintifyIds = rawProducts.map((raw) => raw.id);
  const changedProducts: Array<{ printifyId: string; title: string; status: 'new' | 'updated' }> = [];

  for (const raw of rawProducts) {
    try {
      const existing = await db
        .prepare('SELECT * FROM products WHERE printify_id = ?')
        .bind(raw.id)
        .first<import('../../types/index.js').ProductRow>();
      const core = buildProductCore(raw);
      const transformedSnapshot = snapshotProduct(core);
      const existingSnapshot = existing ? snapshotProduct({
        title: existing.title,
        description: existing.description,
        category: existing.category,
        images: JSON.parse(existing.images) as PrintifyProductImage[],
        variants: JSON.parse(existing.variants) as PrintifyVariant[],
        colors: JSON.parse(existing.colors) as PrintifyColor[],
        sizes: JSON.parse(existing.sizes) as string[],
        minPrice: existing.min_price,
        maxPrice: existing.max_price,
      }) : null;

      if (existingSnapshot === transformedSnapshot) {
        unchanged++;
        continue;
      }

      const transformed = await transformProduct(raw, env);
      await upsertProduct(db, transformed);
      syncedPrintifyIds.push(raw.id);
      synced++;
      if (existing) {
        updatedCount++;
        changedProducts.push({ printifyId: raw.id, title: raw.title, status: 'updated' });
      } else {
        newCount++;
        changedProducts.push({ printifyId: raw.id, title: raw.title, status: 'new' });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to sync product ${raw.id}`, { error: message });
      errors.push(`${raw.id}: ${message}`);
    }
  }

  await writeSyncLog(
    db,
    errors.length === 0 ? 'success' : 'error',
    synced,
    errors.length > 0 ? errors.join('; ') : null,
  );

  return {
    productsFound: rawProducts.length,
    productsSynced: synced,
    productsUnchanged: unchanged,
    productsNew: newCount,
    productsUpdated: updatedCount,
    productsRemoved: 0,
    errors,
    currentPage: response.current_page,
    lastPage: response.last_page,
    hasMore: response.current_page < response.last_page,
    syncedPrintifyIds,
    seenPrintifyIds,
    changedProducts,
    removedPrintifyIds: [],
  };
}

export async function previewPrintifySync(
  db: D1Database,
  _env: Env,
  token: string,
  shopId: string,
): Promise<{
  productsFound: number;
  newProducts: Array<{ printifyId: string; title: string }>;
  updatedProducts: Array<{ printifyId: string; title: string }>;
  removedProducts: Array<{ printifyId: string; title: string }>;
}> {
  const rawProducts = await listProducts(token, shopId);
  const existingRows = await db.prepare('SELECT * FROM products').all<import('../../types/index.js').ProductRow>();
  const existingByPrintifyId = new Map(
    (existingRows.results ?? []).map((row) => [row.printify_id, row]),
  );

  const newProducts: Array<{ printifyId: string; title: string }> = [];
  const updatedProducts: Array<{ printifyId: string; title: string }> = [];
  const seen = new Set<string>();

  for (const raw of rawProducts) {
    seen.add(raw.id);
    const core = buildProductCore(raw);
    const existing = existingByPrintifyId.get(raw.id);
    const transformedSnapshot = snapshotProduct(core);
    const existingSnapshot = existing ? snapshotProduct({
      title: existing.title,
      description: existing.description,
      category: existing.category,
      images: JSON.parse(existing.images) as PrintifyProductImage[],
      variants: JSON.parse(existing.variants) as PrintifyVariant[],
      colors: JSON.parse(existing.colors) as PrintifyColor[],
      sizes: JSON.parse(existing.sizes) as string[],
      minPrice: existing.min_price,
      maxPrice: existing.max_price,
    }) : null;

    if (!existing) {
      newProducts.push({ printifyId: raw.id, title: raw.title });
      continue;
    }

    if (existingSnapshot !== transformedSnapshot) {
      updatedProducts.push({ printifyId: raw.id, title: raw.title });
    }
  }

  const removedProducts = (existingRows.results ?? [])
    .filter((row) => !seen.has(row.printify_id))
    .map((row) => ({ printifyId: row.printify_id, title: row.title }));

  return {
    productsFound: rawProducts.length,
    newProducts,
    updatedProducts,
    removedProducts,
  };
}

export async function syncProductsPageByPage(
  db: D1Database,
  env: Env,
  token: string,
  shopId: string,
  page = 1,
  limit = 1,
): Promise<SyncResult> {
  return syncProductsPage(db, env, token, shopId, page, limit);
}

export async function reconcileSyncedProducts(
  db: D1Database,
  syncedPrintifyIds: string[],
): Promise<{ reenabled: number; hidden: number }> {
  const reenabled = await setProductsEnabledByPrintifyIds(
    db,
    syncedPrintifyIds,
    true,
  );

  const hidden = await disableProductsMissingFromPrintify(
    db,
    syncedPrintifyIds,
  );

  logger.info('Product enablement reconciled', {
    reenabled,
    hidden,
  });

  return { reenabled, hidden };
}

export async function syncProducts(
  db: D1Database,
  env: Env,
  token: string,
  shopId: string,
): Promise<SyncResult> {
  const errors: string[] = [];

  logger.info('Starting product sync from Printify');

  let rawProducts: PrintifyApiProduct[];
  try {
    rawProducts = await listProducts(token, shopId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Failed to fetch products from Printify', { error: message });
    await writeSyncLog(db, 'error', 0, `Failed to fetch from Printify: ${message}`);
    throw err;
  }

  logger.info(`Fetched ${rawProducts.length} products from Printify`);

  let synced = 0;
  const syncedPrintifyIds: string[] = [];

  for (const raw of rawProducts) {
    try {
      const transformed = await transformProduct(raw, env);
      await upsertProduct(db, transformed);
      syncedPrintifyIds.push(raw.id);
      synced++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`Failed to sync product ${raw.id}`, { error: message });
      errors.push(`${raw.id}: ${message}`);
    }
  }

  logger.info('Product sync complete', { synced, errors: errors.length });

  await writeSyncLog(
    db,
    errors.length === 0 ? 'success' : 'error',
    synced,
    errors.length > 0 ? errors.join('; ') : null,
  );

  return {
    productsFound: rawProducts.length,
    productsSynced: synced,
    errors,
    currentPage: 1,
    lastPage: 1,
    hasMore: false,
    syncedPrintifyIds,
  };
}
