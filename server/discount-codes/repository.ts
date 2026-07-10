import type { D1Database } from '@cloudflare/workers-types';
import type { DiscountCode, DiscountCodeKind, DiscountCodeRow, DiscountCodeInput } from '../../types/index.js';

function parseDiscountCode(row: DiscountCodeRow): DiscountCode {
  return {
    id:          row.id,
    code:        row.code,
    kind:        row.kind,
    value:       row.value,
    usageLimit:  row.usage_limit,
    usageCount:  row.usage_count,
    active:      row.active === 1,
    expiresAt:   row.expires_at,
    notes:       row.notes,
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
  };
}

export async function listDiscountCodes(db: D1Database): Promise<DiscountCode[]> {
  const result = await db
    .prepare('SELECT * FROM discount_codes ORDER BY created_at DESC')
    .all<DiscountCodeRow>();
  return (result.results ?? []).map(parseDiscountCode);
}

export async function getDiscountCodeById(db: D1Database, id: string): Promise<DiscountCode | null> {
  const row = await db
    .prepare('SELECT * FROM discount_codes WHERE id = ?')
    .bind(id)
    .first<DiscountCodeRow>();
  return row ? parseDiscountCode(row) : null;
}

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

export async function createDiscountCode(
  db: D1Database,
  data: DiscountCodeInput,
): Promise<DiscountCode> {
  const id = crypto.randomUUID();
  const code = normalizeCode(data.code);
  const kind: DiscountCodeKind = data.kind;
  const value = Math.max(0, Math.round(data.value));
  const usageLimit = data.usageLimit ?? null;
  const active = data.active === false ? 0 : 1;
  const expiresAt = data.expiresAt?.trim() || null;
  const notes = data.notes?.trim() || null;

  await db
    .prepare(`
      INSERT INTO discount_codes
        (id, code, kind, value, usage_limit, usage_count, active, expires_at, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, datetime('now'), datetime('now'))
    `)
    .bind(id, code, kind, value, usageLimit, active, expiresAt, notes)
    .run();

  const created = await getDiscountCodeById(db, id);
  if (!created) {
    throw new Error('Failed to create discount code');
  }

  return created;
}

export async function updateDiscountCode(
  db: D1Database,
  id: string,
  data: DiscountCodeInput,
): Promise<DiscountCode | null> {
  const code = normalizeCode(data.code);
  const kind: DiscountCodeKind = data.kind;
  const value = Math.max(0, Math.round(data.value));
  const usageLimit = data.usageLimit ?? null;
  const active = data.active === false ? 0 : 1;
  const expiresAt = data.expiresAt?.trim() || null;
  const notes = data.notes?.trim() || null;

  const result = await db
    .prepare(`
      UPDATE discount_codes
      SET code = ?,
          kind = ?,
          value = ?,
          usage_limit = ?,
          active = ?,
          expires_at = ?,
          notes = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `)
    .bind(code, kind, value, usageLimit, active, expiresAt, notes, id)
    .run();

  if (!result.success) return null;
  return getDiscountCodeById(db, id);
}

export async function deleteDiscountCode(db: D1Database, id: string): Promise<boolean> {
  const result = await db
    .prepare('DELETE FROM discount_codes WHERE id = ?')
    .bind(id)
    .run();
  return result.success;
}

