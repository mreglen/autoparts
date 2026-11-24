import { queryClient } from "../api/queryClient";
import { apiGet, getAccessToken } from "../api/client";
import { chatWsUrl } from "../api/chats";

/** WebSocket `/ws/chat/{user_id}`: realtime сообщений чатов.
 *  При событиях инвалидирует React Query — списки и открытые треды обновляются сами. */

const PING_INTERVAL_MS = 30_000;
const PONG_TIMEOUT_MS = 70_000;
const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY_MS = 1_000;

type WsEvent = { type?: string; chat_id?: number; message_ids?: number[] };

let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let reconnectAttempts = 0;
let lastPongAt = 0;
let activeUserId: number | null = null;
let stopped = false;

function invalidateChatQueries(chatId?: number) {
  void queryClient.invalidateQueries({ queryKey: ["chats"] });
  void queryClient.invalidateQueries({ queryKey: ["chat-unread-count"] });
  if (chatId != null) {
    void queryClient.invalidateQueries({ queryKey: ["chat-messages", chatId] });
  }
}

function handleEvent(data: WsEvent) {
  if (data.type === "message" || data.type === "messages_read") {
    invalidateChatQueries(data.chat_id);
  } else if (data.type === "pong") {
    lastPongAt = Date.now();
  }
}

function stopPing() {
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
}

function startPing() {
  stopPing();
  pingTimer = setInterval(() => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    if (lastPongAt && Date.now() - lastPongAt > PONG_TIMEOUT_MS) {
      try {
        socket.close();
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      socket.send(JSON.stringify({ type: "ping" }));
    } catch {
      /* ignore */
    }
  }, PING_INTERVAL_MS);
}

async function refreshTokenQuietly() {
  try {
    // Любой авторизованный запрос при 401 сам обновит access-токен.
    await apiGet("/chats/unread/count");
  } catch {
    /* ignore */
  }
}

function scheduleReconnect() {
  if (stopped || reconnectAttempts >= MAX_RECONNECT_ATTEMPTS || !activeUserId) {
    reconnectAttempts = 0;
    return;
  }
  const delay = Math.min(BASE_RECONNECT_DELAY_MS * 2 ** reconnectAttempts, 30_000);
  reconnectAttempts += 1;
  reconnectTimer = setTimeout(() => {
    void connect(activeUserId as number);
  }, delay);
}

export async function connect(userId: number): Promise<void> {
  if (!userId) return;
  if (socket && socket.readyState === WebSocket.OPEN && activeUserId === userId) return;
  disconnect();
  stopped = false;
  activeUserId = userId;

  // Access-токен мог протухнуть — лёгкий запрос обновит его при необходимости.
  await refreshTokenQuietly();
  const token = getAccessToken();
  if (!token || stopped || activeUserId !== userId) return;

  const ws = new WebSocket(chatWsUrl(userId, token));
  socket = ws;

  ws.onopen = () => {
    reconnectAttempts = 0;
    lastPongAt = Date.now();
    startPing();
  };

  ws.onmessage = (event) => {
    try {
      handleEvent(JSON.parse(String(event.data)) as WsEvent);
    } catch {
      /* ignore */
    }
  };

  ws.onclose = (event) => {
    if (socket === ws) socket = null;
    stopPing();
    if (stopped || activeUserId !== userId) return;
    if (event.code === 1000) {
      reconnectAttempts = 0;
      return;
    }
    if (event.code === 1008) {
      // Невалидный/протухший токен — обновляем и пробуем ещё раз без backoff-эскалации.
      reconnectAttempts = 0;
      void refreshTokenQuietly().then(() => scheduleReconnect());
      return;
    }
    scheduleReconnect();
  };

  ws.onerror = () => {
    try {
      ws.close();
    } catch {
      /* ignore */
    }
  };
}

export function disconnect(): void {
  stopped = true;
  activeUserId = null;
  reconnectAttempts = 0;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  stopPing();
  const ws = socket;
  socket = null;
  if (ws) {
    try {
      ws.close();
    } catch {
      /* ignore */
    }
  }
}

/** Переподключение после возврата приложения из фона / смены сети. */
export function reconnectIfNeeded(): void {
  if (activeUserId && !stopped) {
    void connect(activeUserId);
  }
}
