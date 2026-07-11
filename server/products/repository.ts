import type { D1Database } from '@cloudflare/workers-types';
import type {
  Product,
  ProductRow,
  PrintifyProductImage,
  PrintifyVariant,
  PrintifyColor,
  PricingMatrixRow,
} from '../../types/index.js';
import { deriveProductAggregates } from './aggregates.js';

function parseJsonArray<T>(value: string | null | undefined): T[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

function parseJsonObject<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed as T : null;
  } catch {
    return null;
  }
}

function normalizeHiddenColors(hiddenColors: unknown[]): string[] {
  return Array.from(
    new Set(
      hiddenColors
        .filter((color): color is string => typeof color === 'string')
        .map((color) => color.trim())
        .filter((color) => color.length > 0),
    ),
  );
}

interface ProductMetadata {
  baseCategory?: string;
  audience?: string;
  productType?: string;
  garment?: string;
  pricingMatrix?: PricingMatrixRow | null;
  customColors?: PrintifyColor[];
}

function parseProductMetadata(rawCategory: string | null | undefined): ProductMetadata {
  if (!rawCategory) return {};
  try {
    const parsed = JSON.parse(rawCategory);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    const metadata = parsed as Record<string, unknown>;
    return {
      baseCategory: typeof metadata.baseCategory === 'string' ? metadata.baseCategory : undefined,
      audience: typeof metadata.audience === 'string' ? metadata.audience : undefined,
      productType: typeof metadata.productType === 'string' ? metadata.productType : undefined,
      garment: typeof metadata.garment === 'string' ? metadata.garment : undefined,
      pricingMatrix: parseJsonObject<PricingMatrixRow>(
        typeof metadata.pricingMatrix === 'string'
          ? metadata.pricingMatrix
          : metadata.pricingMatrix && typeof metadata.pricingMatrix === 'object'
            ? JSON.stringify(metadata.pricingMatrix)
            : null,
      ),
      customColors: Array.isArray(metadata.customColors)
        ? metadata.customColors
            .filter((value): value is PrintifyColor => (
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
            .filter((value) => value.name.length > 0)
        : undefined,
    };
  } catch {
    return {};
  }
}

function serializeProductMetadata(metadata: ProductMetadata): string {
  const payload: Record<string, unknown> = {};

  if (metadata.baseCategory !== undefined) payload.baseCategory = metadata.baseCategory;
  if (metadata.audience !== undefined) payload.audience = metadata.audience;
  if (metadata.productType !== undefined) payload.productType = metadata.productType;
  if (metadata.garment !== undefined) payload.garment = metadata.garment;
  if (metadata.pricingMatrix !== undefined) payload.pricingMatrix = metadata.pricingMatrix;
  if (metadata.customColors !== undefined) payload.customColors = metadata.customColors;

  return JSON.stringify(payload);
}

function mergeProductMetadata(existingCategory: string | null | undefined, fields: ProductMetadata): string {
  const current = parseProductMetadata(existingCategory);
  return serializeProductMetadata({
    baseCategory: fields.baseCategory ?? current.baseCategory,
    audience: fields.audience ?? current.audience,
    productType: fields.productType ?? current.productType,
    garment: fields.garment ?? current.garment,
    pricingMatrix: fields.pricingMatrix !== undefined ? fields.pricingMatrix : current.pricingMatrix,
    customColors: fields.customColors !== undefined ? fields.customColors : current.customColors,
  });
}

function parseProduct(row: ProductRow, view: 'public' | 'admin' = 'public'): Product {
  const hiddenColors = normalizeHiddenColors(parseJsonArray<string>(row.hidden_colors));
  const hiddenColorSet = new Set(hiddenColors);
  const rawImages = parseJsonArray<PrintifyProductImage>(row.images);
  const rawVariants = parseJsonArray<PrintifyVariant>(row.variants);
  const rawColors = parseJsonArray<PrintifyColor>(row.colors);
  const rawCustomColors = parseJsonArray<PrintifyColor>(row.custom_colors);
  const pricingMatrix = parseJsonObject<PricingMatrixRow>(row.pricing_matrix);
  const categoryMetadata = parseProductMetadata(row.category);

  const colors = view === 'admin'
    ? rawColors
    : rawColors.filter((color) => !hiddenColorSet.has(color.name));
  const customColors = rawCustomColors.length > 0 ? rawCustomColors : (categoryMetadata.customColors ?? []);

  const variants = (view === 'admin'
    ? rawVariants
    : rawVariants.filter((variant) => !hiddenColorSet.has(variant.color))
  ).map((variant) => ({
    ...variant,
    available: true,
  }));

  const variantIds = new Set(variants.map((variant) => variant.id));
  const images = view === 'admin'
    ? rawImages
    : rawImages.filter((image) => {
        if (image.color && hiddenColorSet.has(image.color)) {
          return false;
        }
        if (image.variantIds.length === 0) {
          return true;
        }
        return image.variantIds.some((variantId) => variantIds.has(variantId));
      });

  const colorHexByName = new Map(colors.map((color) => [color.name, color.hex] as const));
  const aggregates = view === 'admin'
    ? deriveProductAggregates(rawVariants, new Map(rawColors.map((color) => [color.name, color.hex] as const)))
    : deriveProductAggregates(variants, colorHexByName);

  return {
    id:             row.id,
    printifyId:     row.printify_id,
    title:          row.title,
    description:    row.description,
    category:       row.category,
    audience:       row.audience || categoryMetadata.audience || '',
    productType:    row.product_type || categoryMetadata.productType || '',
    garment:        row.garment || categoryMetadata.garment || '',
    pricingMatrix:  pricingMatrix ?? categoryMetadata.pricingMatrix ?? null,
    images,
    variants,
    colors,
    customColors,
    hiddenColors,
    sizes:          aggregates.sizes,
    minPrice:       aggregates.minPrice,
    maxPrice:       aggregates.maxPrice,
    isEnabled:      row.is_enabled === 1,
    sizeGuideImage: row.size_guide_image ?? null,
    syncedAt:       row.synced_at,
    createdAt:      row.created_at,
    updatedAt:      row.updated_at,
  };
}

export async function getAllProducts(db: D1Database): Promise<Product[]> {
  const result = await db
    .prepare('SELECT * FROM products WHERE is_enabled = 1 ORDER BY title')
    .all<ProductRow>();
  return (result.results ?? []).map((row) => parseProduct(row, 'public'));
}

export async function getProductById(db: D1Database, id: string): Promise<Product | null> {
  const row = await db
    .prepare('SELECT * FROM products WHERE id = ? AND is_enabled = 1')
    .bind(id)
    .first<ProductRow>();
  return row ? parseProduct(row, 'public') : null;
}

export async function getProductByPrintifyId(
  db: D1Database,
  printifyId: string,
): Promise<Product | null> {
  const row = await db
    .prepare('SELECT * FROM products WHERE printify_id = ?')
    .bind(printifyId)
    .first<ProductRow>();
  return row ? parseProduct(row, 'public') : null;
}

export async function getAllProductsForAdmin(db: D1Database): Promise<Product[]> {
  const result = await db
    .prepare('SELECT * FROM products ORDER BY title')
    .all<ProductRow>();
  return (result.results ?? []).map((row) => parseProduct(row, 'admin'));
}

export async function listProductPrintifyIds(db: D1Database): Promise<string[]> {
  const result = await db
    .prepare('SELECT printify_id FROM products')
    .all<{ printify_id: string }>();

  return (result.results ?? []).map((row) => row.printify_id);
}

export async function setProductsEnabledByPrintifyIds(
  db: D1Database,
  printifyIds: string[],
  isEnabled: boolean,
): Promise<number> {
  if (printifyIds.length === 0) {
    if (isEnabled) return 0;

    const result = await db
      .prepare('UPDATE products SET is_enabled = 0, updated_at = datetime(\'now\') WHERE is_enabled = 1')
      .run();
    return result.meta?.changes ?? 0;
  }

  const placeholders = printifyIds.map(() => '?').join(', ');
  const result = await db
    .prepare(`
      UPDATE products
      SET is_enabled = ?,
          updated_at = datetime('now')
      WHERE printify_id IN (${placeholders})
    `)
    .bind(isEnabled ? 1 : 0, ...printifyIds)
    .run();

  return result.meta?.changes ?? 0;
}

export async function disableProductsMissingFromPrintify(
  db: D1Database,
  printifyIds: string[],
): Promise<number> {
  if (printifyIds.length === 0) {
    const result = await db
      .prepare('UPDATE products SET is_enabled = 0, updated_at = datetime(\'now\') WHERE is_enabled = 1')
      .run();
    return result.meta?.changes ?? 0;
  }

  const placeholders = printifyIds.map(() => '?').join(', ');
  const result = await db
    .prepare(`
      UPDATE products
      SET is_enabled = 0,
          updated_at = datetime('now')
      WHERE printify_id NOT IN (${placeholders})
        AND is_enabled = 1
    `)
    .bind(...printifyIds)
    .run();

  return result.meta?.changes ?? 0;
}

export interface UpsertProductData {
  id: string;
  printifyId: string;
  title: string;
  description: string;
  category: string;
  audience: string;
  productType: string;
  garment: string;
  pricingMatrix?: PricingMatrixRow | null;
  images: PrintifyProductImage[];
  variants: PrintifyVariant[];
  colors: PrintifyColor[];
  customColors?: PrintifyColor[];
  hiddenColors?: string[];
  sizes: string[];
  minPrice: number;
  maxPrice: number;
}

export async function updateSizeGuideImage(
  db: D1Database,
  printifyId: string,
  sizeGuideImage: string | null,
): Promise<boolean> {
  const result = await db
    .prepare(`UPDATE products SET size_guide_image = ?, updated_at = datetime('now') WHERE printify_id = ?`)
    .bind(sizeGuideImage, printifyId)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}

export async function updateProductImages(
  db: D1Database,
  printifyId: string,
  images: PrintifyProductImage[],
): Promise<boolean> {
  const result = await db
    .prepare(`UPDATE products SET images = ?, updated_at = datetime('now') WHERE printify_id = ?`)
    .bind(JSON.stringify(images), printifyId)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}

export async function deleteProductByPrintifyId(
  db: D1Database,
  printifyId: string,
): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM products WHERE printify_id = ?')
    .bind(printifyId)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}

export async function getProductByPrintifyIdForAdmin(
  db: D1Database,
  printifyId: string,
): Promise<Product | null> {
  const row = await db
    .prepare('SELECT * FROM products WHERE printify_id = ?')
    .bind(printifyId)
    .first<ProductRow>();
  return row ? parseProduct(row, 'admin') : null;
}

export async function updateHiddenColors(
  db: D1Database,
  printifyId: string,
  hiddenColors: string[],
): Promise<boolean> {
  const result = await db
    .prepare(`UPDATE products SET hidden_colors = ?, updated_at = datetime('now') WHERE printify_id = ?`)
    .bind(JSON.stringify(normalizeHiddenColors(hiddenColors)), printifyId)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}

export interface UpdateProductFields {
  title?: string;
  description?: string;
  category?: string;
  audience?: string;
  productType?: string;
  garment?: string;
  pricingMatrix?: PricingMatrixRow | null;
  customColors?: PrintifyColor[];
  isEnabled?: boolean;
  sizeGuideImage?: string | null;
  hiddenColors?: string[];
}

export async function updateProductFields(
  db: D1Database,
  printifyId: string,
  fields: UpdateProductFields,
): Promise<boolean> {
  const current = await db
    .prepare('SELECT category, variants FROM products WHERE printify_id = ?')
    .bind(printifyId)
    .first<{ category: string; variants: string }>();

  if (!current) return false;

  const setCategoryMetadata = (
    fields.category !== undefined ||
    fields.audience !== undefined ||
    fields.productType !== undefined ||
    fields.garment !== undefined ||
    fields.pricingMatrix !== undefined ||
    fields.customColors !== undefined
  );

  const nextCategory = setCategoryMetadata
    ? mergeProductMetadata(current.category, {
        baseCategory: fields.category !== undefined ? fields.category : parseProductMetadata(current.category).baseCategory,
        audience: fields.audience,
        productType: fields.productType,
        garment: fields.garment,
        pricingMatrix: fields.pricingMatrix,
        customColors: fields.customColors,
      })
    : undefined;

  const sets: string[] = [];
  const values: Array<string | number | null> = [];

  if (fields.title !== undefined) {
    sets.push('title = ?');
    values.push(fields.title);
  }

  if (fields.description !== undefined) {
    sets.push('description = ?');
    values.push(fields.description);
  }

  if (nextCategory !== undefined) {
    sets.push('category = ?');
    values.push(nextCategory);
  }

  if (fields.isEnabled !== undefined) {
    sets.push('is_enabled = ?');
    values.push(fields.isEnabled ? 1 : 0);
  }

  if (fields.sizeGuideImage !== undefined) {
    sets.push('size_guide_image = ?');
    values.push(fields.sizeGuideImage);
  }

  if (fields.hiddenColors !== undefined) {
    sets.push('hidden_colors = ?');
    values.push(JSON.stringify(normalizeHiddenColors(fields.hiddenColors)));
  }

  const nextSalePrice = fields.pricingMatrix?.salePrice?.trim();
  if (nextSalePrice) {
    const parsed = parseFloat(nextSalePrice);
    if (Number.isFinite(parsed)) {
      const unitPrice = Math.round(parsed * 100);
      const variants = parseJsonArray<PrintifyVariant>(current.variants).map((variant) => ({
        ...variant,
        available: true,
        price: unitPrice,
      }));
      const { minPrice, maxPrice } = deriveProductAggregates(variants);

      sets.push('variants = ?', 'min_price = ?', 'max_price = ?');
      values.push(JSON.stringify(variants), minPrice, maxPrice);
    }
  }

  if (sets.length === 0) return false;

  const result = await db
    .prepare(`UPDATE products SET ${sets.join(', ')}, updated_at = datetime('now') WHERE printify_id = ?`)
    .bind(...values, printifyId)
    .run();

  return (result.meta?.changes ?? 0) > 0;
}

export async function upsertProduct(
  db: D1Database,
  data: UpsertProductData,
): Promise<void> {
  const category = serializeProductMetadata({
    baseCategory: data.category,
    audience: data.audience,
    productType: data.productType,
    garment: data.garment,
    pricingMatrix: data.pricingMatrix ?? undefined,
    customColors: data.customColors ?? [],
  });

  await db
    .prepare(`
      INSERT INTO products
        (id, printify_id, title, description, category, images, variants, colors, hidden_colors, sizes,
         min_price, max_price, is_enabled, size_guide_image, synced_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, datetime('now'), datetime('now'), datetime('now'))
      ON CONFLICT(printify_id) DO UPDATE SET
        is_enabled     = 1,
        title          = excluded.title,
        description    = excluded.description,
        category       = excluded.category,
        images         = excluded.images,
        variants       = excluded.variants,
        colors         = excluded.colors,
        hidden_colors  = excluded.hidden_colors,
        sizes          = excluded.sizes,
        min_price      = excluded.min_price,
        max_price      = excluded.max_price,
        synced_at      = datetime('now'),
        updated_at     = datetime('now')
    `)
    .bind(
      data.id,
      data.printifyId,
      data.title,
      data.description,
      category,
      JSON.stringify(data.images),
      JSON.stringify(data.variants),
      JSON.stringify(data.colors),
      JSON.stringify(normalizeHiddenColors(data.hiddenColors ?? [])),
      JSON.stringify(data.sizes),
      data.minPrice,
      data.maxPrice,
    )
    .run();
}
