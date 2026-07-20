import type { Env } from '../../types/env.js';
import { getPartnerBySlug, getPartnerBySlugAndToken, listPartnerOrders, summarisePartnerDashboard } from './repository.js';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function readBearerToken(request: Request): string | null {
  const auth = request.headers.get('Authorization');
  return auth?.replace(/^Bearer\s+/i, '').trim() || null;
}

export async function handlePartnerAuth(env: Env, request: Request): Promise<Response> {
  let body: { slug?: string; accessToken?: string };
  try {
    body = await request.json().catch(() => ({})) as { slug?: string; accessToken?: string };
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const slug = body.slug?.trim();
  const accessToken = body.accessToken?.trim();

  if (!slug || !accessToken) {
    return json({ error: 'Partner code and access token are required' }, 400);
  }

  const partner = await getPartnerBySlugAndToken(env.DB, slug, accessToken);
  if (!partner || !partner.active) {
    return json({ error: 'Invalid partner credentials' }, 401);
  }

  return json({ partner });
}

export async function handlePartnerDashboard(env: Env, request: Request, slug: string): Promise<Response> {
  const token = readBearerToken(request);
  if (!token) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const partner = await getPartnerBySlugAndToken(env.DB, slug, token);
  if (!partner || !partner.active) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const orders = await listPartnerOrders(env.DB, partner);
  const dashboard = summarisePartnerDashboard(partner, orders);

  return json(dashboard);
}

export async function handlePartnerLookup(env: Env, slug: string): Promise<Response> {
  const partner = await getPartnerBySlug(env.DB, slug);
  if (!partner || !partner.active) {
    return json({ error: 'Partner not found' }, 404);
  }

  return json({ partner });
}
