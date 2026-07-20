// ─── Product model ───────────────────────────────────────────────────────────

export type PrintifyMode = 'dry_run' | 'draft' | 'live';

export type FulfillmentProvider = 'printify' | 'manual';

export interface PrintifyProductImage {
  src: string;
  isDefault: boolean;
  variantIds: number[];
  color?: string;
  assetKind?: 'product-image';
  storageKey?: string;
  sourceUrl?: string;
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

export interface PricingMatrixRow {
  audience: string;
  product: string;
  garment: string;
  printSurface: string;
  manufacturingCost: string;
  saleCost: string;
  delivery: string;
  salePrice: string;
  partnerPrice: string;
}

// ─── D1 Row types (snake_case matching column names) ─────────────────────────

export interface ProductRow {
  id: string;
  printify_id: string;
  title: string;
  description: string;
  category: string;
  audience: string;
  product_type: string;
  garment: string;
  pricing_matrix: string; // JSON
  images: string;     // JSON
  variants: string;   // JSON
  colors: string;     // JSON
  hidden_colors: string; // JSON
  sizes: string;      // JSON
  min_price: number;
  max_price: number;
  is_enabled: number;
  size_guide_image: string | null;
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
  error: string | null;
  fulfillment_provider: FulfillmentProvider;
  external_order_ref: string | null;
  discount_code: string | null;
  discount_amount: number;
  shipping_name: string;
  shipping_phone: string;
  shipping_address1: string;
  shipping_address2: string;
  shipping_city: string;
  shipping_region: string;
  shipping_zip: string;
  shipping_country: string;
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

export type DiscountCodeKind = 'percent' | 'fixed';

export interface DiscountCodeRow {
  id: string;
  code: string;
  kind: DiscountCodeKind;
  value: number;
  usage_limit: number | null;
  usage_count: number;
  active: number;
  expires_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Domain types (parsed) ───────────────────────────────────────────────────

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'fulfillment_started'
  | 'awaiting_fulfillment'
  | 'fulfilled'
  | 'failed';

export interface Product {
  id: string;
  printifyId: string;
  title: string;
  description: string;
  category: string;
  audience: string;
  productType: string;
  garment: string;
  pricingMatrix: PricingMatrixRow | null;
  images: PrintifyProductImage[];
  variants: PrintifyVariant[];
  colors: PrintifyColor[];
  hiddenColors: string[];
  sizes: string[];
  minPrice: number;
  maxPrice: number;
  isEnabled: boolean;
  sizeGuideImage: string | null;
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
  error: string | null;
  fulfillmentProvider: FulfillmentProvider;
  externalOrderRef: string | null;
  discountCode: string | null;
  discountAmount: number;
  shippingName: string;
  shippingPhone: string;
  shippingAddress1: string;
  shippingAddress2: string;
  shippingCity: string;
  shippingRegion: string;
  shippingZip: string;
  shippingCountry: string;
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
  imageSrc?: string;
  createdAt: string;
}

export interface DiscountCode {
  id: string;
  code: string;
  kind: DiscountCodeKind;
  value: number;
  usageLimit: number | null;
  usageCount: number;
  active: boolean;
  expiresAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Partner {
  id: string;
  slug: string;
  name: string;
  discountCode: string | null;
  commissionRate: number;
  description: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerAdmin extends Partner {
  accessToken?: string;
}

export type PartnerCommissionStatus = 'pending' | 'paid' | 'void';

export interface PartnerCommissionRow {
  id: string;
  partner_id: string;
  order_id: string;
  order_status: OrderStatus;
  gross_sales: number;
  discount_amount: number;
  commission_rate: number;
  commission_amount: number;
  status: PartnerCommissionStatus;
  payout_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PartnerPayoutRow {
  id: string;
  partner_id: string;
  period_start: string | null;
  period_end: string | null;
  amount: number;
  reference: string | null;
  notes: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PartnerInput {
  slug: string;
  name: string;
  discountCode?: string | null;
  accessToken?: string;
  commissionRate: number;
  description?: string | null;
  active?: boolean;
}

export interface PartnerOrderSummary {
  id: string;
  orderId: string;
  status: OrderStatus;
  commissionStatus: PartnerCommissionStatus;
  customerEmail: string;
  customerName: string | null;
  amountTotal: number;
  currency: string;
  discountCode: string | null;
  discountAmount: number;
  commissionAmount: number;
  payoutId: string | null;
  fulfillmentProvider: FulfillmentProvider;
  externalOrderRef: string | null;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

export interface PartnerDashboard {
  partner: Partner;
  summary: {
    totalOrders: number;
    grossSales: number;
    netSales: number;
    discountTotal: number;
    commissionDue: number;
    commissionPaid: number;
    commissionPending: number;
  };
  recentOrders: PartnerOrderSummary[];
}

export interface PartnerLoginResponse {
  partner: Partner;
}

// ─── API request/response shapes ─────────────────────────────────────────────

export interface CheckoutItem {
  printifyId: string;
  variantId: number;
  quantity: number;
  color?: string;
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
  discountCode?: string | null;
}

export interface CheckoutResponse {
  url: string;
}

export interface DiscountCodePreview {
  id: string;
  code: string;
  kind: DiscountCodeKind;
  value: number;
  amount: number;
  subtotal: number;
  total: number;
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

export interface DiscountCodeInput {
  code: string;
  kind: DiscountCodeKind;
  value: number;
  usageLimit?: number | null;
  active?: boolean;
  expiresAt?: string | null;
  notes?: string | null;
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
