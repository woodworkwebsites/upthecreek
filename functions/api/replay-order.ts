import Stripe from 'stripe';
import type { Env } from '../../types/env.js';
import { getStripeKeys } from '../../server/env.js';
import { getSetting } from '../../server/settings/repository.js';
import { createStripeClient } from '../../server/stripe/checkout.js';
import { processCompletedSession } from '../../server/stripe/webhook.js';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function readSessionId(request: Request): Promise<string> {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get('session_id')?.trim();
  if (fromQuery) return fromQuery;

  try {
    const body = await request.json().catch(() => ({})) as { sessionId?: string };
    return body.sessionId?.trim() ?? '';
  } catch {
    return '';
  }
}

function isAuthorizedReplay(request: Request, sessionId: string): boolean {
  const url = new URL(request.url);
  const replayKey = url.searchParams.get('replay_key');
  const targetSession = 'cs_live_a1b8lnbLTVjRkb9vWi393OnfAK91LBA8lo40G8baPTkQNkwpjsTB9nb8we';
  return sessionId === targetSession && replayKey === 'utc-replay-2026-07-20';
}

async function replaySession(request: Request, env: Env): Promise<Response> {
  const sessionId = await readSessionId(request);
  if (!sessionId || !isAuthorizedReplay(request, sessionId)) {
    return json({ error: 'Not found' }, 404);
  }

  const stripeTestMode = (await getSetting(env.DB, 'stripe_test_mode')) === 'true';
  const { secretKey } = getStripeKeys(request, env, stripeTestMode);
  const stripe = createStripeClient(secretKey);

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: `Failed to retrieve Stripe session: ${message}` }, 500);
  }

  try {
    await processCompletedSession(session, request, env);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ error: message }, 500);
  }

  return json({ success: true, sessionId });
}

export const onRequestGet: PagesFunction<Env> = async (context) => replaySession(context.request, context.env);
export const onRequestPost: PagesFunction<Env> = async (context) => replaySession(context.request, context.env);
