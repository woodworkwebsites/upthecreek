import type { Env } from '../../../../types/env.js';
import { handleUpdateProduct } from '../../../../server/admin/handlers.js';

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const printifyId = context.params.printifyId as string;
  return handleUpdateProduct(context.env, printifyId, context.request);
};
