import type { Env } from '../../../types/env.js';
import { getProductById } from '../../../server/products/repository.js';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const id = context.params['id'] as string;

  try {
    const product = await getProductById(context.env.DB, id);
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
