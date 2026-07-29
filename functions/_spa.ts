import type { Env } from '../types/env.js';

export async function serveSpaShell(request: Request, _env: Env): Promise<Response> {
  const indexUrl = new URL('/index.html', request.url);
  const response = await fetch(new Request(indexUrl.toString(), { method: request.method }));
  return response;
}
