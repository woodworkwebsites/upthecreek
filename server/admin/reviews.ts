import type { Env } from '../../types/env.js';
import { getSetting, setSetting } from '../settings/repository.js';
import { deleteAsset, storeAssetAtKey } from '../assets/storage.js';

const REVIEWS_KEY = 'homepage_review_images';
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
type ReviewImage = { id: string; src: string; storageKey: string; alt: string };

async function readReviews(env: Env): Promise<ReviewImage[]> {
  const value = await getSetting(env.DB, REVIEWS_KEY);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ReviewImage =>
      item && typeof item.id === 'string' && typeof item.src === 'string' &&
      typeof item.storageKey === 'string' && item.storageKey.startsWith('reviews/') &&
      typeof item.alt === 'string'
    );
  } catch {
    return [];
  }
}

async function saveReviews(env: Env, reviews: ReviewImage[]): Promise<void> {
  await setSetting(env.DB, REVIEWS_KEY, JSON.stringify(reviews));
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function handleListReviews(env: Env): Promise<Response> {
  return json({ reviews: await readReviews(env) });
}

export async function handleUploadReview(env: Env, request: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'Could not read image upload' }, 400);
  }

  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) return json({ error: 'Choose an image to upload' }, 400);
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return json({ error: 'Use a PNG, JPG or WebP image' }, 400);
  }
  if (file.size > MAX_IMAGE_BYTES) return json({ error: 'Each image must be 12 MB or smaller' }, 400);

  const id = crypto.randomUUID();
  const extension = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp';
  const key = `reviews/${id}.${extension}`;
  const stored = await storeAssetAtKey(env.IMAGES, key, await file.arrayBuffer(), file.type, {
    kind: 'review-image',
    metadata: { originalName: file.name.slice(0, 180) },
  });
  const reviews = await readReviews(env);
  const item: ReviewImage = {
    id,
    src: stored.url,
    storageKey: stored.key,
    alt: 'Customer review screenshot',
  };
  reviews.push(item);
  await saveReviews(env, reviews);
  return json({ reviews });
}

export async function handleUpdateReviews(env: Env, request: Request): Promise<Response> {
  let body: { order?: unknown; captions?: unknown };
  try {
    body = await request.json() as typeof body;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  if (!Array.isArray(body.order)) return json({ error: 'Review order is required' }, 400);

  const current = await readReviews(env);
  const byId = new Map(current.map((item) => [item.id, item]));
  const seen = new Set<string>();
  const reordered: ReviewImage[] = [];
  for (const rawId of body.order) {
    if (typeof rawId !== 'string' || seen.has(rawId)) continue;
    const item = byId.get(rawId);
    if (!item) continue;
    seen.add(rawId);
    const captions = body.captions && typeof body.captions === 'object' ? body.captions as Record<string, unknown> : {};
    const alt = captions[rawId];
    reordered.push(typeof alt === 'string' ? { ...item, alt: alt.trim().slice(0, 180) } : item);
  }
  for (const item of current) if (!seen.has(item.id)) reordered.push(item);
  await saveReviews(env, reordered);
  return json({ reviews: reordered });
}

export async function handleDeleteReview(env: Env, id: string): Promise<Response> {
  const reviews = await readReviews(env);
  const item = reviews.find((review) => review.id === id);
  if (!item) return json({ error: 'Review image not found' }, 404);
  await deleteAsset(env.IMAGES, item.storageKey);
  const remaining = reviews.filter((review) => review.id !== id);
  await saveReviews(env, remaining);
  return json({ reviews: remaining });
}

export function getPublicReviewImages(env: Env): Promise<ReviewImage[]> {
  return readReviews(env);
}
