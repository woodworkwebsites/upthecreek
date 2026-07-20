import type { D1Database } from '@cloudflare/workers-types';
import type { Order, OrderItem, Partner, PartnerAdmin, PartnerDashboard, PartnerInput, PartnerOrderSummary } from '../../types/index.js';
import { getOrderWithItems } from '../orders/repository.js';

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeToken(value: string): string {
  return value.trim();
}

export function parsePartnerRow(row: {
  id: string;
  slug: string;
  name: string;
  discount_code: string | null;
  commission_rate: number;
  description: string | null;
  active: number;
  created_at: string;
  updated_at: string;
}): Partner {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    discountCode: row.discount_code,
    commissionRate: row.commission_rate,
    description: row.description,
    active: row.active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function ensurePartnerSchema(db: D1Database): Promise<void> {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS partners (
      id              TEXT PRIMARY KEY,
      slug            TEXT UNIQUE NOT NULL,
      name            TEXT NOT NULL,
      discount_code   TEXT,
      access_token    TEXT UNIQUE NOT NULL,
      commission_rate INTEGER NOT NULL DEFAULT 10,
      description     TEXT,
      active          INTEGER NOT NULL DEFAULT 1,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();

  await db.prepare('CREATE INDEX IF NOT EXISTS idx_partners_slug ON partners(slug)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_partners_discount_code ON partners(discount_code)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_partners_access_token ON partners(access_token)').run();
}

function parsePartnerAdminRow(row: {
  id: string;
  slug: string;
  name: string;
  discount_code: string | null;
  access_token: string;
  commission_rate: number;
  description: string | null;
  active: number;
  created_at: string;
  updated_at: string;
}): PartnerAdmin {
  return {
    ...parsePartnerRow(row),
    accessToken: row.access_token,
  };
}

export async function getPartnerBySlug(db: D1Database, slug: string): Promise<Partner | null> {
  await ensurePartnerSchema(db);
  const row = await db
    .prepare('SELECT * FROM partners WHERE slug = ?')
    .bind(normalizeSlug(slug))
    .first<{
      id: string;
      slug: string;
      name: string;
      discount_code: string | null;
      commission_rate: number;
      description: string | null;
      active: number;
      created_at: string;
      updated_at: string;
    }>();

  return row ? parsePartnerRow(row) : null;
}

export async function getPartnerBySlugAndToken(
  db: D1Database,
  slug: string,
  accessToken: string,
): Promise<Partner | null> {
  await ensurePartnerSchema(db);
  const row = await db
    .prepare('SELECT * FROM partners WHERE slug = ? AND access_token = ?')
    .bind(normalizeSlug(slug), normalizeToken(accessToken))
    .first<{
      id: string;
      slug: string;
      name: string;
      discount_code: string | null;
      commission_rate: number;
      description: string | null;
      active: number;
      created_at: string;
      updated_at: string;
    }>();

  return row ? parsePartnerRow(row) : null;
}

export async function listPartners(db: D1Database): Promise<PartnerAdmin[]> {
  await ensurePartnerSchema(db);

  const result = await db
    .prepare('SELECT * FROM partners ORDER BY created_at DESC')
    .all<{
      id: string;
      slug: string;
      name: string;
      discount_code: string | null;
      access_token: string;
      commission_rate: number;
      description: string | null;
      active: number;
      created_at: string;
      updated_at: string;
    }>();

  return (result.results ?? []).map(parsePartnerAdminRow);
}

export async function getPartnerById(db: D1Database, id: string): Promise<PartnerAdmin | null> {
  await ensurePartnerSchema(db);

  const row = await db
    .prepare('SELECT * FROM partners WHERE id = ?')
    .bind(id)
    .first<{
      id: string;
      slug: string;
      name: string;
      discount_code: string | null;
      access_token: string;
      commission_rate: number;
      description: string | null;
      active: number;
      created_at: string;
      updated_at: string;
    }>();

  return row ? parsePartnerAdminRow(row) : null;
}

export async function createPartner(db: D1Database, data: PartnerInput): Promise<PartnerAdmin> {
  await ensurePartnerSchema(db);

  const id = crypto.randomUUID();
  await db
    .prepare(`
      INSERT INTO partners
        (id, slug, name, discount_code, access_token, commission_rate, description, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `)
    .bind(
      id,
      normalizeSlug(data.slug),
      data.name.trim(),
      data.discountCode?.trim() || null,
      normalizeToken(data.accessToken),
      Math.max(0, Math.round(data.commissionRate)),
      data.description?.trim() || null,
      data.active === false ? 0 : 1,
    )
    .run();

  const created = await getPartnerById(db, id);
  if (!created) {
    throw new Error('Failed to create partner');
  }

  return created;
}

export async function updatePartner(
  db: D1Database,
  id: string,
  data: PartnerInput,
): Promise<PartnerAdmin | null> {
  await ensurePartnerSchema(db);

  const result = await db
    .prepare(`
      UPDATE partners
      SET slug = ?,
          name = ?,
          discount_code = ?,
          access_token = ?,
          commission_rate = ?,
          description = ?,
          active = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `)
    .bind(
      normalizeSlug(data.slug),
      data.name.trim(),
      data.discountCode?.trim() || null,
      normalizeToken(data.accessToken),
      Math.max(0, Math.round(data.commissionRate)),
      data.description?.trim() || null,
      data.active === false ? 0 : 1,
      id,
    )
    .run();

  if (!result.success) return null;
  return getPartnerById(db, id);
}

export async function deletePartner(db: D1Database, id: string): Promise<boolean> {
  await ensurePartnerSchema(db);

  const result = await db
    .prepare('DELETE FROM partners WHERE id = ?')
    .bind(id)
    .run();
  return result.success;
}

function calcItemTotal(items: OrderItem[]): number {
  return items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
}

function calcCommission(netSales: number, commissionRate: number): number {
  return Math.max(0, Math.round((netSales * commissionRate) / 100));
}

export function summarisePartnerOrder(order: Order, commissionRate: number): PartnerOrderSummary {
  const items = order.items ?? [];
  const grossSales = calcItemTotal(items);
  const netSales = Math.max(0, grossSales - (order.discountAmount ?? 0));

  return {
    id: order.id,
    status: order.status,
    customerEmail: order.customerEmail,
    customerName: order.customerName,
    amountTotal: order.amountTotal,
    currency: order.currency,
    discountCode: order.discountCode,
    discountAmount: order.discountAmount ?? 0,
    commissionAmount: calcCommission(netSales, commissionRate),
    fulfillmentProvider: order.fulfillmentProvider,
    externalOrderRef: order.externalOrderRef,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items,
  };
}

export async function listPartnerOrders(
  db: D1Database,
  partner: Partner,
  limit = 12,
): Promise<Order[]> {
  if (!partner.discountCode) return [];

  const rows = await db
    .prepare(
      'SELECT id FROM orders WHERE UPPER(discount_code) = UPPER(?) ORDER BY created_at DESC LIMIT ?',
    )
    .bind(partner.discountCode, limit)
    .all<{ id: string }>();

  const orders = await Promise.all(
    (rows.results ?? []).map(async ({ id }) => getOrderWithItems(db, id)),
  );

  return orders.filter((order): order is Order => Boolean(order));
}

export function summarisePartnerDashboard(
  partner: Partner,
  orders: Order[],
): PartnerDashboard {
  const recentOrders = orders.map((order) => summarisePartnerOrder(order, partner.commissionRate));

  const summary = recentOrders.reduce(
    (acc, order) => {
      const grossSales = order.items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
      const netSales = Math.max(0, grossSales - order.discountAmount);
      const commission = order.commissionAmount;

      acc.totalOrders += 1;
      acc.grossSales += grossSales;
      acc.netSales += netSales;
      acc.discountTotal += order.discountAmount;
      acc.commissionDue += commission;

      if (order.status === 'fulfilled') {
        acc.commissionPaid += commission;
      } else {
        acc.commissionPending += commission;
      }

      return acc;
    },
    {
      totalOrders: 0,
      grossSales: 0,
      netSales: 0,
      discountTotal: 0,
      commissionDue: 0,
      commissionPaid: 0,
      commissionPending: 0,
    },
  );

  return {
    partner,
    summary,
    recentOrders,
  };
}
