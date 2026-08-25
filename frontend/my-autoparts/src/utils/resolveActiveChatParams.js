/**
 * Resolve active chat from query (?chatId=) or path (/chats/:chatId).
 */
export function resolveActiveChatParams(pathname, searchParams, routeParams = {}) {
  const path = String(pathname || '');
  const pathMatch = path.match(/^\/chats\/([^/?#]+)$/);
  const pathChatId = pathMatch ? pathMatch[1] : null;
  const queryChatId = searchParams?.get?.('chatId') || null;
  const chatId = queryChatId || routeParams?.chatId || pathChatId || null;
  const source = searchParams?.get?.('source') || null;
  const avitoChatId = searchParams?.get?.('avitoChatId') || null;
  const isActiveChat = path.startsWith('/chats') && Boolean(chatId);

  return {
    chatId,
    source,
    avitoChatId,
    pathChatId,
    isActiveChat,
    needsPathCanonicalization: Boolean(pathChatId && !queryChatId),
  };
}

export function buildChatsQueryUrl({ chatId, source = 'garage', avitoChatId } = {}) {
  const params = new URLSearchParams();
  if (source) params.set('source', source);
  if (chatId != null) params.set('chatId', String(chatId));
  if (avitoChatId != null) params.set('avitoChatId', String(avitoChatId));
  const qs = params.toString();
  return qs ? `/chats?${qs}` : '/chats';
}
