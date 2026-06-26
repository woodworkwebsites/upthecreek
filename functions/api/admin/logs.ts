import type { Env } from '../../../types/env.js';
import { handleListLogs } from '../../../server/admin/handlers.js';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  return handleListLogs(context.env);
};
