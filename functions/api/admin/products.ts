import type { Env } from '../../../types/env.js';
import { handleListProducts, handleCreateProduct } from '../../../server/admin/handlers.js';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  return handleListProducts(context.env);
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  return handleCreateProduct(context.env, context.request);
};
