import type { D1Database } from '@cloudflare/workers-types';
import type {
  Order,
  OrderItem,
  Partner,
  PartnerAdmin,
  PartnerCollaborationDesign,
  PartnerCollaborationDesignRow,
  PartnerCommissionRow,
  PartnerCommissionStatus,
  PartnerDashboard,
  PartnerInput,
  PartnerOrderSummary,
  PartnerPayoutRow,
} from '../../types/index.js';
import { ensureOrderSchema, getOrderWithItems } from '../orders/repository.js';
import {
  createDiscountCode,
  getDiscountCodeByCode,
  updateDiscountCode,
} from '../discount-codes/repository.js';

type PartnerRow = {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  discount_code: string | null;
  commission_rate: number;
  description: string | null;
  active: number;
  collaboration_enabled: number;
  collaboration_design: string | null;
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

function normalizeCollaborationSizes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

function normalizeCollaborationImages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

function normalizeCollaborationDesign(design: Partial<PartnerCollaborationDesign> | null | undefined): PartnerCollaborationDesign | null {
  if (!design || typeof design !== 'object') return null;

  const partnerPrice = typeof design.partnerPrice === 'number'
    ? design.partnerPrice
    : typeof design.partnerPrice === 'string'
      ? Number(design.partnerPrice)
      : NaN;
  const rrp = typeof design.rrp === 'number'
    ? design.rrp
    : typeof (design as { rrp?: unknown }).rrp === 'string'
      ? Number((design as { rrp?: string }).rrp)
      : NaN;
  const normalizedImageUrls = normalizeCollaborationImages(
    Array.isArray(design.imageUrls) && design.imageUrls.length > 0
      ? design.imageUrls
      : typeof design.imageUrl === 'string'
        ? [design.imageUrl]
        : [],
  );

  return {
    title: typeof design.title === 'string' ? design.title.trim() : '',
    description: typeof design.description === 'string' ? design.description.trim() || null : null,
    imageUrl: normalizedImageUrls[0] ?? (typeof design.imageUrl === 'string' ? design.imageUrl.trim() || null : null),
    imageUrls: normalizedImageUrls,
    garment: typeof design.garment === 'string' ? design.garment.trim() || null : null,
    colorName: typeof design.colorName === 'string' ? design.colorName.trim() || 'Collaboration' : 'Collaboration',
    colorHex: typeof design.colorHex === 'string' ? design.colorHex.trim() || '#111827' : '#111827',
    sizes: normalizeCollaborationSizes(design.sizes),
    partnerPrice: Number.isFinite(partnerPrice) && partnerPrice >= 0 ? Math.round(partnerPrice) : 0,
    rrp: Number.isFinite(rrp) && rrp >= 0 ? Math.round(rrp) : (Number.isFinite(partnerPrice) && partnerPrice >= 0 ? Math.round(partnerPrice) : 0),
  };
}

function parseCollaborationDesigns(raw: string | null): PartnerCollaborationDesign[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    return entries
      .map((entry) => normalizeCollaborationDesign(entry as Partial<PartnerCollaborationDesign> | null))
      .filter((entry): entry is PartnerCollaborationDesign => Boolean(entry));
  } catch {
    return [];
  }
}

function parseCollaborationDesign(raw: string | null): PartnerCollaborationDesign | null {
  return parseCollaborationDesigns(raw)[0] ?? null;
}

function serializeCollaborationDesign(design: PartnerCollaborationDesign | null | undefined): string | null {
  if (!design) return null;
  return serializeCollaborationDesigns([design]);
}

function serializeCollaborationDesigns(designs: PartnerCollaborationDesign[] | null | undefined): string | null {
  const normalized = (designs ?? [])
    .map((design) => normalizeCollaborationDesign(design))
    .filter((entry): entry is PartnerCollaborationDesign => Boolean(entry));
  if (normalized.length === 0) return null;

  return JSON.stringify(normalized.map((design) => ({
    title: design.title.trim(),
    description: design.description?.trim() || null,
    imageUrl: design.imageUrls[0]?.trim() || design.imageUrl?.trim() || null,
    imageUrls: normalizeCollaborationImages(
      design.imageUrls.length > 0
        ? design.imageUrls
        : design.imageUrl
          ? [design.imageUrl]
          : [],
    ),
    garment: design.garment?.trim() || null,
    colorName: design.colorName.trim() || 'Collaboration',
    colorHex: design.colorHex.trim() || '#111827',
    sizes: normalizeCollaborationSizes(design.sizes),
    partnerPrice: Math.max(0, Math.round(design.partnerPrice)),
    rrp: Math.max(0, Math.round(design.rrp ?? design.partnerPrice)),
  })));
}

function parseJsonStringArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return normalizeCollaborationImages(parsed);
  } catch {
    return [];
  }
}

function parseCollaborationDesignRow(row: PartnerCollaborationDesignRow): PartnerCollaborationDesign {
  const imageUrls = parseJsonStringArray(row.image_urls);
  const partnerPrice = row.partner_price;
  const rrp = typeof row.rrp_price === 'number' ? row.rrp_price : partnerPrice;
  return {
    title: row.title,
    description: row.description,
    imageUrl: imageUrls[0] ?? null,
    imageUrls,
    garment: row.garment,
    colorName: row.color_name,
    colorHex: row.color_hex,
    sizes: normalizeCollaborationSizes(parseJsonStringArray(row.sizes)),
    partnerPrice,
    rrp,
  };
}

function serializeCollaborationDesignRow(
  partnerId: string,
  design: PartnerCollaborationDesign,
  sortOrder: number,
): {
  id: string;
  partner_id: string;
  title: string;
  description: string | null;
  image_urls: string;
  garment: string | null;
  color_name: string;
  color_hex: string;
  sizes: string;
  partner_price: number;
  sort_order: number;
} {
  const normalized = normalizeCollaborationDesign(design);
  if (!normalized) {
    throw new Error('Invalid collaboration design');
  }

  return {
    id: crypto.randomUUID(),
    partner_id: partnerId,
    title: normalized.title.trim(),
    description: normalized.description?.trim() || null,
    image_urls: JSON.stringify(normalized.imageUrls),
    garment: normalized.garment?.trim() || null,
    color_name: normalized.colorName.trim() || 'Collaboration',
    color_hex: normalized.colorHex.trim() || '#111827',
    sizes: JSON.stringify(normalizeCollaborationSizes(normalized.sizes)),
    partner_price: Math.max(0, Math.round(normalized.partnerPrice)),
    rrp_price: Math.max(0, Math.round(normalized.rrp)),
    sort_order: sortOrder,
  };
}

async function loadPartnerCollaborationDesignRows(
  db: D1Database,
  partnerId: string,
): Promise<PartnerCollaborationDesign[]> {
  await ensurePartnerSchema(db);

  const rows = await db
    .prepare('SELECT * FROM partner_collaboration_designs WHERE partner_id = ? ORDER BY sort_order ASC, created_at ASC')
    .bind(partnerId)
    .all<PartnerCollaborationDesignRow>();

  return (rows.results ?? []).map(parseCollaborationDesignRow);
}

async function replacePartnerCollaborationDesignRows(
  db: D1Database,
  partnerId: string,
  designs: PartnerCollaborationDesign[] | null | undefined,
): Promise<void> {
  await ensurePartnerSchema(db);

  const normalized = (designs ?? [])
    .map((design) => normalizeCollaborationDesign(design))
    .filter((entry): entry is PartnerCollaborationDesign => Boolean(entry));

  const statements = [
    db.prepare('DELETE FROM partner_collaboration_designs WHERE partner_id = ?').bind(partnerId),
    ...normalized.map((design, index) => {
      const row = serializeCollaborationDesignRow(partnerId, design, index);
      return db.prepare(`
        INSERT INTO partner_collaboration_designs
          (id, partner_id, title, description, image_urls, garment, color_name, color_hex, sizes, partner_price, rrp_price, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `).bind(
        row.id,
        row.partner_id,
        row.title,
        row.description,
        row.image_urls,
        row.garment,
        row.color_name,
        row.color_hex,
        row.sizes,
        row.partner_price,
        row.rrp_price,
        row.sort_order,
      );
    }),
  ];

  await db.batch(statements);
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

const PARTNER_DISCOUNT_CODE_PERCENT = 10;

async function syncPartnerDiscountCode(
  db: D1Database,
  code: string | null | undefined,
  notes: string,
): Promise<void> {
  const trimmed = code?.trim() || '';
  if (!trimmed) return;

  const payload = {
    code: trimmed,
    kind: 'percent' as const,
    value: PARTNER_DISCOUNT_CODE_PERCENT,
    usageLimit: null,
    active: true,
    expiresAt: null,
    notes,
  };

  const existing = await getDiscountCodeByCode(db, trimmed);
  if (existing) {
    await updateDiscountCode(db, existing.id, payload);
    return;
  }

  await createDiscountCode(db, payload);
}

export function parsePartnerRow(row: {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  discount_code: string | null;
  commission_rate: number;
  description: string | null;
  active: number;
  collaboration_enabled: number;
  collaboration_design: string | null;
  created_at: string;
  updated_at: string;
}): Partner {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    logoUrl: row.logo_url,
    discountCode: row.discount_code,
    commissionRate: row.commission_rate,
    description: row.description,
    active: row.active === 1,
    collaborationEnabled: row.collaboration_enabled === 1,
    collaborationDesigns: parseCollaborationDesigns(row.collaboration_design),
    collaborationDesign: parseCollaborationDesign(row.collaboration_design),
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
      logo_url        TEXT,
      discount_code   TEXT,
      access_token    TEXT UNIQUE NOT NULL,
      commission_rate INTEGER NOT NULL DEFAULT 10,
      description     TEXT,
      active          INTEGER NOT NULL DEFAULT 1,
      collaboration_enabled INTEGER NOT NULL DEFAULT 0,
      collaboration_design   TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS partner_collaboration_designs (
      id            TEXT PRIMARY KEY,
      partner_id    TEXT NOT NULL REFERENCES partners(id),
      title         TEXT NOT NULL,
      description   TEXT,
      image_urls    TEXT NOT NULL DEFAULT '[]',
      garment       TEXT,
      color_name    TEXT NOT NULL DEFAULT 'Collaboration',
      color_hex     TEXT NOT NULL DEFAULT '#111827',
      sizes         TEXT NOT NULL DEFAULT '[]',
      partner_price INTEGER NOT NULL DEFAULT 0,
      rrp_price     INTEGER NOT NULL DEFAULT 0,
      sort_order    INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
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
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_partner_collaboration_designs_partner_id ON partner_collaboration_designs(partner_id)').run();

  const columns = await db.prepare('PRAGMA table_info(partners)').all<{ name: string }>();
  const columnNames = new Set((columns.results ?? []).map((column) => column.name));
  if (!columnNames.has('collaboration_enabled')) {
    await db.prepare('ALTER TABLE partners ADD COLUMN collaboration_enabled INTEGER NOT NULL DEFAULT 0').run();
  }
  if (!columnNames.has('collaboration_design')) {
    await db.prepare('ALTER TABLE partners ADD COLUMN collaboration_design TEXT').run();
  }
  if (!columnNames.has('logo_url')) {
    await db.prepare('ALTER TABLE partners ADD COLUMN logo_url TEXT').run();
  }

  const designColumns = await db.prepare('PRAGMA table_info(partner_collaboration_designs)').all<{ name: string }>();
  const designColumnNames = new Set((designColumns.results ?? []).map((column) => column.name));
  if (!designColumnNames.has('rrp_price')) {
    await db.prepare('ALTER TABLE partner_collaboration_designs ADD COLUMN rrp_price INTEGER NOT NULL DEFAULT 0').run();
  }
}

async function hydratePartnerRow(db: D1Database, row: PartnerRow): Promise<PartnerAdmin> {
  const tableDesigns = await loadPartnerCollaborationDesignRows(db, row.id);
  const fallbackDesigns = tableDesigns.length > 0 ? tableDesigns : parseCollaborationDesigns(row.collaboration_design);

  return {
    ...parsePartnerRow({
      ...row,
      collaboration_design: fallbackDesigns.length > 0 ? serializeCollaborationDesigns(fallbackDesigns) : row.collaboration_design,
    }),
    collaborationDesigns: fallbackDesigns,
    collaborationDesign: fallbackDesigns[0] ?? null,
  };
}

export async function getPartnerByDiscountCode(db: D1Database, discountCode: string): Promise<Partner | null> {
  await ensurePartnerSchema(db);

  const row = await db
    .prepare(
      'SELECT id, slug, name, logo_url, discount_code, commission_rate, description, active, collaboration_enabled, collaboration_design, created_at, updated_at FROM partners WHERE discount_code IS NOT NULL AND UPPER(discount_code) = UPPER(?)',
    )
    .bind(discountCode.trim())
    .first<PartnerRow>();

  return row ? hydratePartnerRow(db, row) : null;
}

export async function getPartnerBySlug(db: D1Database, slug: string): Promise<Partner | null> {
  await ensurePartnerSchema(db);

  const row = await db
    .prepare(
      'SELECT id, slug, name, logo_url, discount_code, commission_rate, description, active, collaboration_enabled, collaboration_design, created_at, updated_at FROM partners WHERE slug = ?',
    )
    .bind(normalizeSlug(slug))
    .first<PartnerRow>();

  return row ? hydratePartnerRow(db, row) : null;
}

export async function getPartnerBySlugAndToken(
  db: D1Database,
  slug: string,
  accessToken: string,
): Promise<Partner | null> {
  await ensurePartnerSchema(db);

  const row = await db
    .prepare(
      'SELECT id, slug, name, logo_url, discount_code, commission_rate, description, active, collaboration_enabled, collaboration_design, created_at, updated_at FROM partners WHERE slug = ? AND access_token = ?',
    )
    .bind(normalizeSlug(slug), normalizeToken(accessToken))
    .first<PartnerRow>();

  return row ? hydratePartnerRow(db, row) : null;
}

export async function listPartners(db: D1Database): Promise<PartnerAdmin[]> {
  await ensurePartnerSchema(db);

  const result = await db
    .prepare(
      'SELECT id, slug, name, logo_url, discount_code, commission_rate, description, active, collaboration_enabled, collaboration_design, created_at, updated_at FROM partners ORDER BY created_at DESC',
    )
    .all<PartnerRow>();

  return Promise.all((result.results ?? []).map((row) => hydratePartnerRow(db, row)));
}

export async function getPartnerById(db: D1Database, id: string): Promise<PartnerAdmin | null> {
  await ensurePartnerSchema(db);

  const row = await db
    .prepare(
      'SELECT id, slug, name, logo_url, discount_code, commission_rate, description, active, collaboration_enabled, collaboration_design, created_at, updated_at FROM partners WHERE id = ?',
    )
    .bind(id)
    .first<PartnerRow>();

  return row ? hydratePartnerRow(db, row) : null;
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
  const collaborationDesigns = data.collaborationDesigns ?? (data.collaborationDesign ? [data.collaborationDesign] : []);
  const collaborationEnabled = Boolean(data.collaborationEnabled ?? false) || collaborationDesigns.length > 0;
  await db
    .prepare(`
      INSERT INTO partners
        (id, slug, name, logo_url, discount_code, access_token, commission_rate, description, active, collaboration_enabled, collaboration_design, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `)
    .bind(
      id,
      normalizeSlug(data.slug),
      data.name.trim(),
      data.logoUrl?.trim() || null,
      data.discountCode?.trim() || null,
      normalizeToken(accessToken),
      Math.max(0, Math.round(data.commissionRate)),
      data.description?.trim() || null,
      data.active === false ? 0 : 1,
      collaborationEnabled ? 1 : 0,
      serializeCollaborationDesigns(collaborationDesigns),
    )
    .run();

  await replacePartnerCollaborationDesignRows(db, id, collaborationDesigns);

  const created = await getPartnerById(db, id);
  if (!created) {
    throw new Error('Failed to create partner');
  }

  await syncPartnerDiscountCode(
    db,
    created.discountCode,
    `Partner code for ${created.name} (${created.slug})`,
  );

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
  const collaborationDesigns = data.collaborationDesigns !== undefined
    ? data.collaborationDesigns
    : data.collaborationDesign !== undefined
      ? (data.collaborationDesign ? [data.collaborationDesign] : [])
      : existing.collaborationDesigns;
  const collaborationEnabled = (data.collaborationEnabled ?? existing.collaborationEnabled) || collaborationDesigns.length > 0;

  const result = await db
    .prepare(`
      UPDATE partners
      SET slug = ?,
          name = ?,
          logo_url = ?,
          discount_code = ?,
          access_token = ?,
          commission_rate = ?,
          description = ?,
          active = ?,
          collaboration_enabled = ?,
          collaboration_design = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `)
    .bind(
      normalizeSlug(data.slug),
      data.name.trim(),
      data.logoUrl !== undefined ? data.logoUrl?.trim() || null : existing.logoUrl,
      data.discountCode?.trim() || null,
      normalizeToken(accessToken),
      Math.max(0, Math.round(data.commissionRate)),
      data.description?.trim() || null,
      data.active === false ? 0 : 1,
      collaborationEnabled ? 1 : 0,
      serializeCollaborationDesigns(collaborationDesigns),
      id,
    )
    .run();

  if (!result.success) return null;
  await replacePartnerCollaborationDesignRows(db, id, collaborationDesigns);
  const updated = await getPartnerById(db, id);
  if (!updated) return null;

  await syncPartnerDiscountCode(
    db,
    updated.discountCode,
    `Partner code for ${updated.name} (${updated.slug})`,
  );

  return updated;
}

export async function deletePartner(db: D1Database, id: string): Promise<boolean> {
  await ensurePartnerSchema(db);

  const result = await db
    .batch([
      db.prepare('DELETE FROM partner_collaboration_designs WHERE partner_id = ?').bind(id),
      db.prepare('DELETE FROM partners WHERE id = ?').bind(id),
    ]);
  return result[1]?.success ?? false;
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
  await ensureOrderSchema(db);

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
