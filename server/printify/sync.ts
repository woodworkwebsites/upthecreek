import type { D1Database } from '@cloudflare/workers-types';
import type {
  PrintifyApiProduct,
  PrintifyProductImage,
  PrintifyVariant,
  PrintifyColor,
} from '../../types/index.js';
import { listProducts } from './client.js';
import { upsertProduct } from '../products/repository.js';
import { writeSyncLog } from '../orders/repository.js';
import { logger } from '../logging.js';

function transformProduct(raw: PrintifyApiProduct): {
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
} {
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

  const publishedImages: PrintifyProductImage[] = raw.images
    .filter((img) => img.is_selected_for_publishing)
    .map((img) => ({
      src:        img.src,
      isDefault:  img.is_default,
      variantIds: img.variant_ids,
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

  for (const raw of rawProducts) {
    try {
      const transformed = transformProduct(raw);
      await upsertProduct(db, transformed);
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
  };
}
