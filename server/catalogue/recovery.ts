import type { R2Bucket } from '@cloudflare/workers-types';
import type { Env } from '../../types/env.js';
import { storeAssetData } from '../assets/storage.js';
import { updateProductImages } from '../products/repository.js';

const STREETSHIRTS_HOST = 'creation.streetshirts.com';
const STREETSHIRTS_PATH = '/designlab/designs/getcreationpreviewimage.aspx';
const PRODUCT_URL = 'https://sellshirts.com/product/';

type D1Product = {
  id: string;
  printify_id: string;
  title: string;
  garment: string;
  colors: string;
  images: string;
  variants: string;
  is_enabled: number;
};

function json<T>(value: string | null | undefined, fallback: T): T {
  try { return JSON.parse(value || '') as T; } catch { return fallback; }
}

function refFromUrl(value: unknown): string {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.replace(/^https?:\/\/sellshirts\.com\/product\//i, '').split(/[/?#]/, 1)[0];
}

function imageUrl(value: string): { creationId: string; side: string; sourceUrl: string } | null {
  try {
    const url = new URL(value, PRODUCT_URL);
    if (url.hostname.toLowerCase() !== STREETSHIRTS_HOST || url.pathname.toLowerCase() !== STREETSHIRTS_PATH) return null;
    const match = (url.searchParams.get('filename') || '').match(/^(.*)_(front|back)$/i);
    if (!match) return null;
    url.searchParams.set('size', '1000');
    return { creationId: match[1], side: match[2].toLowerCase(), sourceUrl: url.toString() };
  } catch { return null; }
}

function extractImages(html: string): Array<{ creationId: string; side: string; sourceUrl: string }> {
  const values: string[] = [];
  const attributePattern = /(?:src|data-src|data-lazy-src|href)\s*=\s*["']([^"']*getcreationpreviewimage\.aspx[^"']*)["']/gi;
  for (const match of html.matchAll(attributePattern)) values.push(match[1]);
  for (const match of html.matchAll(/https?:\/\/creation\.streetshirts\.com\/designlab\/designs\/getcreationpreviewimage\.aspx[^\s"'<>]+/gi)) values.push(match[0]);
  const unique = new Map<string, { creationId: string; side: string; sourceUrl: string }>();
  for (const value of values) {
    const result = imageUrl(value.replaceAll('&amp;', '&'));
    if (result) unique.set(`${result.creationId}|${result.side}`, result);
  }
  return [...unique.values()];
}

async function renderedProduct(env: Env, ref: string): Promise<{ images: ReturnType<typeof extractImages>; error?: string }> {
  if (!env.BROWSER) return { images: [], error: 'Browser Run binding BROWSER is not configured' };
  const response = await env.BROWSER.quickAction('content', {
    url: `${PRODUCT_URL}${encodeURIComponent(ref)}`,
    gotoOptions: { waitUntil: 'networkidle2', timeout: 30000 },
  });
  if (!response.ok) return { images: [], error: `Browser Run ${response.status}` };
  const body = await response.json() as { success?: boolean; result?: string };
  if (!body.success || typeof body.result !== 'string') return { images: [], error: 'Browser Run returned no rendered HTML' };
  const images = extractImages(body.result);
  return images.length ? { images } : { images, error: 'No Streetshirts front/back preview URLs found' };
}

async function hash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 24);
}

async function targetKey(printifyId: string, ref: string, image: { creationId: string; side: string; sourceUrl: string }): Promise<string> {
  return `product-images/${printifyId}/${await hash(`${printifyId}:${ref}:${image.creationId}:${image.side}:${image.sourceUrl}`)}.png`;
}

async function mapConcurrent<T, R>(values: T[], limit: number, worker: (value: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(values.length);
  let next = 0;
  async function consume() {
    while (true) {
      const index = next++;
      if (index >= values.length) return;
      results[index] = await worker(values[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, consume));
  return results;
}

export async function recoverCatalogueImages(env: Env, apply: boolean, refFilter?: string) {
  const query = await env.DB.prepare('SELECT id, printify_id, title, garment, colors, images, variants, is_enabled FROM products WHERE is_enabled = 1 ORDER BY title').all<D1Product>();
  const rows = query.results ?? [];
  const records = rows.flatMap((row) => json<Array<{ name?: string; orderUrl?: string }>>(row.colors, [])
    .map((color) => ({ row, color, ref: refFromUrl(color.orderUrl) }))
    .filter((record) => record.ref && (!refFilter || record.ref === refFilter)));
  const refs = [...new Set(records.map((record) => record.ref))];
  const products = new Map<string, Awaited<ReturnType<typeof renderedProduct>>>();
  const rendered = await mapConcurrent(refs, 4, async (ref) => {
    try { return await renderedProduct(env, ref); }
    catch (error) { return { images: [], error: error instanceof Error ? error.message : 'Browser Run failed' }; }
  });
  refs.forEach((ref, index) => products.set(ref, rendered[index]));
  const manifest: Array<Record<string, unknown>> = [];
  const pendingUpdates = new Map<string, { images: unknown[]; printifyId: string }>();
  for (const record of records) {
    const currentImages = json<unknown[]>(record.row.images, []);
    const variants = json<Array<{ id: number; color?: string }>>(record.row.variants, []);
    const product = products.get(record.ref);
    if (!product?.images.length) {
      manifest.push({ d1Record: record.row.printify_id, productId: record.row.id, title: record.row.title, garment: record.row.garment, colour: record.color.name || '', sellshirtsCatalogueRef: record.ref, creationId: '', side: '', sourceUrl: '', targetR2Key: '', status: 'error', error: product?.error || 'Product unresolved' });
      continue;
    }
    for (const image of product.images) {
      const key = await targetKey(record.row.printify_id, record.ref, image);
      const current = currentImages.find((entry) => (entry as { storageKey?: string })?.storageKey === key) as { storageKey?: string } | undefined;
      const objectExists = Boolean(current || await env.IMAGES.head(key));
      const entry = { d1Record: record.row.printify_id, productId: record.row.id, title: record.row.title, garment: record.row.garment, colour: record.color.name || '', sellshirtsCatalogueRef: record.ref, creationId: image.creationId, side: image.side, sourceUrl: image.sourceUrl, targetR2Key: key, status: objectExists ? 'existing' : 'recoverable', error: '' };
      if (apply && !objectExists) {
        const response = await fetch(image.sourceUrl);
        if (!response.ok) { entry.status = 'error'; entry.error = `Streetshirts image ${response.status}`; }
        else {
          const stored = await storeAssetData(env.IMAGES, await response.arrayBuffer(), response.headers.get('content-type') || 'image/png', { kind: 'product-image', keyPrefix: `product-images/${record.row.printify_id}`, keySeed: `${record.row.printify_id}:${record.ref}:${image.creationId}:${image.side}:${image.sourceUrl}`, sourceHint: 'image.png', metadata: { printifyId: record.row.printify_id, color: record.color.name || '', sourceUrl: image.sourceUrl } });
          entry.status = 'recovered';
          const existing = pendingUpdates.get(record.row.id) || { images: currentImages, printifyId: record.row.printify_id };
          existing.images.push({ src: stored.url, isDefault: !existing.images.some((item) => (item as { isDefault?: boolean })?.isDefault) && image.side === 'front', variantIds: variants.filter((variant) => String(variant.color).toLowerCase() === String(record.color.name).toLowerCase()).map((variant) => variant.id), color: record.color.name, assetKind: 'product-image', storageKey: stored.key, sourceUrl: image.sourceUrl });
          pendingUpdates.set(record.row.id, existing);
        }
      }
      manifest.push(entry);
    }
  }
  if (apply) {
    for (const [productId, update] of pendingUpdates) await updateProductImages(env.DB, update.printifyId, update.images as never);
  }
  return { generatedAt: new Date().toISOString(), dryRun: !apply, imageSize: '1000', d1CatalogueRecordsExamined: records.length, uniqueSellshirtsRefs: refs.length, refsSuccessfullyResolved: refs.filter((ref) => products.get(ref)?.images.length).length, frontImagesFound: manifest.filter((entry) => entry.side === 'front' && entry.status !== 'error').length, backImagesFound: manifest.filter((entry) => entry.side === 'back' && entry.status !== 'error').length, existingR2Images: manifest.filter((entry) => entry.status === 'existing').length, missingR2ImagesRecoverable: manifest.filter((entry) => entry.status === 'recoverable').length, unresolvedProductsOrErrors: manifest.filter((entry) => entry.status === 'error').length, manifest };
}
