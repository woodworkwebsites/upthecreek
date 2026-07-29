import type { Env } from '../../../types/env.js';
import { getProductById } from '../../../server/products/repository.js';
import { getCollaborationProductById } from '../../../server/collaborations/repository.js';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const id = context.params['id'] as string;

  try {
    const channel = new URL(context.request.url).searchParams.get('channel');
    const product = channel === 'collabs'
      ? await getCollaborationProductById(context.env.DB, decodeURIComponent(id))
      : await getProductById(
        context.env.DB,
        decodeURIComponent(id),
        channel === 'partner' ? 'partner' : 'storefront',
      );
    if (!product) {
      return new Response(JSON.stringify({ error: 'Product not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ product }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
