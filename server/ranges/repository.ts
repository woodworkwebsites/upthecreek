import type { D1Database } from '@cloudflare/workers-types';
import type { CatalogRange, CatalogRangeRow } from '../../types/index.js';

const DEFAULT_RANGE: CatalogRange = {
  id: 'evergreen',
  name: 'Evergreen',
  storefrontEnabled: true,
  partnerEnabled: true,
  sortOrder: 0,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

function parseRangeRow(row: CatalogRangeRow): CatalogRange {
  return {
    id: row.id,
    name: row.name,
    storefrontEnabled: row.storefront_enabled === 1,
    partnerEnabled: row.partner_enabled === 1,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listRanges(db: D1Database): Promise<CatalogRange[]> {
  try {
    const result = await db
      .prepare('SELECT * FROM ranges ORDER BY sort_order ASC, created_at ASC, name ASC')
      .all<CatalogRangeRow>();
    const ranges = (result.results ?? []).map(parseRangeRow);
    return ranges.length > 0 ? ranges : [DEFAULT_RANGE];
  } catch {
    return [DEFAULT_RANGE];
  }
}

export async function listEnabledRangeIds(db: D1Database, channel: 'storefront' | 'partner'): Promise<string[]> {
  const column = channel === 'storefront' ? 'storefront_enabled' : 'partner_enabled';
  try {
    const result = await db
      .prepare(`SELECT id FROM ranges WHERE ${column} = 1 ORDER BY sort_order ASC, created_at ASC`)
      .all<{ id: string }>();
    const ids = (result.results ?? []).map((row) => row.id);
    return ids.length > 0 ? ids : [DEFAULT_RANGE.id];
  } catch {
    return [DEFAULT_RANGE.id];
  }
}

export async function getRangeById(db: D1Database, id: string): Promise<CatalogRange | null> {
  try {
    const row = await db
      .prepare('SELECT * FROM ranges WHERE id = ?')
      .bind(id)
      .first<CatalogRangeRow>();
    if (row) return parseRangeRow(row);
    return id === DEFAULT_RANGE.id ? DEFAULT_RANGE : null;
  } catch {
    return id === DEFAULT_RANGE.id ? DEFAULT_RANGE : null;
  }
}

export async function createRange(
  db: D1Database,
  data: {
    name: string;
    storefrontEnabled?: boolean;
    partnerEnabled?: boolean;
    sortOrder?: number;
  },
): Promise<CatalogRange> {
  const id = crypto.randomUUID();
  const sortOrder = Number.isFinite(data.sortOrder ?? NaN) ? Math.round(data.sortOrder ?? 0) : 0;
  const storefrontEnabled = data.storefrontEnabled !== false;
  const partnerEnabled = data.partnerEnabled !== false;

  await db
    .prepare(`
      INSERT INTO ranges
        (id, name, storefront_enabled, partner_enabled, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `)
    .bind(id, data.name.trim(), storefrontEnabled ? 1 : 0, partnerEnabled ? 1 : 0, sortOrder)
    .run();

  return {
    id,
    name: data.name.trim(),
    storefrontEnabled,
    partnerEnabled,
    sortOrder,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function updateRange(
  db: D1Database,
  id: string,
  data: {
    name?: string;
    storefrontEnabled?: boolean;
    partnerEnabled?: boolean;
    sortOrder?: number;
  },
): Promise<CatalogRange | null> {
  const current = await getRangeById(db, id);
  if (!current && id !== DEFAULT_RANGE.id) return null;

  if (!current && id === DEFAULT_RANGE.id) {
    await db
      .prepare(`
        INSERT OR REPLACE INTO ranges
          (id, name, storefront_enabled, partner_enabled, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      `)
      .bind(
        DEFAULT_RANGE.id,
        DEFAULT_RANGE.name,
        data.storefrontEnabled !== false ? 1 : 0,
        data.partnerEnabled !== false ? 1 : 0,
        Number.isFinite(data.sortOrder ?? NaN) ? Math.round(data.sortOrder ?? 0) : 0,
      )
      .run();

    return getRangeById(db, id);
  }

  const name = data.name !== undefined ? data.name.trim() : current.name;
  const storefrontEnabled = data.storefrontEnabled ?? current.storefrontEnabled;
  const partnerEnabled = data.partnerEnabled ?? current.partnerEnabled;
  const sortOrder = data.sortOrder !== undefined ? Math.round(data.sortOrder) : current.sortOrder;

  await db
    .prepare(`
      UPDATE ranges
      SET name = ?, storefront_enabled = ?, partner_enabled = ?, sort_order = ?, updated_at = datetime('now')
      WHERE id = ?
    `)
    .bind(name, storefrontEnabled ? 1 : 0, partnerEnabled ? 1 : 0, sortOrder, id)
    .run();

  return getRangeById(db, id);
}

export async function deleteRange(db: D1Database, id: string): Promise<boolean> {
  if (id === DEFAULT_RANGE.id) return false;
  const result = await db
    .prepare('DELETE FROM ranges WHERE id = ?')
    .bind(id)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}
