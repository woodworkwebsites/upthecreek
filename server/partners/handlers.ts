import type { Env } from '../../types/env.js';
import { getPartnerBySlug, getPartnerBySlugAndToken, listPartnerOrderSummaries, summarisePartnerDashboard } from './repository.js';

const PARTNER_SESSION_COOKIE = 'utc_partner_session';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function readCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;

  for (const entry of cookieHeader.split(';')) {
    const [rawName, ...rest] = entry.trim().split('=');
    if (rawName !== name || rest.length === 0) continue;
    const rawValue = rest.join('=').trim();
    if (!rawValue) return null;
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }

  return null;
}

export function readPartnerSessionToken(request: Request): string | null {
  const auth = request.headers.get('Authorization');
  const bearer = auth?.replace(/^Bearer\s+/i, '').trim() || null;
  if (bearer && bearer !== 'undefined' && bearer !== 'null') {
    return bearer;
  }

  return readCookie(request, PARTNER_SESSION_COOKIE);
}

function buildPartnerSessionCookie(request: Request, token: string): string {
  const secure = new URL(request.url).protocol === 'https:';
  return [
    `${PARTNER_SESSION_COOKIE}=${encodeURIComponent(token.trim())}`,
    'Path=/',
    'Max-Age=604800',
    'SameSite=Lax',
    secure ? 'Secure' : null,
    'HttpOnly',
  ].filter(Boolean).join('; ');
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

  return new Response(JSON.stringify({ partner }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': buildPartnerSessionCookie(request, accessToken),
    },
  });
}

export async function handlePartnerDashboard(env: Env, request: Request, slug: string): Promise<Response> {
  const token = readPartnerSessionToken(request);
  if (!token) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const partner = await getPartnerBySlugAndToken(env.DB, slug, token);
  if (!partner || !partner.active) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const recentOrders = await listPartnerOrderSummaries(env.DB, partner);
  const dashboard = summarisePartnerDashboard(partner, recentOrders);

  return json(dashboard);
}

export async function handlePartnerLookup(env: Env, slug: string): Promise<Response> {
  const partner = await getPartnerBySlug(env.DB, slug);
  if (!partner || !partner.active) {
    return json({ error: 'Partner not found' }, 404);
  }

  return json({ partner });
}
