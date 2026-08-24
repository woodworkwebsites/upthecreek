import type { Env } from '../../../../types/env.js';
import { handleDeletePartner, handleGetPartner, handleUpdatePartner } from '../../../../server/admin/handlers.js';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const id = decodeURIComponent(context.params.id ?? '').trim();
  if (!id) {
    return new Response(JSON.stringify({ error: 'Partner not found' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  return handleGetPartner(context.env, id);
};

export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const id = decodeURIComponent(context.params.id ?? '').trim();
  if (!id) {
    return new Response(JSON.stringify({ error: 'Partner not found' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  return handleUpdatePartner(context.env, id, context.request);
};

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const id = decodeURIComponent(context.params.id ?? '').trim();
  if (!id) {
    return new Response(JSON.stringify({ error: 'Partner not found' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  return handleDeletePartner(context.env, id);
};
