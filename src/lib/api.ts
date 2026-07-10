import type {
  Product,
  PricingMatrixRow,
  Order,
  CheckoutItem,
  CheckoutResponse,
  SyncLogRow,
  WebhookLogRow,
  PrintifyLogRow,
  TestPayloadRequest,
  TestOrderHandoffRequest,
  DiscountCode,
  DiscountCodeInput,
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

export async function createCheckout(
  items: CheckoutItem[],
  discountCode?: string | null,
): Promise<CheckoutResponse> {
  return apiFetch<CheckoutResponse>('/api/checkout', {
    method: 'POST',
    body: JSON.stringify({
      items,
      discountCode: discountCode?.trim() || null,
    }),
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

export async function adminFulfillOrder(
  token: string,
  id: string,
  externalOrderRef?: string,
): Promise<void> {
  await adminFetch(`/api/admin/orders/${id}/fulfill`, token, {
    method: 'POST',
    body: JSON.stringify({ externalOrderRef }),
  });
}

export async function adminUpdateOrderStatus(
  token: string,
  id: string,
  status: Order['status'],
  externalOrderRef?: string,
): Promise<void> {
  await adminFetch(`/api/admin/orders/${id}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ status, externalOrderRef }),
  });
}

export async function adminFetchProducts(token: string): Promise<Product[]> {
  const data = await adminFetch<{ products: Product[] }>('/api/admin/products', token);
  return data.products;
}

export async function adminUpdateProduct(
  token: string,
  printifyId: string,
  data: {
    title?: string;
    description?: string;
    category?: string;
    audience?: string;
    productType?: string;
    garment?: string;
    customColors?: Array<{ name: string; hex: string }>;
    pricingMatrix?: PricingMatrixRow | null;
    isEnabled?: boolean;
    sizeGuideImage?: string | null;
    hiddenColors?: string[];
  },
): Promise<void> {
  await adminFetch(`/api/admin/products/${printifyId}`, token, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function adminUploadSizeGuideImage(
  token: string,
  printifyId: string,
  file: File,
): Promise<{ sizeGuideImage: string }> {
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(`/api/admin/products/${printifyId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<{ sizeGuideImage: string }>;
}

export async function adminUploadProductImage(
  token: string,
  printifyId: string,
  file: File,
  color?: string,
  isDefault?: boolean,
): Promise<{ image: { src: string; isDefault: boolean; variantIds: number[]; color?: string } }> {
  const form = new FormData();
  form.append('file', file);
  if (color) form.append('color', color);
  if (isDefault) form.append('isDefault', 'true');

  const res = await fetch(`/api/admin/products/${printifyId}/images`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<{ image: { src: string; isDefault: boolean; variantIds: number[]; color?: string } }>;
}

export async function adminUpdateProductImage(
  token: string,
  printifyId: string,
  storageKey: string,
  patch: { color?: string | null; isDefault?: boolean },
): Promise<{ images: Array<{ src: string; isDefault: boolean; variantIds: number[]; color?: string; storageKey?: string }> }> {
  return adminFetch(`/api/admin/products/${printifyId}/images`, token, {
    method: 'PATCH',
    body: JSON.stringify({ storageKey, ...patch }),
  });
}

export async function adminDeleteProductImage(
  token: string,
  printifyId: string,
  storageKey: string,
): Promise<void> {
  const res = await fetch(`/api/admin/products/${printifyId}/images?storageKey=${encodeURIComponent(storageKey)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
}

export async function adminCreateProduct(
  token: string,
  form: FormData,
): Promise<{ product: Product }> {
  const res = await fetch('/api/admin/products', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<{ product: Product }>;
}

export async function adminSyncProducts(
  token: string,
  body: { preview?: boolean; page?: number; limit?: number; finalize?: boolean; syncedPrintifyIds?: string[] } = {},
): Promise<{
  success: boolean;
  preview?: boolean;
  productsFound?: number;
  productsSynced?: number;
  productsUnchanged?: number;
  productsNew?: number;
  productsUpdated?: number;
  productsRemoved?: number;
  errors?: string[];
  currentPage?: number;
  lastPage?: number;
  hasMore?: boolean;
  syncedPrintifyIds?: string[];
  seenPrintifyIds?: string[];
  finalized?: boolean;
  reenabled?: number;
  hidden?: number;
  newProducts?: Array<{ printifyId: string; title: string }>;
  updatedProducts?: Array<{ printifyId: string; title: string }>;
  removedProducts?: Array<{ printifyId: string; title: string }>;
}> {
  return adminFetch('/api/admin/sync-products', token, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function adminGetSettings(token: string): Promise<Record<string, string>> {
  const data = await adminFetch<{ settings: Record<string, string> }>('/api/admin/settings', token);
  return data.settings;
}

export async function adminUpdateSettings(
  token: string,
  settings: Record<string, string>,
): Promise<void> {
  await adminFetch('/api/admin/settings', token, {
    method: 'PATCH',
    body: JSON.stringify(settings),
  });
}

export async function adminFetchLogs(token: string): Promise<{
  syncLogs: SyncLogRow[];
  webhookLogs: WebhookLogRow[];
  printifyLogs: PrintifyLogRow[];
}> {
  return adminFetch('/api/admin/logs', token);
}

export async function adminFetchDiscountCodes(token: string): Promise<DiscountCode[]> {
  const data = await adminFetch<{ discountCodes: DiscountCode[] }>('/api/admin/discount-codes', token);
  return data.discountCodes;
}

export async function adminCreateDiscountCode(
  token: string,
  data: DiscountCodeInput,
): Promise<DiscountCode> {
  const response = await adminFetch<{ discountCode: DiscountCode }>('/api/admin/discount-codes', token, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return response.discountCode;
}

export async function adminUpdateDiscountCode(
  token: string,
  id: string,
  data: DiscountCodeInput,
): Promise<DiscountCode> {
  const response = await adminFetch<{ discountCode: DiscountCode }>(`/api/admin/discount-codes/${id}`, token, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return response.discountCode;
}

export async function adminDeleteDiscountCode(token: string, id: string): Promise<void> {
  await adminFetch(`/api/admin/discount-codes/${id}`, token, {
    method: 'DELETE',
  });
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
