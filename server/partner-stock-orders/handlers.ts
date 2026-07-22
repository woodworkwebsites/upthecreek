import type { Env } from '../../types/env.js';
import type { PartnerStockOrderInput } from '../../types/index.js';
import { getPartnerBySlugAndToken } from '../partners/repository.js';
import { createPartnerStockOrder } from './repository.js';
import { sendPushoverNotification } from '../notifications/pushover.js';
import { sendOrderNotificationEmail } from '../notifications/email.js';
import { logger } from '../logging.js';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function readBearerToken(request: Request): string | null {
  const auth = request.headers.get('Authorization');
  return auth?.replace(/^Bearer\s+/i, '').trim() || null;
}

function formatPounds(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

export async function handleSubmitPartnerStockOrder(env: Env, request: Request, slug: string): Promise<Response> {
  const token = readBearerToken(request);
  if (!token) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const partner = await getPartnerBySlugAndToken(env.DB, slug, token);
  if (!partner || !partner.active) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let body: PartnerStockOrderInput;
  try {
    body = await request.json() as PartnerStockOrderInput;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) {
    return json({ error: 'Basket is empty' }, 400);
  }

  for (const item of items) {
    if (!item.printifyId || !item.title || !item.size || !Number.isFinite(item.quantity) || item.quantity < 1) {
      return json({ error: 'Each item requires printifyId, title, size, and quantity ≥ 1' }, 400);
    }
    if (!Number.isFinite(item.unitPrice) || item.unitPrice < 0) {
      return json({ error: 'Each item requires a valid unitPrice' }, 400);
    }
  }

  const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 2000) || null : null;

  const order = await createPartnerStockOrder(env.DB, partner.id, items, notes);

  const summaryLine = `${partner.name} · ${order.totalPieces} piece${order.totalPieces === 1 ? '' : 's'} · ${formatPounds(order.totalValue)}`;

  await sendPushoverNotification(env, {
    title: 'New partner stock order',
    message: summaryLine,
  });

  const itemLines = order.items
    .map((item) => `${item.quantity} x ${item.title} (${item.color}, ${item.size}) @ ${formatPounds(item.unitPrice)}`)
    .join('\n');

  await sendOrderNotificationEmail(env, {
    subject: `New partner stock order: ${partner.name}`,
    text: `${summaryLine}\n\n${itemLines}${notes ? `\n\nNotes: ${notes}` : ''}`,
  });

  logger.info('Partner stock order submitted', {
    partnerId: partner.id,
    orderId: order.id,
    totalPieces: order.totalPieces,
  });

  return json({ order }, 201);
}
