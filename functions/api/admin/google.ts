import type { Env } from '../../../types/env.js';
import { mailConnected, startGoogleAuth } from '../../../server/notifications/google.js';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  return Response.json({ connected: await mailConnected(env) });
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  const url = await startGoogleAuth(env, new URL(request.url).origin);
  return Response.json({ url });
};
