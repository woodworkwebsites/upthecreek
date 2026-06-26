import type { D1Database } from '@cloudflare/workers-types';
import type {
  Product,
  ProductRow,
  PrintifyProductImage,
  PrintifyVariant,
  PrintifyColor,
} from '../../types/index.js';

function parseProduct(row: ProductRow): Product {
  return {
    id:             row.id,
    printifyId:     row.printify_id,
    title:          row.title,
    description:    row.description,
    category:       row.category,
    images:         JSON.parse(row.images)   as PrintifyProductImage[],
    variants:       JSON.parse(row.variants) as PrintifyVariant[],
    colors:         JSON.parse(row.colors)   as PrintifyColor[],
    sizes:          JSON.parse(row.sizes)    as string[],
    minPrice:       row.min_price,
    maxPrice:       row.max_price,
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
  return (result.results ?? []).map(parseProduct);
}

export async function getProductById(db: D1Database, id: string): Promise<Product | null> {
  const row = await db
    .prepare('SELECT * FROM products WHERE id = ? AND is_enabled = 1')
    .bind(id)
    .first<ProductRow>();
  return row ? parseProduct(row) : null;
}

export async function getProductByPrintifyId(
  db: D1Database,
  printifyId: string,
): Promise<Product | null> {
  const row = await db
    .prepare('SELECT * FROM products WHERE printify_id = ?')
    .bind(printifyId)
    .first<ProductRow>();
  return row ? parseProduct(row) : null;
}

export async function getAllProductsForAdmin(db: D1Database): Promise<Product[]> {
  const result = await db
    .prepare('SELECT * FROM products ORDER BY title')
    .all<ProductRow>();
  return (result.results ?? []).map(parseProduct);
}

export interface UpsertProductData {
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

export async function upsertProduct(
  db: D1Database,
  data: UpsertProductData,
): Promise<void> {
  await db
    .prepare(`
      INSERT INTO products
        (id, printify_id, title, description, category, images, variants, colors, sizes,
         min_price, max_price, is_enabled, synced_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'), datetime('now'))
      ON CONFLICT(printify_id) DO UPDATE SET
        title       = excluded.title,
        description = excluded.description,
        category    = excluded.category,
        images      = excluded.images,
        variants    = excluded.variants,
        colors      = excluded.colors,
        sizes       = excluded.sizes,
        min_price   = excluded.min_price,
        max_price   = excluded.max_price,
        synced_at   = datetime('now'),
        updated_at  = datetime('now')
    `)
    .bind(
      data.id,
      data.printifyId,
      data.title,
      data.description,
      data.category,
      JSON.stringify(data.images),
      JSON.stringify(data.variants),
      JSON.stringify(data.colors),
      JSON.stringify(data.sizes),
      data.minPrice,
      data.maxPrice,
    )
    .run();
}
