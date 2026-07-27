import type { Env } from '../../../types/env.js';
import { listRanges } from '../../../server/ranges/repository.js';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const channel = context.request.url ? new URL(context.request.url).searchParams.get('channel') : null;
    const ranges = await listRanges(context.env.DB);
    const filtered = channel === 'partner'
      ? ranges.filter((range) => range.partnerEnabled)
      : ranges.filter((range) => range.storefrontEnabled);

    return new Response(JSON.stringify({ ranges: filtered }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
