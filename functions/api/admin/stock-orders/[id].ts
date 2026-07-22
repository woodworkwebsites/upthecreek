import type { Env } from '../../../../types/env.js';
import { handleUpdatePartnerStockOrderStatus } from '../../../../server/admin/handlers.js';

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const id = context.params.id as string;
  return handleUpdatePartnerStockOrderStatus(context.env, id, context.request);
};
