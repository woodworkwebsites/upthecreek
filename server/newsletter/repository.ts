import type { D1Database } from '@cloudflare/workers-types';
import type { NewsletterSubscriberRow, NewsletterSubscriptionInput } from '../../types/index.js';

let newsletterSchemaReady: Promise<void> | null = null;

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export async function ensureNewsletterSchema(db: D1Database): Promise<void> {
  if (!newsletterSchemaReady) {
    newsletterSchemaReady = (async () => {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS newsletter_subscribers (
          id         TEXT PRIMARY KEY,
          email      TEXT NOT NULL UNIQUE,
          source     TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `).run();

      await db.prepare('CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_email ON newsletter_subscribers(email)').run();
    })();
  }

  await newsletterSchemaReady;
}

export async function subscribeNewsletter(
  db: D1Database,
  input: NewsletterSubscriptionInput,
): Promise<{ email: string; created: boolean }> {
  await ensureNewsletterSchema(db);

  const email = normalizeEmail(input.email);
  const source = input.source?.trim() || null;

  const result = await db
    .prepare(`
      INSERT INTO newsletter_subscribers (id, email, source, created_at, updated_at)
      VALUES (?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(email) DO UPDATE SET
        source = COALESCE(excluded.source, newsletter_subscribers.source),
        updated_at = datetime('now')
    `)
    .bind(crypto.randomUUID(), email, source)
    .run();

  return {
    email,
    created: (result.meta?.changes ?? 0) > 0,
  };
}

export async function getNewsletterSubscriberByEmail(
  db: D1Database,
  email: string,
): Promise<NewsletterSubscriberRow | null> {
  await ensureNewsletterSchema(db);

  const row = await db
    .prepare('SELECT * FROM newsletter_subscribers WHERE email = ?')
    .bind(normalizeEmail(email))
    .first<NewsletterSubscriberRow>();

  return row ?? null;
}
