import type { D1Database } from '@cloudflare/workers-types';
import type {
  Product,
  ProductRow,
  PrintifyProductImage,
  PrintifyVariant,
  PrintifyColor,
  PricingMatrixRow,
} from '../../types/index.js';
import { DEFAULT_SIZE_OPTIONS } from '../../types/catalog.js';
import { DEFAULT_CATALOG_OPTIONS } from '../../src/lib/catalog.js';
import { deriveProductAggregates } from './aggregates.js';

const DEFAULT_FALLBACK_COLORS: PrintifyColor[] = [
  { name: 'Black', hex: '#111827' },
  { name: 'Dark Grey', hex: '#374151' },
  { name: 'Navy', hex: '#1e3a8a' },
  { name: 'White', hex: '#f9fafb' },
  { name: 'Natural', hex: '#f5f1e8' },
  { name: 'True Royal', hex: '#1d4ed8' },
  { name: 'Military Green', hex: '#4b5d43' },
  { name: 'Mauve', hex: '#d48a8a' },
  { name: 'Sage', hex: '#b6c0a8' },
];

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

function isEmptyObject(value: unknown): value is Record<string, never> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0);
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

function normalizeSizes(sizes: unknown[]): string[] {
  return Array.from(
    new Set(
      sizes
        .filter((size): size is string => typeof size === 'string')
        .map((size) => size.trim())
        .filter((size) => size.length > 0),
    ),
  );
}

function normalizeColorName(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeColor(value: unknown): PrintifyColor | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as { name?: unknown; hex?: unknown };
  if (typeof candidate.name !== 'string') return null;
  const name = candidate.name.trim();
  if (!name) return null;
  const hex = typeof candidate.hex === 'string' && candidate.hex.trim().length > 0
    ? candidate.hex.trim()
    : '#111827';
  return { name, hex };
}

function normalizeColors(colors: unknown[]): PrintifyColor[] {
  const seen = new Set<string>();
  const normalized: PrintifyColor[] = [];
  for (const value of colors) {
    const color = normalizeColor(value);
    if (!color) continue;
    const key = normalizeColorName(color.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    normalized.push(color);
  }
  return normalized;
}

function mergeColors(...groups: unknown[][]): PrintifyColor[] {
  const merged: PrintifyColor[] = [];
  const seen = new Set<string>();

  for (const group of groups) {
    for (const value of group) {
      const color = normalizeColor(value);
      if (!color) continue;
      const key = normalizeColorName(color.name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(color);
    }
  }

  return merged;
}

function filterVisibleColors(colors: PrintifyColor[], hiddenColors: Set<string>): PrintifyColor[] {
  return colors.filter((color) => !hiddenColors.has(normalizeColorName(color.name)));
}

function sortDefaultImageFirst(images: PrintifyProductImage[]): PrintifyProductImage[] {
  return [...images].sort((a, b) => {
    if (a.isDefault === b.isDefault) return 0;
    return a.isDefault ? -1 : 1;
  });
}

function parseSalePriceToPence(pricingMatrix: PricingMatrixRow | null): number {
  const fallbackSalePrice = DEFAULT_CATALOG_OPTIONS.pricingRows[0]?.salePrice?.trim() || '24.99';
  const parsed = parseFloat(pricingMatrix?.salePrice?.trim() || fallbackSalePrice);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function buildSyntheticVariantId(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  const signed = hash | 0;
  return signed === 0 ? -1 : (signed > 0 ? -signed : signed);
}

function buildSyntheticVariants(
  colors: PrintifyColor[],
  pricingMatrix: PricingMatrixRow | null,
  seedPrefix = '',
): PrintifyVariant[] {
  const salePrice = parseSalePriceToPence(pricingMatrix);
  return buildVariantMatrix(colors, salePrice, seedPrefix);
}

function buildVariantMatrix(colors: PrintifyColor[], salePrice: number, seedPrefix = ''): PrintifyVariant[] {
  const variants: PrintifyVariant[] = [];

  for (const color of colors) {
    for (const size of DEFAULT_SIZE_OPTIONS) {
      variants.push({
        id: buildSyntheticVariantId(`${seedPrefix}:${color.name}:${size}`),
        color: color.name,
        size,
        price: salePrice,
        available: true,
      });
    }
  }

  return variants;
}

interface ProductMetadata {
  baseCategory?: string;
  audience?: string;
  productType?: string;
  garment?: string;
  pricingMatrix?: PricingMatrixRow | null;
  colors?: PrintifyColor[];
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
      colors: Array.isArray(metadata.colors)
        ? normalizeColors(metadata.colors)
        : Array.isArray(metadata.customColors)
          ? normalizeColors(metadata.customColors)
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
  if (metadata.colors !== undefined) payload.colors = metadata.colors;

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
    colors: fields.customColors !== undefined ? fields.customColors : current.colors,
  });
}

function parseProduct(row: ProductRow, view: 'public' | 'admin' = 'public'): Product {
  const hiddenColors = normalizeHiddenColors(parseJsonArray<string>(row.hidden_colors));
  const hiddenColorSet = new Set(hiddenColors);
  const rawImages = parseJsonArray<PrintifyProductImage>(row.images);
  const rawVariants = parseJsonArray<PrintifyVariant>(row.variants);
  const rawColors = parseJsonArray<PrintifyColor>(row.colors);
  const rawCustomColors = parseJsonArray<PrintifyColor>(row.custom_colors);
  const rawSizes = normalizeSizes(parseJsonArray<string>(row.sizes));
  const pricingMatrix = parseJsonObject<PricingMatrixRow>(row.pricing_matrix);
  const categoryMetadata = parseProductMetadata(row.category);
  const effectivePricingMatrix = isEmptyObject(pricingMatrix) ? (categoryMetadata.pricingMatrix ?? null) : pricingMatrix;

  const adminColorSource = mergeColors(
    rawColors,
    rawCustomColors,
    categoryMetadata.colors ?? categoryMetadata.customColors ?? [],
    rawColors.length === 0 && rawCustomColors.length === 0 && !(categoryMetadata.colors?.length ?? categoryMetadata.customColors?.length ?? 0)
      ? DEFAULT_FALLBACK_COLORS
      : [],
  );
  const adminColors = normalizeColors(adminColorSource);
  const visibleColors = view === 'admin'
    ? adminColors
    : filterVisibleColors(adminColors, hiddenColorSet);
  const visibleColorSet = new Set(visibleColors.map((color) => normalizeColorName(color.name)));
  const syntheticVariants = buildSyntheticVariants(visibleColors, effectivePricingMatrix, row.id);
  const rawVariantColorSet = new Set(rawVariants.map((variant) => normalizeColorName(variant.color)));
  const missingColorVariants = syntheticVariants.filter((variant) => !rawVariantColorSet.has(normalizeColorName(variant.color)));
  const colors = view === 'admin'
    ? adminColors
    : visibleColors;

  const allVariants = view === 'admin'
    ? (rawVariants.length > 0 ? [...rawVariants, ...missingColorVariants] : syntheticVariants)
    : (() => {
        const selectedRawVariants = rawVariants.filter((variant) => visibleColorSet.has(normalizeColorName(variant.color)));
        return selectedRawVariants.length > 0
          ? [...selectedRawVariants, ...missingColorVariants]
          : syntheticVariants;
      })();
  const variants = (view === 'admin'
    ? allVariants
    : allVariants.filter((variant) => !hiddenColorSet.has(variant.color))
  ).map((variant) => ({
    ...variant,
    available: true,
  }));

  const orderedImages = sortDefaultImageFirst(rawImages);
  const images = view === 'admin'
    ? orderedImages
    : orderedImages.filter((image) => {
        if (image.isDefault) {
          return true;
        }
        if (image.color && !visibleColorSet.has(normalizeColorName(image.color))) {
          return false;
        }
        return true;
      });

  const colorHexByName = new Map(visibleColors.map((color) => [color.name, color.hex] as const));
  const aggregates = view === 'admin'
    ? deriveProductAggregates(
        rawVariants,
        new Map(rawColors.map((color) => [color.name, color.hex] as const)),
        parseSalePriceToPence(effectivePricingMatrix),
      )
    : deriveProductAggregates(variants, colorHexByName, parseSalePriceToPence(effectivePricingMatrix));

  return {
    id:             row.id,
    printifyId:     row.printify_id,
    title:          row.title,
    description:    row.description,
    category:       row.category,
    audience:       row.audience || categoryMetadata.audience || '',
    productType:    row.product_type || categoryMetadata.productType || '',
    garment:        row.garment || categoryMetadata.garment || '',
    pricingMatrix:  effectivePricingMatrix,
    images,
    variants,
    colors,
    customColors: view === 'admin' ? adminColors : visibleColors,
    hiddenColors,
    sizes:          rawSizes,
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
  isEnabled: boolean;
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
    .prepare('SELECT category, variants, colors, custom_colors, pricing_matrix FROM products WHERE printify_id = ?')
    .bind(printifyId)
    .first<{
      category: string;
      variants: string;
      colors: string | null;
      custom_colors: string | null;
      pricing_matrix: string | null;
    }>();

  if (!current) return false;
  const currentVariants = parseJsonArray<PrintifyVariant>(current.variants);
  const currentColors = parseJsonArray<PrintifyColor>(current.colors);
  const currentCustomColors = parseJsonArray<PrintifyColor>(current.custom_colors);
  const currentPricingMatrix = parseJsonObject<PricingMatrixRow>(current.pricing_matrix);
  const categoryMetadata = parseProductMetadata(current.category);
  const colorSource = currentColors.length > 0
    ? currentColors
    : currentCustomColors.length > 0
      ? currentCustomColors
      : categoryMetadata.colors?.length
        ? categoryMetadata.colors
        : DEFAULT_FALLBACK_COLORS;
  const normalizedColors = normalizeColors(colorSource);

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
        colors: fields.customColors,
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

  if (fields.customColors !== undefined) {
    sets.push('custom_colors = ?');
    values.push(JSON.stringify(normalizeColors(fields.customColors)));
  }

  if (fields.pricingMatrix !== undefined) {
    sets.push('pricing_matrix = ?');
    values.push(JSON.stringify(fields.pricingMatrix ?? {}));
  }

  const nextSalePrice = (fields.pricingMatrix?.salePrice?.trim() || currentPricingMatrix?.salePrice?.trim() || '');
  if (nextSalePrice) {
    const parsed = parseFloat(nextSalePrice);
    if (Number.isFinite(parsed)) {
      const unitPrice = Math.round(parsed * 100);
      const variants = currentVariants.length > 0
        ? currentVariants.map((variant) => ({
            ...variant,
            available: true,
            price: unitPrice,
          }))
        : buildVariantMatrix(normalizedColors.length > 0 ? normalizedColors : DEFAULT_FALLBACK_COLORS, unitPrice);
      const colorHexByName = new Map((normalizedColors.length > 0 ? normalizedColors : DEFAULT_FALLBACK_COLORS).map((color) => [color.name, color.hex] as const));
      const { minPrice, maxPrice } = deriveProductAggregates(variants, colorHexByName, unitPrice);

      sets.push('variants = ?', 'colors = ?', 'sizes = ?', 'min_price = ?', 'max_price = ?');
      values.push(JSON.stringify(variants), JSON.stringify(normalizedColors.length > 0 ? normalizedColors : DEFAULT_FALLBACK_COLORS), JSON.stringify(DEFAULT_SIZE_OPTIONS), minPrice, maxPrice);
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
  const existing = await db
    .prepare('SELECT custom_colors FROM products WHERE printify_id = ?')
    .bind(data.printifyId)
    .first<{ custom_colors: string | null }>();
  const existingCustomColors = parseJsonArray<PrintifyColor>(existing?.custom_colors);
  const nextCustomColors = data.customColors !== undefined ? data.customColors : existingCustomColors;
  const category = serializeProductMetadata({
    baseCategory: data.category,
    audience: data.audience,
    productType: data.productType,
    garment: data.garment,
    pricingMatrix: data.pricingMatrix ?? undefined,
    colors: nextCustomColors,
  });

  await db
    .prepare(`
      INSERT INTO products
        (id, printify_id, title, description, category, images, variants, colors, custom_colors, pricing_matrix, hidden_colors, sizes,
         min_price, max_price, is_enabled, size_guide_image, synced_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, datetime('now'), datetime('now'), datetime('now'))
      ON CONFLICT(printify_id) DO UPDATE SET
        is_enabled     = excluded.is_enabled,
        title          = excluded.title,
        description    = excluded.description,
        category       = excluded.category,
        images         = excluded.images,
        variants       = excluded.variants,
        colors         = excluded.colors,
        custom_colors  = excluded.custom_colors,
        pricing_matrix = excluded.pricing_matrix,
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
      JSON.stringify(nextCustomColors),
      JSON.stringify(data.pricingMatrix ?? {}),
      JSON.stringify(normalizeHiddenColors(data.hiddenColors ?? [])),
      JSON.stringify(data.sizes),
      data.minPrice,
      data.maxPrice,
      data.isEnabled ? 1 : 0,
    )
    .run();
}
