import { apiGet, apiSend, getAccessToken } from "./client";
import { cachedGet } from "../offline";
import { API_BASE_URL } from "../config/env";

/** Чаты (`/api/chats`, `/api/autoservice/chats`). Типы — ручные, источник истины — openapi.json. */

export interface ChatLastMessage {
  id: number;
  chat_id: number;
  sender_id: number;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface ChatListItem {
  id: number;
  chat_type: string;
  buyer_id?: number | null;
  seller_id?: number | null;
  title?: string | null;
  organization_id?: string | null;
  organization_name?: string | null;
  organization_logo?: string | null;
  buyer_name?: string | null;
  buyer_avatar_url?: string | null;
  last_message?: ChatLastMessage | null;
  last_message_text?: string | null;
  unread_count: number;
  participants_count?: number;
  autoservice_client_id?: number | null;
  autoservice_booking_id?: number | null;
  autoservice_repair_order_id?: number | null;
  autoservice_context_label?: string | null;
  is_group?: boolean;
  can_manage?: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: number;
  chat_id: number;
  sender_id: number;
  message: string;
  is_read: boolean;
  reply_to_id?: number | null;
  reply_to?: { id: number; message: string; sender_id: number; created_at: string } | null;
  sender_name?: string | null;
  media?: unknown[];
  created_at: string;
}

export interface AutoserviceChatClient {
  id: number;
  name: string;
  phone: string;
  user_id?: number | null;
}

export interface ChatBookingBrief {
  id: number;
  preferred_date: string;
  preferred_time?: string | null;
  status: string;
  name: string;
  vehicle_label?: string | null;
  source: string;
  created_at: string;
}

export interface ChatOrderBrief {
  id: number;
  order_number?: string | null;
  status: string;
  scheduled_at?: string | null;
  scheduled_end_at?: string | null;
  vehicle_label?: string | null;
  created_at: string;
}

export interface ChatClientTopics {
  client: AutoserviceChatClient;
  bookings: ChatBookingBrief[];
  orders: ChatOrderBrief[];
}

export function isAutoserviceChat(chat: ChatListItem): boolean {
  return chat.chat_type === "autoservice" || Boolean(chat.autoservice_client_id);
}

export function fetchUserChats() {
  return cachedGet<{ chats: ChatListItem[]; total: number }>("/chats/?skip=0&limit=100");
}

export function fetchAutoserviceChats() {
  return apiGet<ChatListItem[]>("/autoservice/chats/");
}

export function fetchChatMessages(chatId: number) {
  return apiGet<ChatMessage[]>(`/chats/${chatId}/messages?skip=0&limit=100`);
}

export function sendChatMessage(chatId: number, senderId: number, message: string) {
  return apiSend<ChatMessage>("POST", `/chats/${chatId}/messages`, {
    body: { chat_id: chatId, sender_id: senderId, message },
  });
}

export function openClientAutoserviceChat(organizationId?: string | null) {
  const qs = organizationId ? `?organization_id=${encodeURIComponent(organizationId)}` : "";
  return apiSend<ChatListItem>("POST", `/autoservice/chats/open${qs}`);
}

export function searchChatClients(query: string) {
  return apiGet<AutoserviceChatClient[]>(
    `/autoservice/chats/clients?q=${encodeURIComponent(query)}&limit=50`,
  );
}

export function fetchChatClientTopics(clientId: number) {
  return apiGet<ChatClientTopics>(`/autoservice/chats/clients/${clientId}/topics`);
}

export function openAutoserviceClientChat(payload: {
  clientId?: number | null;
  bookingId?: number | null;
  repairOrderId?: number | null;
}) {
  return apiSend<ChatListItem>("POST", "/autoservice/chats/open-for-client", {
    body: {
      client_id: payload.clientId ?? null,
      booking_id: payload.bookingId ?? null,
      repair_order_id: payload.repairOrderId ?? null,
    },
  });
}

/** WebSocket URL чатов: API_BASE_URL оканчивается на /server/api → ws-база /server. */
export function chatWsUrl(userId: number, token: string): string {
  const base = API_BASE_URL.replace(/\/api\/?$/, "")
    .replace(/^http:\/\//, "ws://")
    .replace(/^https:\/\//, "wss://");
  return `${base}/ws/chat/${userId}?token=${encodeURIComponent(token)}`;
}

export function currentAccessToken(): string | null {
  return getAccessToken();
}
