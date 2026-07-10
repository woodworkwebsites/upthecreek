import type { Env } from '../../../../types/env.js';
import { handleUpdateOrderStatus } from '../../../../server/admin/handlers.js';

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const id = context.params.id as string;
  return handleUpdateOrderStatus(context.env, id, context.request);
};
