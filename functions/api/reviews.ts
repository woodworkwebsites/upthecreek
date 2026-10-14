import type { Env } from '../../types/env.js';
import { getPublicReviewImages } from '../../server/admin/reviews.js';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const reviews = await getPublicReviewImages(context.env);
    return new Response(JSON.stringify({ reviews }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' },
    });
  } catch {
    return new Response(JSON.stringify({ reviews: [] }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
