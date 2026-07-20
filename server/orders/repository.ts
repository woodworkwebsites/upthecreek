import type { D1Database } from '@cloudflare/workers-types';
import type {
  Order,
  OrderRow,
  OrderItem,
  OrderItemRow,
  OrderStatus,
  FulfillmentProvider,
  SyncLogRow,
  WebhookLogRow,
} from '../../types/index.js';

let orderSchemaReady: Promise<void> | null = null;

async function readOrderColumns(db: D1Database): Promise<Set<string>> {
  const result = await db
    .prepare("SELECT name FROM pragma_table_info('orders')")
    .all<{ name: string }>();

  return new Set((result.results ?? []).map((row) => row.name));
}

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
    error:                 row.error,
    fulfillmentProvider:   row.fulfillment_provider,
    externalOrderRef:      row.external_order_ref,
    discountCode:          row.discount_code,
    discountAmount:        row.discount_amount,
    shippingName:          row.shipping_name,
    shippingPhone:         row.shipping_phone,
    shippingAddress1:      row.shipping_address1,
    shippingAddress2:      row.shipping_address2,
    shippingCity:          row.shipping_city,
    shippingRegion:        row.shipping_region,
    shippingZip:           row.shipping_zip,
    shippingCountry:       row.shipping_country,
    createdAt:             row.created_at,
    updatedAt:             row.updated_at,
  };
}

export async function ensureOrderSchema(db: D1Database): Promise<void> {
  if (!orderSchemaReady) {
    orderSchemaReady = (async () => {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS orders (
          id                    TEXT PRIMARY KEY,
          stripe_session_id     TEXT UNIQUE NOT NULL,
          stripe_payment_intent TEXT,
          customer_email        TEXT NOT NULL,
          customer_name         TEXT,
          amount_total          INTEGER NOT NULL,
          currency              TEXT NOT NULL DEFAULT 'gbp',
          status                TEXT NOT NULL DEFAULT 'pending',
          error                 TEXT,
          created_at            TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
          fulfillment_provider  TEXT NOT NULL DEFAULT 'manual',
          external_order_ref    TEXT,
          shipping_name         TEXT NOT NULL DEFAULT '',
          shipping_phone        TEXT NOT NULL DEFAULT '',
          shipping_address1     TEXT NOT NULL DEFAULT '',
          shipping_address2     TEXT NOT NULL DEFAULT '',
          shipping_city         TEXT NOT NULL DEFAULT '',
          shipping_region       TEXT NOT NULL DEFAULT '',
          shipping_zip          TEXT NOT NULL DEFAULT '',
          shipping_country      TEXT NOT NULL DEFAULT '',
          discount_code         TEXT,
          discount_amount       INTEGER NOT NULL DEFAULT 0
        )
      `).run();

      await db.prepare(`
        CREATE TABLE IF NOT EXISTS order_items (
          id              TEXT PRIMARY KEY,
          order_id        TEXT NOT NULL REFERENCES orders(id),
          printify_id     TEXT NOT NULL,
          variant_id      INTEGER NOT NULL,
          title           TEXT NOT NULL,
          color           TEXT NOT NULL DEFAULT '',
          size            TEXT NOT NULL DEFAULT '',
          quantity        INTEGER NOT NULL DEFAULT 1,
          unit_price      INTEGER NOT NULL,
          created_at      TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `).run();

      const existingColumns = await readOrderColumns(db);
      const additions: Array<[string, string]> = [
        ['fulfillment_provider', "ALTER TABLE orders ADD COLUMN fulfillment_provider TEXT NOT NULL DEFAULT 'manual'"],
        ['external_order_ref', 'ALTER TABLE orders ADD COLUMN external_order_ref TEXT'],
        ['shipping_name', "ALTER TABLE orders ADD COLUMN shipping_name TEXT NOT NULL DEFAULT ''"],
        ['shipping_phone', "ALTER TABLE orders ADD COLUMN shipping_phone TEXT NOT NULL DEFAULT ''"],
        ['shipping_address1', "ALTER TABLE orders ADD COLUMN shipping_address1 TEXT NOT NULL DEFAULT ''"],
        ['shipping_address2', "ALTER TABLE orders ADD COLUMN shipping_address2 TEXT NOT NULL DEFAULT ''"],
        ['shipping_city', "ALTER TABLE orders ADD COLUMN shipping_city TEXT NOT NULL DEFAULT ''"],
        ['shipping_region', "ALTER TABLE orders ADD COLUMN shipping_region TEXT NOT NULL DEFAULT ''"],
        ['shipping_zip', "ALTER TABLE orders ADD COLUMN shipping_zip TEXT NOT NULL DEFAULT ''"],
        ['shipping_country', "ALTER TABLE orders ADD COLUMN shipping_country TEXT NOT NULL DEFAULT ''"],
        ['discount_code', 'ALTER TABLE orders ADD COLUMN discount_code TEXT'],
        ['discount_amount', 'ALTER TABLE orders ADD COLUMN discount_amount INTEGER NOT NULL DEFAULT 0'],
      ];

      for (const [column, sql] of additions) {
        if (!existingColumns.has(column)) {
          await db.prepare(sql).run();
        }
      }

      await db.prepare('CREATE INDEX IF NOT EXISTS idx_orders_stripe_session ON orders(stripe_session_id)').run();
      await db.prepare('CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)').run();
      await db.prepare('CREATE INDEX IF NOT EXISTS idx_orders_discount_code ON orders(discount_code)').run();
      await db.prepare('CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)').run();
    })();
  }

  await orderSchemaReady;
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
  await ensureOrderSchema(db);

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
  fulfillmentProvider: FulfillmentProvider;
  discountCode?: string | null;
  discountAmount?: number;
  shipping: {
    name: string;
    phone: string;
    address1: string;
    address2: string;
    city: string;
    region: string;
    zip: string;
    country: string;
  };
}

export async function createOrder(
  db: D1Database,
  data: CreateOrderData,
): Promise<void> {
  await ensureOrderSchema(db);

  await db
    .prepare(`
      INSERT INTO orders
        (id, stripe_session_id, stripe_payment_intent, customer_email, customer_name,
         amount_total, currency, status, fulfillment_provider,
         discount_code, discount_amount,
         shipping_name, shipping_phone, shipping_address1, shipping_address2,
         shipping_city, shipping_region, shipping_zip, shipping_country,
         created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'paid', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `)
    .bind(
      data.id,
      data.stripeSessionId,
      data.stripePaymentIntent,
      data.customerEmail,
      data.customerName,
      data.amountTotal,
      data.currency,
      data.fulfillmentProvider,
      data.discountCode ?? null,
      data.discountAmount ?? 0,
      data.shipping.name,
      data.shipping.phone,
      data.shipping.address1,
      data.shipping.address2,
      data.shipping.city,
      data.shipping.region,
      data.shipping.zip,
      data.shipping.country,
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
  await ensureOrderSchema(db);

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
    error?: string;
    externalOrderRef?: string;
  },
): Promise<void> {
  await ensureOrderSchema(db);

  await db
    .prepare(`
      UPDATE orders
      SET status             = ?,
          error              = COALESCE(?, error),
          external_order_ref = COALESCE(?, external_order_ref),
          updated_at         = datetime('now')
      WHERE id = ?
    `)
    .bind(
      status,
      extra?.error ?? null,
      extra?.externalOrderRef ?? null,
      id,
    )
    .run();
}

export async function getOrderWithItems(
  db: D1Database,
  id: string,
): Promise<Order | null> {
  await ensureOrderSchema(db);

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
  await ensureOrderSchema(db);

  const result = await db
    .prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT ? OFFSET ?')
    .bind(limit, offset)
    .all<OrderRow>();
  return (result.results ?? []).map(parseOrder);
}

export async function deleteOrderById(
  db: D1Database,
  id: string,
): Promise<boolean> {
  await ensureOrderSchema(db);

  const result = await db.batch([
    db.prepare('DELETE FROM partner_commissions WHERE order_id = ?').bind(id),
    db.prepare('DELETE FROM order_items WHERE order_id = ?').bind(id),
    db.prepare('DELETE FROM orders WHERE id = ?').bind(id),
  ]);

  return result[1]?.meta?.changes ? result[1].meta.changes > 0 : false;
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
