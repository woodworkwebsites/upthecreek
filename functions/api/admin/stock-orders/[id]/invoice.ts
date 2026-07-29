import type { Env } from '../../../../../types/env.js';
import { getPartnerById } from '../../../../../server/partners/repository.js';
import { getPartnerStockOrderWithItems } from '../../../../../server/partner-stock-orders/repository.js';
import {
  buildPartnerStockOrderInvoiceFilename,
  buildPartnerStockOrderInvoiceHtml,
} from '../../../../../server/partner-stock-orders/invoice.js';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const id = decodeURIComponent(context.params.id ?? '').trim();
  if (!id) {
    return new Response(JSON.stringify({ error: 'Stock order not found' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  const order = await getPartnerStockOrderWithItems(context.env.DB, id);
  if (!order) {
    return new Response(JSON.stringify({ error: 'Stock order not found' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  const partner = await getPartnerById(context.env.DB, order.partnerId);
  if (!partner) {
    return new Response(JSON.stringify({ error: 'Partner not found' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  const html = buildPartnerStockOrderInvoiceHtml(order, partner);
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="${buildPartnerStockOrderInvoiceFilename(order, partner)}"`,
    },
  });
};
