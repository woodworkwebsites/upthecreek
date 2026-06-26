import type { D1Database } from '@cloudflare/workers-types';

export async function getSetting(db: D1Database, key: string): Promise<string | null> {
  const row = await db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .bind(key)
    .first<{ value: string }>();
  return row?.value ?? null;
}

export async function setSetting(db: D1Database, key: string, value: string): Promise<void> {
  await db
    .prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
    `)
    .bind(key, value)
    .run();
}

export async function getAllSettings(db: D1Database): Promise<Record<string, string>> {
  const result = await db
    .prepare('SELECT key, value FROM settings')
    .all<{ key: string; value: string }>();
  return Object.fromEntries((result.results ?? []).map((r) => [r.key, r.value]));
}
