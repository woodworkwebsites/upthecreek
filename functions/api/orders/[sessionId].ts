import type { Env } from '../../../types/env.js';
import type { Order, OrderItem } from '../../../types/index.js';
import { getOrderBySessionId, getOrderWithItems } from '../../../server/orders/repository.js';
import { getProductByPrintifyId } from '../../../server/products/repository.js';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const sessionId = decodeURIComponent(context.params.sessionId ?? '').trim();
  if (!sessionId) {
    return json({ error: 'Missing sessionId' }, 400);
  }

  const order = await getOrderBySessionId(context.env.DB, sessionId);
  if (!order) {
    return json({ error: 'Order not found' }, 404);
  }

  const withItems = await getOrderWithItems(context.env.DB, order.id);
  if (!withItems) {
    return json({ error: 'Order not found' }, 404);
  }

  const items: OrderItem[] = [];
  for (const item of withItems.items ?? []) {
    const product = await getProductByPrintifyId(context.env.DB, item.printifyId);
    const imageSrc = product
      ? pickItemImage(product.images, item.color)
      : undefined;
    items.push({
      ...item,
      imageSrc,
    });
  }

  const response: Order = {
    ...withItems,
    items,
  };

  return json({ order: response });
};

function pickItemImage(images: Array<{ src: string; color?: string; isDefault: boolean }>, color: string): string | undefined {
  const byColor = images.find((image) => image.color === color)?.src;
  if (byColor) return byColor;

  const defaultImage = images.find((image) => image.isDefault)?.src;
  if (defaultImage) return defaultImage;

  return images[0]?.src;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
