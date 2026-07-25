import type { Env } from '../../../../types/env.js';
import {
  handleDeletePartnerStockOrder,
  handleUpdatePartnerStockOrderStatus,
} from '../../../../server/admin/handlers.js';

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const id = context.params.id as string;
  return handleUpdatePartnerStockOrderStatus(context.env, id, context.request);
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const id = context.params.id as string;
  return handleDeletePartnerStockOrder(context.env, id);
};
