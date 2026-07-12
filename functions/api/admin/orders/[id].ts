import type { Env } from '../../../../types/env.js';
import { handleDeleteOrder, handleUpdateOrderStatus } from '../../../../server/admin/handlers.js';

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const id = context.params.id as string;
  return handleUpdateOrderStatus(context.env, id, context.request);
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const id = context.params.id as string;
  return handleDeleteOrder(context.env, id);
};
