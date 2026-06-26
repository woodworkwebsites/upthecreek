import type {
  Product,
  Order,
  CheckoutItem,
  CheckoutResponse,
  SyncLogRow,
  WebhookLogRow,
  PrintifyLogRow,
  TestPayloadRequest,
  TestOrderHandoffRequest,
} from '../../types/index.js';

async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

function adminFetch<T>(path: string, token: string, options?: RequestInit): Promise<T> {
  return apiFetch<T>(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchProducts(): Promise<Product[]> {
  const data = await apiFetch<{ products: Product[] }>('/api/products');
  return data.products;
}

export async function fetchProduct(id: string): Promise<Product> {
  const data = await apiFetch<{ product: Product }>(`/api/products/${id}`);
  return data.product;
}

export async function createCheckout(items: CheckoutItem[]): Promise<CheckoutResponse> {
  return apiFetch<CheckoutResponse>('/api/checkout', {
    method: 'POST',
    body: JSON.stringify({ items }),
  });
}

// ─── Admin API ────────────────────────────────────────────────────────────────

export async function adminFetchOrders(token: string): Promise<Order[]> {
  const data = await adminFetch<{ orders: Order[] }>('/api/admin/orders', token);
  return data.orders;
}

export async function adminFetchOrder(token: string, id: string): Promise<Order> {
  const data = await adminFetch<{ order: Order }>(`/api/admin/orders?id=${id}`, token);
  return data.order;
}

export async function adminFetchProducts(token: string): Promise<Product[]> {
  const data = await adminFetch<{ products: Product[] }>('/api/admin/products', token);
  return data.products;
}

export async function adminSyncProducts(
  token: string,
): Promise<{ productsFound: number; productsSynced: number; errors: string[] }> {
  return adminFetch('/api/admin/sync-products', token, { method: 'POST' });
}

export async function adminFetchLogs(token: string): Promise<{
  syncLogs: SyncLogRow[];
  webhookLogs: WebhookLogRow[];
  printifyLogs: PrintifyLogRow[];
}> {
  return adminFetch('/api/admin/logs', token);
}

export async function adminTestPayload(
  token: string,
  body: TestPayloadRequest,
): Promise<unknown> {
  return adminFetch('/api/admin/test-printify-payload', token, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function adminTestOrderHandoff(
  token: string,
  body: TestOrderHandoffRequest,
): Promise<unknown> {
  return adminFetch('/api/admin/test-order-handoff', token, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
