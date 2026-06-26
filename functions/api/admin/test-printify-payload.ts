import type { Env } from '../../../types/env.js';
import { handleTestPrintifyPayload } from '../../../server/admin/handlers.js';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  return handleTestPrintifyPayload(context.env, context.request);
};
