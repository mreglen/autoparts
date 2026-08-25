export function getGarageChatUnreadCount(chat, currentUserId) {
  if (!chat) return 0;
  const count = Number(chat.unread_count);
  if (Number.isFinite(count) && count > 0) return count;
  const last = chat.last_message;
  if (last && !last.is_read && last.sender_id !== currentUserId) return 1;
  return 0;
}

export function getAvitoChatUnreadCount(chat) {
  if (!chat) return 0;
  const count = Number(chat.unread_count);
  if (Number.isFinite(count) && count > 0) return count;
  if (chat.has_unread_messages) return 1;
  return 0;
}

/** Unified list row (garage / avito / org / sellers). */
export function getUnifiedChatUnreadCount(chat, currentUserId) {
  if (!chat) return 0;
  if (chat._source === 'avito') return getAvitoChatUnreadCount(chat);
  return getGarageChatUnreadCount(chat, currentUserId);
}

export function selectTotalUnreadCount(state) {
  const userId = state.auth?.user?.id;
  const garageTotal = (state.chats?.chats || []).reduce(
    (sum, chat) => sum + getGarageChatUnreadCount(chat, userId),
    0,
  );
  const avitoTotal = (state.avitoChats?.chats || []).reduce(
    (sum, chat) => sum + getAvitoChatUnreadCount(chat),
    0,
  );
  return garageTotal + avitoTotal;
}
