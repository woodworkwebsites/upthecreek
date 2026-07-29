import type { Env } from '../../../types/env.js';
import type { NewsletterSubscriptionInput } from '../../../types/index.js';
import { getNewsletterSubscriberByEmail, subscribeNewsletter } from '../../../server/newsletter/repository.js';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  let body: NewsletterSubscriptionInput;

  try {
    body = await context.request.json() as NewsletterSubscriptionInput;
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return json({ error: 'Email is required' }, 400);
  }
  if (!isValidEmail(email)) {
    return json({ error: 'Please enter a valid email address' }, 400);
  }

  try {
    const existing = await getNewsletterSubscriberByEmail(context.env.DB, email);
    const subscription = await subscribeNewsletter(context.env.DB, {
      email,
      source: body.source?.trim() || 'homepage',
    });

    return json({
      subscription,
      alreadySubscribed: Boolean(existing),
    }, existing ? 200 : 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not save subscription';
    return json({ error: message }, 400);
  }
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
