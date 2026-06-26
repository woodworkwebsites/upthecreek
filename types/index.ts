// ─── Printify ─────────────────────────────────────────────────────────────────

export type PrintifyMode = 'dry_run' | 'draft' | 'live';

export interface PrintifyProductImage {
  src: string;
  isDefault: boolean;
  variantIds: number[];
  color?: string;
}

export interface PrintifyVariant {
  id: number;
  color: string;
  size: string;
  price: number;   // pence
  available: boolean;
}

export interface PrintifyColor {
  name: string;
  hex: string;
}

// ─── D1 Row types (snake_case matching column names) ─────────────────────────

export interface ProductRow {
  id: string;
  printify_id: string;
  title: string;
  description: string;
  category: string;
  images: string;     // JSON
  variants: string;   // JSON
  colors: string;     // JSON
  sizes: string;      // JSON
  min_price: number;
  max_price: number;
  is_enabled: number;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface OrderRow {
  id: string;
  stripe_session_id: string;
  stripe_payment_intent: string | null;
  customer_email: string;
  customer_name: string | null;
  amount_total: number;
  currency: string;
  status: OrderStatus;
  printify_mode: PrintifyMode;
  printify_order_id: string | null;
  printify_payload: string | null;   // JSON
  printify_response: string | null;  // JSON
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  printify_id: string;
  variant_id: number;
  title: string;
  color: string;
  size: string;
  quantity: number;
  unit_price: number;
  created_at: string;
}

export interface SyncLogRow {
  id: string;
  status: 'success' | 'error';
  products_synced: number | null;
  message: string | null;
  created_at: string;
}

export interface WebhookLogRow {
  id: string;
  event_type: string;
  stripe_session_id: string | null;
  status: 'received' | 'processed' | 'ignored' | 'error';
  payload: string | null;
  error: string | null;
  created_at: string;
}

export interface PrintifyLogRow {
  id: string;
  order_id: string | null;
  mode: PrintifyMode;
  action: string;
  status: 'success' | 'error';
  payload: string | null;
  response: string | null;
  error: string | null;
  created_at: string;
}

// ─── Domain types (parsed) ───────────────────────────────────────────────────

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'fulfillment_started'
  | 'fulfilled'
  | 'failed';

export interface Product {
  id: string;
  printifyId: string;
  title: string;
  description: string;
  category: string;
  images: PrintifyProductImage[];
  variants: PrintifyVariant[];
  colors: PrintifyColor[];
  sizes: string[];
  minPrice: number;
  maxPrice: number;
  isEnabled: boolean;
  syncedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: string;
  stripeSessionId: string;
  stripePaymentIntent: string | null;
  customerEmail: string;
  customerName: string | null;
  amountTotal: number;
  currency: string;
  status: OrderStatus;
  printifyMode: PrintifyMode;
  printifyOrderId: string | null;
  printifyPayload: unknown | null;
  printifyResponse: unknown | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  orderId: string;
  printifyId: string;
  variantId: number;
  title: string;
  color: string;
  size: string;
  quantity: number;
  unitPrice: number;
  createdAt: string;
}

// ─── API request/response shapes ─────────────────────────────────────────────

export interface CheckoutItem {
  printifyId: string;
  variantId: number;
  quantity: number;
}

export interface BasketItem extends CheckoutItem {
  id: string;
  title: string;
  color: string;
  size: string;
  unitPrice: number;
  imageSrc: string;
}

export interface CheckoutRequest {
  items: CheckoutItem[];
}

export interface CheckoutResponse {
  url: string;
}

export interface PrintifyOrderPayload {
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

export interface TestPayloadRequest {
  printifyId: string;
  variantId: number;
  quantity: number;
  address: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    country: string;
    address1: string;
    address2: string;
    city: string;
    zip: string;
  };
}

export interface TestOrderHandoffRequest {
  printifyId: string;
  variantId: number;
  quantity: number;
}

// ─── Raw Printify API types ───────────────────────────────────────────────────

export interface PrintifyApiProduct {
  id: string;
  title: string;
  description: string;
  blueprint_id: number;
  print_provider_id: number;
  is_enabled?: boolean;
  options: Array<{
    name: string;
    type: string;
    values: Array<{
      id: number;
      title: string;
      colors?: string[];
    }>;
  }>;
  variants: Array<{
    id: number;
    title: string;
    price: number;
    is_enabled: boolean;
    is_available: boolean;
    options: number[];
  }>;
  images: Array<{
    src: string;
    is_default: boolean;
    is_selected_for_publishing: boolean;
    variant_ids: number[];
  }>;
}

export interface PrintifyApiResponse<T> {
  data?: T;
  error?: string;
}

export interface ApiError {
  error: string;
  status?: number;
}
