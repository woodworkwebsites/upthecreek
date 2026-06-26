import type { Env } from '../../../types/env.js';
import { handleGetSettings, handleUpdateSettings } from '../../../server/admin/handlers.js';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  return handleGetSettings(context.env);
};

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  return handleUpdateSettings(context.env, context.request);
};
