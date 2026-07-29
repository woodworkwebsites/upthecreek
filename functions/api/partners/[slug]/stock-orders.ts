import type { Env } from '../../../../types/env.js';
import { handleSubmitPartnerStockOrder } from '../../../../server/partner-stock-orders/handlers.js';
import { readPartnerSessionToken } from '../../../../server/partners/handlers.js';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const slug = decodeURIComponent(context.params.slug ?? '').trim();
  if (!slug) {
    return new Response(JSON.stringify({ error: 'Partner not found' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  if (!readPartnerSessionToken(context.request)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  return handleSubmitPartnerStockOrder(context.env, context.request, slug);
};
