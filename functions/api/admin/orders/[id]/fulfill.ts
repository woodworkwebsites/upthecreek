import type { Env } from '../../../../../types/env.js';
import { handleFulfillOrder } from '../../../../../server/admin/handlers.js';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const id = context.params.id as string;
  return handleFulfillOrder(context.env, id, context.request);
};
