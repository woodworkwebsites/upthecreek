import type { D1Database } from '@cloudflare/workers-types';
import type {
  Order,
  OrderItem,
  Partner,
  PartnerAdmin,
  PartnerCommissionRow,
  PartnerCommissionStatus,
  PartnerDashboard,
  PartnerInput,
  PartnerOrderSummary,
  PartnerPayoutRow,
} from '../../types/index.js';
import { getOrderWithItems } from '../orders/repository.js';

type PartnerRow = {
  id: string;
  slug: string;
  name: string;
  discount_code: string | null;
  commission_rate: number;
  description: string | null;
  active: number;
  created_at: string;
  updated_at: string;
};

type PartnerSecretRow = PartnerRow & {
  access_token: string;
};

function normalizeSlug(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeToken(value: string): string {
  return value.trim();
}

function calcItemTotal(items: OrderItem[]): number {
  return items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
}

function calcCommission(netSales: number, commissionRate: number): number {
  return Math.max(0, Math.round((netSales * commissionRate) / 100));
}

function commissionStatusFromOrderStatus(status: Order['status']): PartnerCommissionStatus {
  switch (status) {
    case 'fulfilled':
      return 'paid';
    case 'failed':
      return 'void';
    default:
      return 'pending';
  }
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

function parsePartnerAdminRow(row: PartnerRow & { access_token?: string }): PartnerAdmin {
  return {
    ...parsePartnerRow(row),
    accessToken: row.access_token,
  };
}

function parseCommissionRow(row: {
  id: string;
  partner_id: string;
  order_id: string;
  order_status: Order['status'];
  gross_sales: number;
  discount_amount: number;
  commission_rate: number;
  commission_amount: number;
  status: PartnerCommissionStatus;
  payout_id: string | null;
  created_at: string;
  updated_at: string;
}): PartnerCommissionRow {
  return {
    id: row.id,
    partner_id: row.partner_id,
    order_id: row.order_id,
    order_status: row.order_status,
    gross_sales: row.gross_sales,
    discount_amount: row.discount_amount,
    commission_rate: row.commission_rate,
    commission_amount: row.commission_amount,
    status: row.status,
    payout_id: row.payout_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function parsePayoutRow(row: {
  id: string;
  partner_id: string;
  period_start: string | null;
  period_end: string | null;
  amount: number;
  reference: string | null;
  notes: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}): PartnerPayoutRow {
  return {
    id: row.id,
    partner_id: row.partner_id,
    period_start: row.period_start,
    period_end: row.period_end,
    amount: row.amount,
    reference: row.reference,
    notes: row.notes,
    paid_at: row.paid_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
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

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS partner_commissions (
      id                TEXT PRIMARY KEY,
      partner_id        TEXT NOT NULL,
      order_id          TEXT NOT NULL UNIQUE,
      order_status      TEXT NOT NULL,
      gross_sales       INTEGER NOT NULL,
      discount_amount   INTEGER NOT NULL DEFAULT 0,
      commission_rate   INTEGER NOT NULL DEFAULT 0,
      commission_amount INTEGER NOT NULL DEFAULT 0,
      status            TEXT NOT NULL DEFAULT 'pending',
      payout_id         TEXT,
      created_at        TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS partner_payouts (
      id           TEXT PRIMARY KEY,
      partner_id   TEXT NOT NULL,
      period_start TEXT,
      period_end   TEXT,
      amount       INTEGER NOT NULL DEFAULT 0,
      reference    TEXT,
      notes        TEXT,
      paid_at      TEXT,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();

  await db.prepare('CREATE INDEX IF NOT EXISTS idx_partners_slug ON partners(slug)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_partners_discount_code ON partners(discount_code)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_partners_access_token ON partners(access_token)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_partner_commissions_partner_id ON partner_commissions(partner_id)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_partner_commissions_status ON partner_commissions(status)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_partner_payouts_partner_id ON partner_payouts(partner_id)').run();
}

export async function getPartnerByDiscountCode(db: D1Database, discountCode: string): Promise<Partner | null> {
  await ensurePartnerSchema(db);

  const row = await db
    .prepare(
      'SELECT id, slug, name, discount_code, commission_rate, description, active, created_at, updated_at FROM partners WHERE discount_code IS NOT NULL AND UPPER(discount_code) = UPPER(?)',
    )
    .bind(discountCode.trim())
    .first<PartnerRow>();

  return row ? parsePartnerRow(row) : null;
}

export async function getPartnerBySlug(db: D1Database, slug: string): Promise<Partner | null> {
  await ensurePartnerSchema(db);

  const row = await db
    .prepare(
      'SELECT id, slug, name, discount_code, commission_rate, description, active, created_at, updated_at FROM partners WHERE slug = ?',
    )
    .bind(normalizeSlug(slug))
    .first<PartnerRow>();

  return row ? parsePartnerRow(row) : null;
}

export async function getPartnerBySlugAndToken(
  db: D1Database,
  slug: string,
  accessToken: string,
): Promise<Partner | null> {
  await ensurePartnerSchema(db);

  const row = await db
    .prepare(
      'SELECT id, slug, name, discount_code, commission_rate, description, active, created_at, updated_at FROM partners WHERE slug = ? AND access_token = ?',
    )
    .bind(normalizeSlug(slug), normalizeToken(accessToken))
    .first<PartnerRow>();

  return row ? parsePartnerRow(row) : null;
}

export async function listPartners(db: D1Database): Promise<PartnerAdmin[]> {
  await ensurePartnerSchema(db);

  const result = await db
    .prepare(
      'SELECT id, slug, name, discount_code, commission_rate, description, active, created_at, updated_at FROM partners ORDER BY created_at DESC',
    )
    .all<PartnerRow>();

  return (result.results ?? []).map(parsePartnerRow);
}

export async function getPartnerById(db: D1Database, id: string): Promise<PartnerAdmin | null> {
  await ensurePartnerSchema(db);

  const row = await db
    .prepare(
      'SELECT id, slug, name, discount_code, commission_rate, description, active, created_at, updated_at FROM partners WHERE id = ?',
    )
    .bind(id)
    .first<PartnerRow>();

  return row ? parsePartnerRow(row) : null;
}

async function getPartnerSecretById(db: D1Database, id: string): Promise<(Partner & { accessToken: string }) | null> {
  await ensurePartnerSchema(db);

  const row = await db
    .prepare('SELECT * FROM partners WHERE id = ?')
    .bind(id)
    .first<PartnerSecretRow>();

  if (!row) return null;

  return {
    ...parsePartnerRow(row),
    accessToken: row.access_token,
  };
}

export async function createPartner(db: D1Database, data: PartnerInput): Promise<PartnerAdmin> {
  await ensurePartnerSchema(db);

  const accessToken = data.accessToken?.trim();
  if (!accessToken) {
    throw new Error('Access token is required');
  }

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
      normalizeToken(accessToken),
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

  const existing = await getPartnerSecretById(db, id);
  if (!existing) return null;

  const accessToken = data.accessToken?.trim() || existing.accessToken;

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
      normalizeToken(accessToken),
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

export async function createPartnerCommissionFromOrder(
  db: D1Database,
  partner: Partner,
  order: Order,
): Promise<void> {
  await ensurePartnerSchema(db);

  const items = order.items ?? [];
  const grossSales = calcItemTotal(items);
  const netSales = Math.max(0, grossSales - (order.discountAmount ?? 0));
  const commissionAmount = calcCommission(netSales, partner.commissionRate);
  const status = commissionStatusFromOrderStatus(order.status);

  await db
    .prepare(`
      INSERT INTO partner_commissions
        (id, partner_id, order_id, order_status, gross_sales, discount_amount, commission_rate, commission_amount, status, payout_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, datetime('now'), datetime('now'))
      ON CONFLICT(order_id) DO UPDATE SET
        partner_id = excluded.partner_id,
        order_status = excluded.order_status,
        gross_sales = excluded.gross_sales,
        discount_amount = excluded.discount_amount,
        commission_rate = excluded.commission_rate,
        commission_amount = excluded.commission_amount,
        status = excluded.status,
        updated_at = datetime('now')
    `)
    .bind(
      crypto.randomUUID(),
      partner.id,
      order.id,
      order.status,
      grossSales,
      order.discountAmount ?? 0,
      partner.commissionRate,
      commissionAmount,
      status,
    )
    .run();
}

export async function syncPartnerCommissionStatusByOrderId(
  db: D1Database,
  orderId: string,
  orderStatus: Order['status'],
): Promise<void> {
  await ensurePartnerSchema(db);

  await db
    .prepare(`
      UPDATE partner_commissions
      SET order_status = ?,
          status = ?,
          updated_at = datetime('now')
      WHERE order_id = ?
    `)
    .bind(orderStatus, commissionStatusFromOrderStatus(orderStatus), orderId)
    .run();
}

export async function deletePartnerCommissionByOrderId(db: D1Database, orderId: string): Promise<void> {
  await ensurePartnerSchema(db);

  await db
    .prepare('DELETE FROM partner_commissions WHERE order_id = ?')
    .bind(orderId)
    .run();
}

export async function listPartnerPayouts(db: D1Database, partnerId: string, limit = 12): Promise<PartnerPayoutRow[]> {
  await ensurePartnerSchema(db);

  const result = await db
    .prepare('SELECT * FROM partner_payouts WHERE partner_id = ? ORDER BY created_at DESC LIMIT ?')
    .bind(partnerId, limit)
    .all<{
      id: string;
      partner_id: string;
      period_start: string | null;
      period_end: string | null;
      amount: number;
      reference: string | null;
      notes: string | null;
      paid_at: string | null;
      created_at: string;
      updated_at: string;
    }>();

  return (result.results ?? []).map(parsePayoutRow);
}

function summarisePartnerOrder(order: Order, commission: PartnerCommissionRow): PartnerOrderSummary {
  const items = order.items ?? [];
  const grossSales = calcItemTotal(items);
  const netSales = Math.max(0, grossSales - (order.discountAmount ?? 0));

  return {
    id: order.id,
    orderId: order.id,
    status: order.status,
    commissionStatus: commission.status,
    customerEmail: order.customerEmail,
    customerName: order.customerName,
    amountTotal: order.amountTotal,
    currency: order.currency,
    discountCode: order.discountCode,
    discountAmount: order.discountAmount ?? 0,
    commissionAmount: commission.commission_amount,
    payoutId: commission.payout_id,
    fulfillmentProvider: order.fulfillmentProvider,
    externalOrderRef: order.externalOrderRef,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items,
  };
}

async function loadPartnerOrdersFromDiscountCode(
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

export async function listPartnerOrderSummaries(
  db: D1Database,
  partner: Partner,
  limit = 12,
): Promise<PartnerOrderSummary[]> {
  await ensurePartnerSchema(db);

  const commissionRows = await db
    .prepare(
      'SELECT * FROM partner_commissions WHERE partner_id = ? ORDER BY created_at DESC LIMIT ?',
    )
    .bind(partner.id, limit)
    .all<{
      id: string;
      partner_id: string;
      order_id: string;
      order_status: Order['status'];
      gross_sales: number;
      discount_amount: number;
      commission_rate: number;
      commission_amount: number;
      status: PartnerCommissionStatus;
      payout_id: string | null;
      created_at: string;
      updated_at: string;
    }>();

  if ((commissionRows.results ?? []).length > 0) {
    const commissions = (commissionRows.results ?? []).map(parseCommissionRow);
    const orders = await Promise.all(
      commissions.map(async (commission) => ({
        commission,
        order: await getOrderWithItems(db, commission.order_id),
      })),
    );

    return orders
      .filter((entry): entry is { commission: PartnerCommissionRow; order: Order } => Boolean(entry.order))
      .map(({ commission, order }) => summarisePartnerOrder(order, commission));
  }

  const fallbackOrders = await loadPartnerOrdersFromDiscountCode(db, partner, limit);

  return fallbackOrders.map((order) =>
    summarisePartnerOrder(order, {
      id: `legacy:${order.id}`,
      partner_id: partner.id,
      order_id: order.id,
      order_status: order.status,
      gross_sales: calcItemTotal(order.items ?? []),
      discount_amount: order.discountAmount ?? 0,
      commission_rate: partner.commissionRate,
      commission_amount: calcCommission(
        Math.max(0, calcItemTotal(order.items ?? []) - (order.discountAmount ?? 0)),
        partner.commissionRate,
      ),
      status: commissionStatusFromOrderStatus(order.status),
      payout_id: null,
      created_at: order.createdAt,
      updated_at: order.updatedAt,
    }),
  );
}

export function summarisePartnerDashboard(
  partner: Partner,
  recentOrders: PartnerOrderSummary[],
): PartnerDashboard {
  const summary = recentOrders.reduce(
    (acc, order) => {
      const grossSales = order.items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
      const netSales = Math.max(0, grossSales - order.discountAmount);
      const commission = order.commissionAmount;

      acc.totalOrders += 1;
      acc.grossSales += grossSales;
      acc.netSales += netSales;
      acc.discountTotal += order.discountAmount;

      if (order.commissionStatus !== 'void') {
        acc.commissionDue += commission;
      }

      if (order.commissionStatus === 'paid') {
        acc.commissionPaid += commission;
      } else if (order.commissionStatus === 'pending') {
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
