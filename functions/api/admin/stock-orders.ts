import type { Env } from '../../../types/env.js';
import { handleListPartnerStockOrders } from '../../../server/admin/handlers.js';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  return handleListPartnerStockOrders(context.env);
};
