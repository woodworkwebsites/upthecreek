import type { Env } from '../../../../types/env.js';
import { handleDeleteDiscountCode, handleUpdateDiscountCode } from '../../../../server/admin/handlers.js';

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const id = context.params.id as string;
  return handleUpdateDiscountCode(context.env, id, context.request);
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const id = context.params.id as string;
  return handleDeleteDiscountCode(context.env, id);
};
