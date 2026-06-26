import type { Env } from '../../../types/env.js';
import { handleListProducts } from '../../../server/admin/handlers.js';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  return handleListProducts(context.env);
};
