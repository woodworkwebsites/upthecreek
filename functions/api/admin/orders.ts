import type { Env } from '../../../types/env.js';
import { handleListOrders, handleGetOrder } from '../../../server/admin/handlers.js';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const id  = url.searchParams.get('id');

  if (id) {
    return handleGetOrder(context.env, id);
  }

  return handleListOrders(context.env, url);
};
