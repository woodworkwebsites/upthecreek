import type { Env } from '../../../types/env.js';
import { handlePartnerAuth } from '../../../server/partners/handlers.js';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  return handlePartnerAuth(context.env, context.request);
};
