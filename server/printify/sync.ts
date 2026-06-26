import type { D1Database } from '@cloudflare/workers-types';
import type {
  PrintifyApiProduct,
  PrintifyProductImage,
  PrintifyVariant,
  PrintifyColor,
} from '../../types/index.js';
import type { Env } from '../../types/env.js';
import { listProducts } from './client.js';
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

  const publishedImages: PrintifyProductImage[] = await Promise.all(raw.images
    .filter((img) => img.is_selected_for_publishing)
    .map(async (img) => {
      // Printify assigns all mockup images to "all variants" in the variantIds array,
      // but each mockup URL encodes the specific variant it was rendered for:
      //   https://images.printify.com/mockup/{blueprint}/{VARIANT_ID}/{placement}/...
      // Extract that ID so we can surface the right colour image when a colour is selected.
      const urlVariantId = extractVariantIdFromUrl(img.src);
      const variantIds = urlVariantId !== null ? [urlVariantId] : img.variant_ids;
      const color =
        variantIds
          .map((id) => variantColorById.get(id))
          .find((value): value is string => !!value) ?? undefined;
      const stored = await storeRemoteAsset(
        env.IMAGES,
        env.SITE_URL,
        img.src,
        {
          kind: 'product-image',
          keyPrefix: `product-images/${raw.id}`,
          keySeed: `${raw.id}:${img.src}:${variantIds.join(',')}:${img.is_default ? 'default' : 'alt'}`,
          metadata: {
            printifyId: raw.id,
            variantIds: JSON.stringify(variantIds),
            color: color ?? '',
          },
        },
      );
      return {
        src:        stored.url,
        isDefault:  img.is_default,
        variantIds,
        color,
        assetKind:  'product-image' as const,
        storageKey: stored.key,
        sourceUrl:  img.src,
      };
    }));

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
    id:          crypto.randomUUID(),
    printifyId:  raw.id,
    title:       raw.title,
    description: raw.description,
    category:    'apparel',
    images:      publishedImages,
    variants,
    colors,
    sizes,
    minPrice,
    maxPrice,
  };
}

export interface SyncResult {
  productsFound: number;
  productsSynced: number;
  errors: string[];
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
  };
}
