import type { Env } from '../../../types/env.js';
import { handleStripeWebhook } from '../../../server/stripe/webhook.js';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  return handleStripeWebhook(context.request, context.env);
};
