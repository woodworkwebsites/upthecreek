import type { Env } from '../../../types/env.js';
import { handlePartnerDashboard, handlePartnerLookup, readPartnerSessionToken } from '../../../server/partners/handlers.js';

export const onRequestGet: PagesFunction<Env> = async (context) => {
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
    return handlePartnerLookup(context.env, slug);
  }

  return handlePartnerDashboard(context.env, context.request, slug);
};
