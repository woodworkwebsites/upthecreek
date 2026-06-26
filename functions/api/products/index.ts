import type { Env } from '../../../types/env.js';
import { getAllProducts } from '../../../server/products/repository.js';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const products = await getAllProducts(context.env.DB);
    return new Response(JSON.stringify({ products }), {
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
