#!/usr/bin/env node

/**
 * Recover missing catalogue images from Sellshirts/Streetshirts.
 *
 * The script deliberately uses the existing product-images/{product id}/{hash}
 * R2 convention and the existing products.images JSON shape. It never writes
 * R2 or D1 unless --apply is supplied.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const STREETSHIRTS_HOST = 'creation.streetshirts.com';
const STREETSHIRTS_PATH = '/designlab/designs/getcreationpreviewimage.aspx';
const SELLSHIRTS_PRODUCT_URL = 'https://sellshirts.com/product/';
const IMAGE_SIZE = '1000';

const args = parseArgs(process.argv.slice(2));
const dryRun = !args.apply;
const renderMode = args.render || 'auto';
const checkR2 = !args['skip-r2-check'];
const outputPath = args.output || join('tmp', 'sellshirts-image-recovery-manifest.json');
const csvOutputPath = args.csv || outputPath.replace(/\.json$/i, '.csv');
const r2ExistenceCache = new Map();

function parseArgs(argv) {
  const result = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith('--')) {
      result._.push(item);
      continue;
    }
    const [key, inlineValue] = item.slice(2).split('=', 2);
    if (inlineValue !== undefined) result[key] = inlineValue;
    else if (argv[i + 1] && !argv[i + 1].startsWith('--')) result[key] = argv[++i];
    else result[key] = true;
  }
  return result;
}

function help() {
  console.log(`Usage: node scripts/recover-sellshirts-images.mjs [options]

Defaults to dry-run. Use --apply only after reviewing the manifest.

Options:
  --apply                    Upload missing images and update products.images in D1
  --database NAME            Wrangler D1 database (default: up-the-creek-orders)
  --bucket NAME              Wrangler R2 bucket (default: up-the-creek)
  --input FILE               Use D1 product rows from a JSON file instead of Wrangler
  --fixture FILE             Use fixture product pages keyed by ref (for tests)
  --output FILE              JSON manifest (default: tmp/sellshirts-image-recovery-manifest.json)
  --csv FILE                 CSV report (default: same basename as --output)
  --ref REF                  Limit the run to one Sellshirts catalogue ref
  --render auto|html|chrome|playwright (default: auto)
  --skip-r2-check            Skip slow remote R2 object reads; count D1 storageKey references as existing
  --self-test                Validate URL extraction with product 16294 fixture data
  --help                     Show this help
`);
}

if (args.help) {
  help();
  process.exit(0);
}

function ensureParent(file) {
  const parent = file.slice(0, Math.max(file.lastIndexOf('/'), 0));
  if (parent && !existsSync(parent)) {
    execFileSync('mkdir', ['-p', parent]);
  }
}

function stableHash(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 24);
}

function shellWrangler(argsList, options = {}) {
  return execFileSync('./node_modules/.bin/wrangler', argsList, {
    cwd: process.cwd(),
    env: process.env,
    encoding: options.encoding ?? 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
  });
}

function parseWranglerJson(raw) {
  const text = String(raw).trim();
  const start = Math.min(...[text.indexOf('{'), text.indexOf('[')].filter((n) => n >= 0));
  if (!Number.isFinite(start)) throw new Error(`Wrangler did not return JSON: ${text.slice(0, 500)}`);
  return JSON.parse(text.slice(start));
}

function loadProductRows() {
  if (args.input) {
    const value = JSON.parse(readFileSync(args.input, 'utf8'));
    if (Array.isArray(value)) {
      return value[0]?.results || value;
    }
    return value.results || value.rows || value.products || [];
  }
  const database = args.database || 'up-the-creek-orders';
  const query = `SELECT id, printify_id, title, garment, colors, images, variants, is_enabled FROM products WHERE is_enabled = 1 ORDER BY title`;
  const raw = shellWrangler(['d1', 'execute', database, '--remote', '--json', '--command', query]);
  const parsed = parseWranglerJson(raw);
  return parsed.result?.[0]?.results || parsed.results || parsed.result || [];
}

function parseJson(value, fallback) {
  try {
    const parsed = JSON.parse(value || '');
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function extractCatalogueRef(orderUrl) {
  const value = String(orderUrl || '').trim();
  if (!value) return '';
  if (value.startsWith(SELLSHIRTS_PRODUCT_URL)) return value.slice(SELLSHIRTS_PRODUCT_URL.length).split(/[?#/]/, 1)[0];
  return value.replace(/^https?:\/\/sellshirts\.com\/product\//i, '').split(/[?#/]/, 1)[0];
}

function imageUrlAt1000(value) {
  const url = new URL(value);
  url.searchParams.set('size', IMAGE_SIZE);
  return url.toString();
}

function imageDescriptor(value) {
  let url;
  try { url = new URL(value, 'https://sellshirts.com'); } catch { return null; }
  if (url.hostname.toLowerCase() !== STREETSHIRTS_HOST || url.pathname.toLowerCase() !== STREETSHIRTS_PATH) return null;
  const filename = url.searchParams.get('filename') || '';
  const match = filename.match(/^(.*)_(front|back)$/i);
  if (!match) return null;
  return {
    creationId: match[1],
    side: match[2].toLowerCase(),
    sourceUrl: imageUrlAt1000(url.toString()),
  };
}

function extractStreetshirtsImages(html, documentImages = []) {
  const candidates = [...documentImages];
  const pattern = /(?:src|data-src|data-lazy-src|href)\s*=\s*["']([^"']*getcreationpreviewimage\.aspx[^"']*)["']/gi;
  for (const match of html.matchAll(pattern)) candidates.push(match[1]);
  for (const match of html.matchAll(/https?:\/\/creation\.streetshirts\.com\/designlab\/designs\/getcreationpreviewimage\.aspx[^\s"'<>]+/gi)) candidates.push(match[0]);

  const unique = new Map();
  for (const candidate of candidates) {
    const decoded = String(candidate).replaceAll('&amp;', '&').replaceAll('\\/', '/');
    const descriptor = imageDescriptor(decoded);
    if (descriptor) unique.set(`${descriptor.creationId}|${descriptor.side}`, descriptor);
  }
  return [...unique.values()];
}

async function optionalPlaywrightPage(url) {
  try {
    const playwright = await import('playwright');
    const browser = await playwright.chromium.launch({ headless: true });
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(1500);
      const documentImages = await page.locator('img').evaluateAll((images) => images.map((image) => image.currentSrc || image.src).filter(Boolean));
      return { html: await page.content(), documentImages };
    } finally {
      await browser.close();
    }
  } catch (error) {
    if (renderMode === 'playwright') throw error;
    return null;
  }
}

async function chromeDumpDom(url) {
  const chrome = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (!existsSync(chrome)) return null;
  const profile = mkdtempSync(join(tmpdir(), 'utc-chrome-'));
  try {
    const html = execFileSync(chrome, [
      '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
      '--user-data-dir=' + profile, '--virtual-time-budget=12000', '--dump-dom', url,
    ], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
    return { html, documentImages: [] };
  } catch (error) {
    if (renderMode === 'chrome') throw error;
    return null;
  }
}

const pageCache = new Map();
async function resolveSellshirtsProduct(ref) {
  if (pageCache.has(ref)) return pageCache.get(ref);
  const pageUrl = `${SELLSHIRTS_PRODUCT_URL}${encodeURIComponent(ref)}`;
  let html = '';
  let method = 'initial-html';
  try {
    if (!args.fixture) {
      const response = await fetch(pageUrl, { redirect: 'follow', headers: { 'user-agent': 'UTC catalogue recovery/1.0' } });
      if (!response.ok) throw new Error(`Sellshirts page ${response.status} ${response.statusText}`);
      html = await response.text();
    } else {
      const fixture = parseJson(readFileSync(args.fixture, 'utf8'), {});
      html = fixture[ref]?.html || fixture[ref] || '';
    }
  } catch (error) {
    const result = { ref, pageUrl, images: [], error: error.message };
    pageCache.set(ref, result);
    return result;
  }

  let images = extractStreetshirtsImages(html);
  if (images.length === 0 && !args.fixture && renderMode !== 'html') {
    const rendered = renderMode === 'playwright' || renderMode === 'auto'
      ? await optionalPlaywrightPage(pageUrl)
      : null;
    const fallback = rendered || (renderMode === 'chrome' || renderMode === 'auto' ? await chromeDumpDom(pageUrl) : null);
    if (fallback) {
      method = rendered ? 'playwright' : 'chrome';
      images = extractStreetshirtsImages(fallback.html, fallback.documentImages);
    }
  }
  const result = { ref, pageUrl, images, method, error: images.length ? null : 'No Streetshirts front/back preview URLs found' };
  pageCache.set(ref, result);
  return result;
}

function targetKey(record, ref, image) {
  const seed = `${record.printifyId}:${ref}:${image.creationId}:${image.side}:${image.sourceUrl}`;
  return `product-images/${record.printifyId}/${stableHash(seed)}.png`;
}

function existingImage(record, key) {
  return record.images.find((image) => image && image.storageKey === key) || null;
}

function variantIdsForColor(record, color) {
  const variants = parseJson(record.variantRows, []);
  return variants.filter((variant) => String(variant.color || '').trim().toLowerCase() === color.trim().toLowerCase()).map((variant) => variant.id);
}

function buildRecords(rows) {
  const records = [];
  for (const row of rows) {
    if (!row?.id) continue;
    const colors = parseJson(row.colors, []);
    const images = parseJson(row.images, []);
    for (const color of colors) {
      const ref = extractCatalogueRef(color?.orderUrl);
      if (!ref || (args.ref && ref !== String(args.ref))) continue;
      records.push({
        productId: String(row.id),
        printifyId: String(row.printify_id || row.id),
        d1Record: String(row.printify_id || row.id),
        title: String(row.title || ''),
        garment: String(row.garment || ''),
        colour: String(color.name || ''),
        ref,
        images,
        variantRows: row.variants,
      });
    }
  }
  return records;
}

function r2Exists(bucket, key) {
  const cacheKey = `${bucket}/${key}`;
  if (r2ExistenceCache.has(cacheKey)) return r2ExistenceCache.get(cacheKey);
  let exists = false;
  try {
    shellWrangler(['r2', 'object', 'get', `${bucket}/${key}`, '--remote', '--pipe'], { encoding: 'buffer' });
    exists = true;
  } catch (error) {
    const message = String(error.stderr || error.message || '');
    if (!/not found|404|does not exist/i.test(message)) throw error;
  }
  r2ExistenceCache.set(cacheKey, exists);
  return exists;
}

async function fetchImage(image) {
  const response = await fetch(image.sourceUrl, { headers: { 'user-agent': 'UTC catalogue recovery/1.0' } });
  if (!response.ok) throw new Error(`Streetshirts image ${response.status} ${response.statusText}`);
  const body = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') || 'image/png';
  return { body, contentType };
}

function sqlQuote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function csvCell(value) {
  const text = value == null ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

async function mapConcurrent(values, limit, worker) {
  const results = new Array(values.length);
  let next = 0;
  async function consume() {
    while (true) {
      const index = next++;
      if (index >= values.length) return;
      results[index] = await worker(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, () => consume()));
  return results;
}

async function main() {
  const rows = loadProductRows();
  const records = buildRecords(rows);
  const uniqueRefs = [...new Set(records.map((record) => record.ref))];
  const resolved = new Map();
  const resolvedProducts = await mapConcurrent(uniqueRefs, 4, (ref) => resolveSellshirtsProduct(ref));
  uniqueRefs.forEach((ref, index) => resolved.set(ref, resolvedProducts[index]));

  const bucket = args.bucket || 'up-the-creek';
  const byProduct = new Map();
  const manifest = [];
  const existingR2Keys = new Set();
  const existingR2Errors = [];
  const currentR2Keys = [...new Set(records.flatMap((record) => record.images
    .filter((image) => image?.storageKey)
    .filter((image) => !image.color || records.some((candidate) => candidate.productId === record.productId && candidate.colour.trim().toLowerCase() === String(image.color).trim().toLowerCase()))
    .map((image) => image.storageKey)))];
  if (checkR2) {
    await mapConcurrent(currentR2Keys, 6, async (key) => {
      try {
        if (r2Exists(bucket, key)) existingR2Keys.add(key);
      } catch (error) {
        existingR2Errors.push(error.message);
      }
    });
  } else {
    currentR2Keys.forEach((key) => existingR2Keys.add(key));
  }
  for (const record of records) {
    const product = resolved.get(record.ref);
    if (!product?.images?.length) {
      manifest.push({ ...record, creationId: '', side: '', sourceUrl: '', targetR2Key: '', status: product?.error ? 'error' : 'missing', error: product?.error || 'Product unresolved' });
      continue;
    }
    for (const image of product.images) {
      const key = targetKey(record, record.ref, image);
      let status = existingImage(record, key) ? 'existing' : 'missing';
      let error = product.error || '';
      if (status === 'missing' && checkR2) {
        try {
          if (r2Exists(bucket, key)) status = 'existing';
        } catch (checkError) {
          status = 'error';
          error = `R2 existence check failed: ${checkError.message}`;
        }
      }
      const entry = {
        d1Record: record.d1Record,
        productId: record.productId,
        title: record.title,
        garment: record.garment,
        colour: record.colour,
        sellshirtsCatalogueRef: record.ref,
        creationId: image.creationId,
        side: image.side,
        sourceUrl: image.sourceUrl,
        targetR2Key: key,
        status: status === 'missing' ? 'recoverable' : status,
        error,
      };
      manifest.push(entry);
      if (!byProduct.has(record.productId)) byProduct.set(record.productId, { record, images: [...record.images] });
      if (!dryRun && (status === 'missing' || status === 'recoverable')) {
        try {
          const downloaded = await fetchImage(image);
          const tempFile = join(mkdtempSync(join(tmpdir(), 'utc-image-')), `${image.side}.png`);
          writeFileSync(tempFile, downloaded.body);
          shellWrangler(['r2', 'object', 'put', `${bucket}/${key}`, '--remote', '--file', tempFile, '--content-type', downloaded.contentType, '--force'], { stdio: ['ignore', 'pipe', 'pipe'] });
          entry.status = 'recovered';
          const hasDefault = byProduct.get(record.productId).images.some((item) => item.isDefault);
          byProduct.get(record.productId).images.push({
            src: `/api/images/${encodeURIComponent(key)}`,
            isDefault: !hasDefault && image.side === 'front',
            variantIds: variantIdsForColor(record, record.colour),
            color: record.colour,
            assetKind: 'product-image',
            storageKey: key,
            sourceUrl: image.sourceUrl,
          });
        } catch (downloadError) {
          entry.status = 'error';
          entry.error = downloadError.message;
        }
      }
    }
  }

  if (!dryRun && byProduct.size > 0) {
    const updates = [];
    for (const { record, images } of byProduct.values()) {
      if (!manifest.some((entry) => entry.productId === record.productId && entry.status === 'recovered')) continue;
      updates.push(`UPDATE products SET images = ${sqlQuote(JSON.stringify(images))}, updated_at = datetime('now') WHERE id = ${sqlQuote(record.productId)};`);
    }
    if (updates.length) {
      const sqlFile = join(mkdtempSync(join(tmpdir(), 'utc-d1-')), 'recovery.sql');
      writeFileSync(sqlFile, `BEGIN;\n${updates.join('\n')}\nCOMMIT;\n`);
      shellWrangler(['d1', 'execute', args.database || 'up-the-creek-orders', '--remote', '--file', sqlFile, '--yes'], { stdio: ['ignore', 'pipe', 'pipe'] });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    dryRun,
    imageSize: IMAGE_SIZE,
    d1CatalogueRecordsExamined: records.length,
    uniqueSellshirtsRefs: uniqueRefs.length,
    refsSuccessfullyResolved: uniqueRefs.filter((ref) => resolved.get(ref)?.images?.length).length,
    frontImagesFound: manifest.filter((entry) => entry.side === 'front' && ['existing', 'recoverable', 'recovered'].includes(entry.status)).length,
    backImagesFound: manifest.filter((entry) => entry.side === 'back' && ['existing', 'recoverable', 'recovered'].includes(entry.status)).length,
    existingR2Images: existingR2Keys.size + manifest.filter((entry) => entry.status === 'existing').length,
    missingR2ImagesRecoverable: manifest.filter((entry) => entry.status === 'recoverable').length,
    unresolvedProductsOrErrors: manifest.filter((entry) => ['missing', 'error'].includes(entry.status)).length + existingR2Errors.length,
    manifest,
  };
  ensureParent(outputPath);
  writeFileSync(outputPath, JSON.stringify(report, null, 2) + '\n');
  ensureParent(csvOutputPath);
  const columns = ['d1Record', 'productId', 'title', 'garment', 'colour', 'sellshirtsCatalogueRef', 'creationId', 'side', 'sourceUrl', 'targetR2Key', 'status', 'error'];
  writeFileSync(csvOutputPath, [columns.join(','), ...manifest.map((entry) => columns.map((column) => csvCell(entry[column])).join(','))].join('\n') + '\n');
  console.log(JSON.stringify({ ...report, manifest: undefined }, null, 2));
}

async function selfTest() {
  const fixture = '<img src="https://creation.streetshirts.com/designlab/designs/getcreationpreviewimage.aspx?filename=SSD%5BbfvMN7252ofRpI4lcVb2LkzckF5ZUe%5D_front&size=550"><img src="https://creation.streetshirts.com/designlab/designs/getcreationpreviewimage.aspx?filename=SSD%5BbfvMN7252ofRpI4lcVb2LkzckF5ZUe%5D_back&size=550">';
  const images = extractStreetshirtsImages(fixture);
  if (images.length !== 2 || !images.every((image) => image.sourceUrl.includes('size=1000')) || !images.some((image) => image.creationId === 'SSD[bfvMN7252ofRpI4lcVb2LkzckF5ZUe]' && image.side === 'front') || !images.some((image) => image.side === 'back')) {
    throw new Error(`16294 extraction self-test failed: ${JSON.stringify(images)}`);
  }
  console.log(JSON.stringify({ ok: true, ref: '16294', images }, null, 2));
}

if (args['self-test']) {
  await selfTest();
} else {
  await main();
}
