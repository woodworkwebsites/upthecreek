import type { Env } from '../../../types/env.js';

export const onRequest: PagesFunction<Env>[] = [
  async (context) => {
    const auth  = context.request.headers.get('Authorization');
    const token = auth?.replace(/^Bearer\s+/i, '');

    if (!token || token !== context.env.ADMIN_TOKEN) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'WWW-Authenticate': 'Bearer realm="Admin"',
        },
      });
    }

    return context.next();
  },
];
