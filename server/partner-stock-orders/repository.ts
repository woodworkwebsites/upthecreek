import type { D1Database } from '@cloudflare/workers-types';
import type {
  PartnerStockOrder,
  PartnerStockOrderAdminSummary,
  PartnerStockOrderItem,
  PartnerStockOrderItemInput,
  PartnerStockOrderItemRow,
  PartnerStockOrderRow,
  PartnerStockOrderStatus,
} from '../../types/index.js';

let partnerStockOrderSchemaReady: Promise<void> | null = null;

export async function ensurePartnerStockOrderSchema(db: D1Database): Promise<void> {
  if (!partnerStockOrderSchemaReady) {
    partnerStockOrderSchemaReady = (async () => {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS partner_stock_orders (
          id           TEXT PRIMARY KEY,
          partner_id   TEXT NOT NULL REFERENCES partners(id),
          status       TEXT NOT NULL DEFAULT 'club_submitted',
          invoice_paid INTEGER NOT NULL DEFAULT 0,
          total_pieces INTEGER NOT NULL DEFAULT 0,
          total_value  INTEGER NOT NULL DEFAULT 0,
          notes        TEXT,
          created_at   TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `).run();

      await db.prepare(`
        CREATE TABLE IF NOT EXISTS partner_stock_order_items (
          id             TEXT PRIMARY KEY,
          stock_order_id TEXT NOT NULL REFERENCES partner_stock_orders(id),
          printify_id    TEXT NOT NULL,
          variant_id     INTEGER,
          title          TEXT NOT NULL,
          color          TEXT NOT NULL DEFAULT '',
          size           TEXT NOT NULL DEFAULT '',
          quantity       INTEGER NOT NULL DEFAULT 1,
          unit_price     INTEGER NOT NULL,
          created_at     TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `).run();

      await db.prepare('CREATE INDEX IF NOT EXISTS idx_partner_stock_orders_partner_id ON partner_stock_orders(partner_id)').run();
      await db.prepare('CREATE INDEX IF NOT EXISTS idx_partner_stock_order_items_order_id ON partner_stock_order_items(stock_order_id)').run();

      const columns = await db.prepare('PRAGMA table_info(partner_stock_orders)').all<{ name: string }>();
      const columnNames = new Set((columns.results ?? []).map((column) => column.name));
      if (!columnNames.has('invoice_paid')) {
        await db.prepare('ALTER TABLE partner_stock_orders ADD COLUMN invoice_paid INTEGER NOT NULL DEFAULT 0').run();
      }
    })();
  }

  await partnerStockOrderSchemaReady;
}

function parseStockOrder(row: PartnerStockOrderRow): PartnerStockOrder {
  return {
    id: row.id,
    partnerId: row.partner_id,
    status: row.status,
    invoicePaid: row.invoice_paid === 1,
    totalPieces: row.total_pieces,
    totalValue: row.total_value,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: [],
  };
}

function parseStockOrderItem(row: PartnerStockOrderItemRow): PartnerStockOrderItem {
  return {
    id: row.id,
    stockOrderId: row.stock_order_id,
    printifyId: row.printify_id,
    variantId: row.variant_id,
    title: row.title,
    color: row.color,
    size: row.size,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    createdAt: row.created_at,
  };
}

export async function createPartnerStockOrder(
  db: D1Database,
  partnerId: string,
  items: PartnerStockOrderItemInput[],
  notes: string | null,
): Promise<PartnerStockOrder> {
  await ensurePartnerStockOrderSchema(db);

  const id = crypto.randomUUID();
  const totalPieces = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalValue = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  await db.batch([
    db
      .prepare(`
        INSERT INTO partner_stock_orders
          (id, partner_id, status, invoice_paid, total_pieces, total_value, notes, created_at, updated_at)
        VALUES (?, ?, 'club_submitted', 0, ?, ?, ?, datetime('now'), datetime('now'))
      `)
      .bind(id, partnerId, totalPieces, totalValue, notes),
    ...items.map((item) =>
      db
        .prepare(`
          INSERT INTO partner_stock_order_items
            (id, stock_order_id, printify_id, variant_id, title, color, size, quantity, unit_price, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `)
        .bind(
          crypto.randomUUID(),
          id,
          item.printifyId,
          item.variantId,
          item.title,
          item.color,
          item.size,
          item.quantity,
          item.unitPrice,
        ),
    ),
  ]);

  const order = await getPartnerStockOrderWithItems(db, id);
  if (!order) {
    throw new Error('Failed to create stock order');
  }
  return order;
}

export async function getPartnerStockOrderWithItems(
  db: D1Database,
  id: string,
): Promise<PartnerStockOrder | null> {
  await ensurePartnerStockOrderSchema(db);

  const row = await db
    .prepare('SELECT * FROM partner_stock_orders WHERE id = ?')
    .bind(id)
    .first<PartnerStockOrderRow>();
  if (!row) return null;

  const itemsResult = await db
    .prepare('SELECT * FROM partner_stock_order_items WHERE stock_order_id = ?')
    .bind(id)
    .all<PartnerStockOrderItemRow>();

  const order = parseStockOrder(row);
  order.items = (itemsResult.results ?? []).map(parseStockOrderItem);
  return order;
}

export async function listPartnerStockOrders(
  db: D1Database,
  limit = 100,
): Promise<PartnerStockOrderAdminSummary[]> {
  await ensurePartnerStockOrderSchema(db);

  const rows = await db
    .prepare(`
      SELECT partner_stock_orders.*, partners.name AS partner_name, partners.slug AS partner_slug
      FROM partner_stock_orders
      JOIN partners ON partners.id = partner_stock_orders.partner_id
      ORDER BY partner_stock_orders.created_at DESC
      LIMIT ?
    `)
    .bind(limit)
    .all<PartnerStockOrderRow & { partner_name: string; partner_slug: string }>();

  const orderRows = rows.results ?? [];
  if (orderRows.length === 0) return [];

  const orderIds = orderRows.map((row) => row.id);
  const placeholders = orderIds.map(() => '?').join(', ');
  const itemsResult = await db
    .prepare(`SELECT * FROM partner_stock_order_items WHERE stock_order_id IN (${placeholders})`)
    .bind(...orderIds)
    .all<PartnerStockOrderItemRow>();

  const itemsByOrderId = new Map<string, PartnerStockOrderItem[]>();
  for (const itemRow of itemsResult.results ?? []) {
    const item = parseStockOrderItem(itemRow);
    const list = itemsByOrderId.get(item.stockOrderId) ?? [];
    list.push(item);
    itemsByOrderId.set(item.stockOrderId, list);
  }

  return orderRows.map((row) => ({
    ...parseStockOrder(row),
    items: itemsByOrderId.get(row.id) ?? [],
    partnerName: row.partner_name,
    partnerSlug: row.partner_slug,
  }));
}

export async function updatePartnerStockOrderStatus(
  db: D1Database,
  id: string,
  patch: {
    status?: PartnerStockOrderStatus;
    invoicePaid?: boolean;
  },
): Promise<boolean> {
  await ensurePartnerStockOrderSchema(db);

  const sets: string[] = [];
  const values: Array<string | number> = [];

  if (patch.status !== undefined) {
    sets.push('status = ?');
    values.push(patch.status);
  }

  if (patch.invoicePaid !== undefined) {
    sets.push('invoice_paid = ?');
    values.push(patch.invoicePaid ? 1 : 0);
  }

  if (sets.length === 0) {
    return false;
  }

  const result = await db
    .prepare(`
      UPDATE partner_stock_orders
      SET ${sets.join(', ')}, updated_at = datetime('now')
      WHERE id = ?
    `)
    .bind(...values, id)
    .run();

  return result.success && (result.meta?.changes ?? 0) > 0;
}

export async function deletePartnerStockOrder(
  db: D1Database,
  id: string,
): Promise<boolean> {
  await ensurePartnerStockOrderSchema(db);

  const result = await db.batch([
    db.prepare('DELETE FROM partner_stock_order_items WHERE stock_order_id = ?').bind(id),
    db.prepare('DELETE FROM partner_stock_orders WHERE id = ?').bind(id),
  ]);

  return result[1]?.meta?.changes ? result[1].meta.changes > 0 : false;
}
