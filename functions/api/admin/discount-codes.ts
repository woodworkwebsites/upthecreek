import type { Env } from '../../../types/env.js';
import { handleCreateDiscountCode, handleListDiscountCodes } from '../../../server/admin/handlers.js';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  return handleListDiscountCodes(context.env);
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  return handleCreateDiscountCode(context.env, context.request);
};
