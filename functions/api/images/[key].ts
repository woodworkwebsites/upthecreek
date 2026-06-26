import type { Env } from '../../../types/env.js';
import { serveAsset } from '../../../server/assets/storage.js';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const key = decodeURIComponent(url.pathname.replace('/api/images/', ''));

  if (!key) {
    return new Response('Not found', { status: 404 });
  }

  return serveAsset(context.env.IMAGES, key);
};
