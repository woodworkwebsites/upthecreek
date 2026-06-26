import type { Env } from '../../../types/env.js';
import { handleSyncProducts } from '../../../server/admin/handlers.js';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  return handleSyncProducts(context.env);
};
