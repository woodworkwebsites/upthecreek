import type { Env } from '../../../types/env.js';
import { handleCreatePartner, handleListPartners } from '../../../server/admin/handlers.js';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  return handleListPartners(context.env);
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  return handleCreatePartner(context.env, context.request);
};
