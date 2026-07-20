import type { Env } from '../../../../../types/env.js';
import { handleGetOrderReceipt } from '../../../../../server/admin/handlers.js';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const id = context.params.id as string;
  return handleGetOrderReceipt(context.env, id);
};
