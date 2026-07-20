import type { Env } from '../../../types/env.js';
import { handlePartnerDashboard } from '../../../server/partners/handlers.js';

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

  if (!context.request.headers.has('Authorization')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  return handlePartnerDashboard(context.env, context.request, slug);
};
