import type { Env } from '../../../types/env.js';
import { handleDeleteReview, handleListReviews, handleUpdateReviews, handleUploadReview } from '../../../server/admin/reviews.js';

export const onRequestGet: PagesFunction<Env> = (context) => handleListReviews(context.env);
export const onRequestPost: PagesFunction<Env> = (context) => handleUploadReview(context.env, context.request);
export const onRequestPatch: PagesFunction<Env> = (context) => handleUpdateReviews(context.env, context.request);
export const onRequestDelete: PagesFunction<Env> = (context) => {
  const id = new URL(context.request.url).searchParams.get('id') ?? '';
  return handleDeleteReview(context.env, id);
};
