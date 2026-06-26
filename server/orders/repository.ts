import type { D1Database } from '@cloudflare/workers-types';
import type {
  Order,
  OrderRow,
  OrderItem,
  OrderItemRow,
  OrderStatus,
  PrintifyMode,
  SyncLogRow,
  WebhookLogRow,
  PrintifyLogRow,
} from '../../types/index.js';

function parseOrder(row: OrderRow): Order {
  return {
    id:                    row.id,
    stripeSessionId:       row.stripe_session_id,
    stripePaymentIntent:   row.stripe_payment_intent,
    customerEmail:         row.customer_email,
    customerName:          row.customer_name,
    amountTotal:           row.amount_total,
    currency:              row.currency,
    status:                row.status,
    printifyMode:          row.printify_mode,
    printifyOrderId:       row.printify_order_id,
    printifyPayload:       row.printify_payload ? JSON.parse(row.printify_payload) : null,
    printifyResponse:      row.printify_response ? JSON.parse(row.printify_response) : null,
    error:                 row.error,
    createdAt:             row.created_at,
    updatedAt:             row.updated_at,
  };
}

function parseOrderItem(row: OrderItemRow): OrderItem {
  return {
    id:          row.id,
    orderId:     row.order_id,
    printifyId:  row.printify_id,
    variantId:   row.variant_id,
    title:       row.title,
    color:       row.color,
    size:        row.size,
    quantity:    row.quantity,
    unitPrice:   row.unit_price,
    createdAt:   row.created_at,
  };
}

export async function getOrderBySessionId(
  db: D1Database,
  stripeSessionId: string,
): Promise<Order | null> {
  const row = await db
    .prepare('SELECT * FROM orders WHERE stripe_session_id = ?')
    .bind(stripeSessionId)
    .first<OrderRow>();
  return row ? parseOrder(row) : null;
}

export interface CreateOrderData {
  id: string;
  stripeSessionId: string;
  stripePaymentIntent: string | null;
  customerEmail: string;
  customerName: string | null;
  amountTotal: number;
  currency: string;
  printifyMode: PrintifyMode;
}

export async function createOrder(
  db: D1Database,
  data: CreateOrderData,
): Promise<void> {
  await db
    .prepare(`
      INSERT INTO orders
        (id, stripe_session_id, stripe_payment_intent, customer_email, customer_name,
         amount_total, currency, status, printify_mode, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'paid', ?, datetime('now'), datetime('now'))
    `)
    .bind(
      data.id,
      data.stripeSessionId,
      data.stripePaymentIntent,
      data.customerEmail,
      data.customerName,
      data.amountTotal,
      data.currency,
      data.printifyMode,
    )
    .run();
}

export interface CreateOrderItemData {
  id: string;
  orderId: string;
  printifyId: string;
  variantId: number;
  title: string;
  color: string;
  size: string;
  quantity: number;
  unitPrice: number;
}

export async function createOrderItem(
  db: D1Database,
  data: CreateOrderItemData,
): Promise<void> {
  await db
    .prepare(`
      INSERT INTO order_items
        (id, order_id, printify_id, variant_id, title, color, size, quantity, unit_price, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `)
    .bind(
      data.id,
      data.orderId,
      data.printifyId,
      data.variantId,
      data.title,
      data.color,
      data.size,
      data.quantity,
      data.unitPrice,
    )
    .run();
}

export async function updateOrderStatus(
  db: D1Database,
  id: string,
  status: OrderStatus,
  extra?: {
    printifyOrderId?: string;
    printifyPayload?: unknown;
    printifyResponse?: unknown;
    error?: string;
  },
): Promise<void> {
  await db
    .prepare(`
      UPDATE orders
      SET status            = ?,
          printify_order_id = COALESCE(?, printify_order_id),
          printify_payload  = COALESCE(?, printify_payload),
          printify_response = COALESCE(?, printify_response),
          error             = COALESCE(?, error),
          updated_at        = datetime('now')
      WHERE id = ?
    `)
    .bind(
      status,
      extra?.printifyOrderId ?? null,
      extra?.printifyPayload !== undefined ? JSON.stringify(extra.printifyPayload) : null,
      extra?.printifyResponse !== undefined ? JSON.stringify(extra.printifyResponse) : null,
      extra?.error ?? null,
      id,
    )
    .run();
}

export async function getOrderWithItems(
  db: D1Database,
  id: string,
): Promise<Order | null> {
  const row = await db
    .prepare('SELECT * FROM orders WHERE id = ?')
    .bind(id)
    .first<OrderRow>();
  if (!row) return null;

  const itemsResult = await db
    .prepare('SELECT * FROM order_items WHERE order_id = ?')
    .bind(id)
    .all<OrderItemRow>();

  const order = parseOrder(row);
  order.items = (itemsResult.results ?? []).map(parseOrderItem);
  return order;
}

export async function listOrders(
  db: D1Database,
  limit = 50,
  offset = 0,
): Promise<Order[]> {
  const result = await db
    .prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT ? OFFSET ?')
    .bind(limit, offset)
    .all<OrderRow>();
  return (result.results ?? []).map(parseOrder);
}

export async function writeSyncLog(
  db: D1Database,
  status: 'success' | 'error',
  productsSynced: number | null,
  message: string | null,
): Promise<void> {
  await db
    .prepare(`
      INSERT INTO sync_logs (id, status, products_synced, message, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `)
    .bind(crypto.randomUUID(), status, productsSynced, message)
    .run();
}

export async function writeWebhookLog(
  db: D1Database,
  eventType: string,
  stripeSessionId: string | null,
  status: 'received' | 'processed' | 'ignored' | 'error',
  payload: unknown | null,
  error: string | null,
): Promise<void> {
  const payloadStr = payload
    ? JSON.stringify(payload).substring(0, 4000)
    : null;

  await db
    .prepare(`
      INSERT INTO webhook_logs (id, event_type, stripe_session_id, status, payload, error, created_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `)
    .bind(crypto.randomUUID(), eventType, stripeSessionId, status, payloadStr, error)
    .run();
}

export async function writePrintifyLog(
  db: D1Database,
  orderId: string | null,
  mode: PrintifyMode,
  action: string,
  status: 'success' | 'error',
  payload: unknown | null,
  response: unknown | null,
  error: string | null,
): Promise<void> {
  await db
    .prepare(`
      INSERT INTO printify_logs (id, order_id, mode, action, status, payload, response, error, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `)
    .bind(
      crypto.randomUUID(),
      orderId,
      mode,
      action,
      status,
      payload ? JSON.stringify(payload) : null,
      response ? JSON.stringify(response) : null,
      error,
    )
    .run();
}

export async function listSyncLogs(db: D1Database, limit = 20): Promise<SyncLogRow[]> {
  const result = await db
    .prepare('SELECT * FROM sync_logs ORDER BY created_at DESC LIMIT ?')
    .bind(limit)
    .all<SyncLogRow>();
  return result.results ?? [];
}

export async function listWebhookLogs(db: D1Database, limit = 50): Promise<WebhookLogRow[]> {
  const result = await db
    .prepare('SELECT * FROM webhook_logs ORDER BY created_at DESC LIMIT ?')
    .bind(limit)
    .all<WebhookLogRow>();
  return result.results ?? [];
}

export async function listPrintifyLogs(db: D1Database, limit = 50): Promise<PrintifyLogRow[]> {
  const result = await db
    .prepare('SELECT * FROM printify_logs ORDER BY created_at DESC LIMIT ?')
    .bind(limit)
    .all<PrintifyLogRow>();
  return result.results ?? [];
}
