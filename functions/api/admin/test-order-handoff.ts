import type { Env } from '../../../types/env.js';
import { handleTestOrderHandoff } from '../../../server/admin/handlers.js';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  return handleTestOrderHandoff(context.env, context.request);
};
