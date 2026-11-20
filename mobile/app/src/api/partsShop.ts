import { apiGet, apiSend } from "./client";

/** Покупка новых запчастей для клиента (скрытый поставщик — только buyer-цены). */

export const SHOP_SEARCH_DEFAULTS = {
  delivery_id: "000000001",
  address_id: 176458,
} as const;

export const DEFAULT_BUYER_MARKUP_PERCENT = 30;

export interface ShopStock {
  id?: string | number;
  stock_id?: string;
  price?: number | string;
  count?: number | string;
  available_count?: number;
  deliveryStart?: string;
  deliveryEnd?: string;
  delivery_start?: string;
  delivery_end?: string;
  description?: string | null;
  is_preferred?: boolean;
}

export interface ShopPart {
  guid?: string;
  brand?: string;
  partnumber?: string;
  article?: string;
  name?: string;
  description?: string | null;
  crosses?: { Part?: ShopPart | ShopPart[] };
  stocks?: { stock?: ShopStock | ShopStock[] };
}

export interface ShopSearchResponse {
  PartsList?: { Part?: ShopPart | ShopPart[] };
}

export interface ShopCartItem {
  id: number;
  brand?: string | null;
  partnumber?: string | null;
  name?: string | null;
  delivery?: string | null;
  delivery_start?: string | null;
  delivery_end?: string | null;
  quantity: number;
  max_quantity?: number | null;
  price?: number | null;
  purchase_price?: number | null;
  supplier_unit_price?: number | null;
  stock_id?: string | null;
  warehouse_name?: string | null;
  basket_id?: number | null;
  available?: boolean;
  preferred_warehouse?: boolean;
}

export interface ShopBasket {
  id: number;
  name: string;
  is_default: boolean;
  items: ShopCartItem[];
  item_count: number;
  total_price: number;
}

export interface ShopCartResponse {
  id: number;
  new_parts_baskets: ShopBasket[];
  new_parts_items: ShopCartItem[];
}

export interface AddShopCartItemPayload {
  brand: string;
  partnumber: string;
  name?: string;
  quantity: number;
  price: number;
  supplier_unit_price?: number;
  stock_id: string;
  max_quantity?: number;
  guid?: string;
  delivery_start?: string;
  delivery_end?: string;
  basket_id?: number;
}

export interface CheckoutConfig {
  allow_unpaid_checkout?: boolean;
  configured?: boolean;
  contact_name?: string;
  contact_phone?: string;
}

export interface SiteDeliveryOption {
  id?: number;
  region_id?: number | null;
  region_name?: string | null;
  delivery_type?: string;
  carrier?: string | null;
  pickup_point?: string | null;
  min_order_amount?: number | string | null;
  enabled?: boolean;
}

export interface ShopPaymentSession {
  session_id: string;
  status: string;
  amount: number;
  currency?: string;
  expires_at?: string | null;
  garage_order_id?: number | null;
  qr_payload?: string | null;
  card_confirmation_url?: string | null;
  sbp_payment_status?: string | null;
  card_payment_status?: string | null;
  refund_status?: string | null;
}

export interface ShopOrderPayload {
  recipient_name: string;
  recipient_phone: string;
  recipient_email?: string;
  delivery_type: "pickup";
  pickup_address?: string | null;
  delivery_region_id?: number | null;
  delivery_region_name?: string | null;
  delivery_option_id?: number | null;
  comment?: string | null;
  deliver_in_parts?: boolean;
  basket_id?: number;
}

export interface PurchaseNewOrderItem {
  id: number;
  name: string;
  brand?: string | null;
  partnumber?: string | null;
  quantity: number;
  price: number;
  status_code: string;
}

export interface PurchaseNewOrder {
  id: number;
  organization_id?: string;
  organization_name?: string | null;
  buyer_name?: string;
  delivery_type?: string;
  delivery_address?: string | null;
  transport_company?: string | null;
  pickup_address?: string | null;
  delivery_region_id?: number | null;
  delivery_region_name?: string | null;
  total_amount: number;
  is_paid: boolean;
  status_code: string;
  created_at?: string;
  pickup_code?: string | null;
  pickup_qr_payload?: string | null;
  items: PurchaseNewOrderItem[];
}

export interface PurchaseUsedOrderItem {
  id: number;
  name: string;
  brand?: string | null;
  partnumber?: string | null;
  quantity: number;
  price: number;
  status_code: string;
}

export interface PurchaseUsedOrder {
  id: number;
  organization_id?: string;
  organization_name?: string | null;
  buyer_name?: string;
  delivery_type?: string;
  delivery_address?: string | null;
  transport_company?: string | null;
  pickup_address?: string | null;
  total_amount: number;
  is_paid: boolean;
  status_code: string;
  created_at?: string;
  pickup_code?: string | null;
  pickup_qr_payload?: string | null;
  items: PurchaseUsedOrderItem[];
}

export function fetchShopSiteConfig() {
  return apiGet<{ new_parts_markup_percent?: number }>(
    "/auth/public-site-config",
    { auth: false },
  );
}

export function searchShopParts(text: string) {
  return apiSend<ShopSearchResponse>("POST", "/rossko/GetSearch", {
    body: { text, ...SHOP_SEARCH_DEFAULTS },
    auth: false,
  });
}

export function fetchShopCart() {
  return apiGet<ShopCartResponse>("/cart/");
}

export function addShopPartToCart(payload: AddShopCartItemPayload) {
  return apiSend<ShopCartItem>("POST", "/cart/new-parts", { body: payload });
}

export function updateShopCartItemQty(itemId: number, quantity: number) {
  return apiSend<ShopCartItem>(
    "PUT",
    `/cart/new-parts/${itemId}/quantity`,
    { body: { quantity } },
  );
}

export function removeShopCartItem(itemId: number) {
  return apiSend<void>("DELETE", `/cart/new-parts/${itemId}`);
}

export function fetchShopCheckoutConfig() {
  return apiGet<CheckoutConfig>("/orders/new-parts/config");
}

export function fetchShopSiteDelivery() {
  return apiGet<SiteDeliveryOption[]>("/public/site-delivery", { auth: false });
}

export function fetchShopAdminOrgAddress() {
  return apiGet<{ address?: string }>("/cart/admin-org-address");
}

export function createShopPaymentSession(payload: ShopOrderPayload) {
  return apiSend<ShopPaymentSession>("POST", "/payments/new-parts/sessions", {
    body: payload,
  });
}

export function fetchShopPaymentSession(sessionId: string) {
  return apiGet<ShopPaymentSession>(
    `/payments/new-parts/sessions/${sessionId}`,
  );
}

export function createShopCardPayment(sessionId: string) {
  return apiSend<{ confirmation_url?: string | null }>(
    "POST",
    `/payments/new-parts/sessions/${sessionId}/card`,
  );
}

export function createShopUnpaidOrder(payload: ShopOrderPayload) {
  return apiSend<{ ok: boolean; order_id: number; message?: string }>(
    "POST",
    "/orders/new-parts",
    { body: payload },
  );
}

export async function fetchPurchaseNewOrders(): Promise<PurchaseNewOrder[]> {
  const [rows, synced] = await Promise.all([
    apiGet<PurchaseNewOrder[]>("/sales/purchases/new-orders"),
    apiSend<PurchaseNewOrder[]>("POST", "/sales/purchases/new-orders/sync-supplier-status")
      .catch(() => null),
  ]);
  const data = Array.isArray(synced) ? synced : rows;
  return Array.isArray(data) ? data : [];
}

export function fetchPurchaseUsedOrders() {
  return apiGet<PurchaseUsedOrder[]>("/sales/purchases/used-orders");
}
