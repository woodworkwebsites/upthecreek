import type { PrintifyApiProduct } from '../../types/index.js';

const BASE_URL = 'https://api.printify.com/v1';

async function printifyFetch<T>(
  token: string,
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'UpTheCreekPadel/1.0',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `Printify API error ${res.status} ${res.statusText}: ${body}`,
    );
  }

  return res.json() as Promise<T>;
}

export async function listProducts(
  token: string,
  shopId: string,
): Promise<PrintifyApiProduct[]> {
  const all: PrintifyApiProduct[] = [];
  let page = 1;

  while (true) {
    const response = await printifyFetch<{
      data: PrintifyApiProduct[];
      last_page: number;
      current_page: number;
    }>(token, `/shops/${shopId}/products.json?limit=50&page=${page}`);

    const items = response.data ?? [];
    all.push(...items);

    if (page >= (response.last_page ?? 1) || items.length === 0) break;
    page++;
  }

  return all;
}

export async function getProduct(
  token: string,
  shopId: string,
  productId: string,
): Promise<PrintifyApiProduct> {
  return printifyFetch<PrintifyApiProduct>(
    token,
    `/shops/${shopId}/products/${productId}.json`,
  );
}

export interface CreateOrderPayload {
  external_id: string;
  line_items: Array<{
    product_id: string;
    variant_id: number;
    quantity: number;
  }>;
  shipping_method: number;
  send_shipping_notification: boolean;
  address_to: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    country: string;
    region: string;
    address1: string;
    address2: string;
    city: string;
    zip: string;
  };
}

export interface PrintifyOrderResponse {
  id: string;
  status: string;
  [key: string]: unknown;
}

export async function createOrder(
  token: string,
  shopId: string,
  payload: CreateOrderPayload,
): Promise<PrintifyOrderResponse> {
  return printifyFetch<PrintifyOrderResponse>(
    token,
    `/shops/${shopId}/orders.json`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}
