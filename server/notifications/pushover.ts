import type { Env } from '../../types/env.js';
import { logger } from '../logging.js';

export interface PushoverMessage {
  title: string;
  message: string;
  url?: string;
  urlTitle?: string;
}

export async function sendPushoverNotification(
  env: Env,
  notification: PushoverMessage,
): Promise<void> {
  if (!env.PUSHOVER_APP_TOKEN || !env.PUSHOVER_USER_KEY) {
    logger.warn('Pushover not configured — skipping notification', { title: notification.title });
    return;
  }

  try {
    const body = new URLSearchParams({
      token:   env.PUSHOVER_APP_TOKEN,
      user:    env.PUSHOVER_USER_KEY,
      title:   notification.title,
      message: notification.message,
      ...(notification.url ? { url: notification.url } : {}),
      ...(notification.urlTitle ? { url_title: notification.urlTitle } : {}),
    });

    const res = await fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logger.error('Pushover notification failed', { status: res.status, body: text });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Pushover notification threw', { error: message });
  }
}
