import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  connectWebSocket,
  disconnectWebSocket,
  subscribeToPushNotifications,
  setCurrentChat,
  fetchUserChats,
  deleteCustomChat,
  fetchChatMessages,
  sendWebSocketMessage,
  sendChatMedia,
  addOptimisticMessage,
  setReplyToMessage,
} from '../../redux/slices/ChatSlice';
import { fetchAvitoMessengerEnabled, setSelectedAvitoChatId, fetchAvitoMessages, fetchAvitoChatDetail, sendAvitoMessage, fetchAvitoChats, fetchAvitoChatProductLink } from '../../redux/slices/AvitoChatSlice';
import MediaLightbox from './MediaLightbox';
import ReplyPreview from './ReplyPreview';
import SwipeableMessage from './SwipeableMessage';
import ReplyArrow from './ReplyArrow';
import { API_BASE } from '../../utils/apiClient';
import UserAvatar from '../../components/UserAvatar/UserAvatar';
import ChatParticipantsPanel from './ChatParticipantsPanel';
import CreateGroupChatModal from './CreateGroupChatModal';
import { getGarageCounterpartyProfilePath } from '../../utils/publicProfile';

const formatTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
};

function formatListDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  if (date >= startOfToday) {
    return formatTime(dateString);
  }
  if (date >= startOfYesterday) {
    return 'Вчера';
  }
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  }
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: '2-digit' });
}

function getChatSearchHaystack(chat, source, avitoUserId, currentUserId) {
  const isAvito = source === 'avito';
  const isOrganization = source === 'organization';
  const isSellers = source === 'sellers';
  const isGroupSource = isOrganization || isSellers;

  const title = isAvito
    ? (() => {
        const mine = avitoUserId != null ? String(avitoUserId) : '';
        const others = (chat.participants || []).filter((p) => p.id && p.id !== mine);
        return others.map((p) => p.name).filter(Boolean).join(' ') || chat.title || '';
      })()
    : isGroupSource
      ? (chat.title || chat.organization_name || '')
      : (currentUserId === chat.seller_id
          ? (chat.buyer_name || '')
          : (chat.seller_name || chat.seller_organization || ''));

  return [
    title,
    chat.organization_name,
    chat.product_name,
    chat.context_title,
    chat.last_message_text,
    chat.last_message?.message,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function isGroupGarageChat(chat) {
  return chat?.is_group || (chat?.chat_type && chat.chat_type !== 'direct');
}

function getGarageChatListSource(chat) {
  const type = chat?.chat_type || (chat?.is_group ? 'organization' : 'direct');
  if (type === 'direct') return 'garage';
  if (type === 'sellers') return 'sellers';
  if (type === 'organization' || type === 'custom') return 'organization';
  return 'organization';
}

function isGarageGroupSource(source) {
  return source === 'organization' || source === 'sellers';
}

function SourceBadge({ source, className = '' }) {
  const isAvito = source === 'avito';
  const isOrganization = source === 'organization';
  const isSellers = source === 'sellers';
  const label = isAvito
    ? 'Авито'
    : isSellers
      ? 'Продавцы'
      : isOrganization
        ? 'Организация'
        : 'Гараж';
  const badgeClass = isAvito
    ? 'bg-[#fff3e0] text-[#e65100]'
    : isSellers
      ? 'bg-amber-50 text-amber-800'
      : isOrganization
        ? 'bg-emerald-50 text-emerald-700'
        : 'bg-indigo-50 text-indigo-700';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${className} ${badgeClass}`}
    >
      {!isOrganization && (
        <img
          src={isAvito ? '/logos/avito.png' : '/logos/svoygarage.png'}
          alt=""
          className="h-3 w-3 object-contain"
        />
      )}
      {label}
    </span>
  );
}

function ChatEmptyState({ icon, title, subtitle, action }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 ring-1 ring-gray-200/80">
        {icon}
      </div>
      <p className="mb-1 font-medium text-gray-800">{title}</p>
      {subtitle ? <p className="max-w-xs text-sm text-gray-500">{subtitle}</p> : null}
      {action}
    </div>
  );
}

function ChatPanelHeader({ onBack, avatar, title, subtitle, subtitleAction, badge, trailing, pinned = false }) {
  return (
    <div
      className={`flex-shrink-0 border-b border-gray-200/80 bg-white px-3 py-3 sm:px-4 lg:bg-white/95 lg:backdrop-blur-sm ${
        pinned
          ? 'max-lg:sticky max-lg:top-0 max-lg:z-20 max-lg:pt-[max(0px,env(safe-area-inset-top))] max-lg:shadow-sm'
          : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="-ml-1 flex-shrink-0 rounded-full p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 lg:hidden"
          aria-label="Назад к списку"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        {avatar}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-semibold text-gray-900">{title}</h3>
            {badge}
          </div>
          {subtitle ? (
            subtitleAction ? (
              <button
                type="button"
                onClick={subtitleAction}
                className="truncate text-left text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
              >
                {subtitle}
              </button>
            ) : (
              <p className="truncate text-xs text-gray-500">{subtitle}</p>
            )
          ) : null}
        </div>
        {trailing}
      </div>
    </div>
  );
}

const ChatsHubPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useSelector((state) => state.auth);
  const { chats: garageChats, currentChat, loading: garageLoading, error: garageError } = useSelector((state) => state.chats);
  const { 
    chats: avitoChats, 
    selectedChatId: selectedAvitoChatId,
    enabled: avitoEnabled,
    avitoUserId,
    loading: avitoLoading,
    messages: avitoMessages,
    chatDetail: avitoChatDetail,
    chatDetailLoading: avitoChatDetailLoading,
    sending: avitoSending,
  } = useSelector((state) => state.avitoChats);
  
  const avitoChatId = searchParams.get('avitoChatId');
  const activeChatSource = searchParams.get('source');
  const activeChatId = searchParams.get('chatId');
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [createChatOpen, setCreateChatOpen] = useState(false);

  const canCreateGroupChat = Boolean(user?.is_director || user?.is_admin);

  const hasSellersChat = (garageChats || []).some((c) => getGarageChatListSource(c) === 'sellers');
  const showOrganizationFilter = Boolean(
    user?.organization_id || (garageChats || []).some((c) => getGarageChatListSource(c) === 'organization'),
  );
  const showSellersFilter = Boolean(user?.is_seller || hasSellersChat);

  // Подключаем WebSocket и push-уведомления при загрузке
  useEffect(() => {
    if (!user?.id) return;
    dispatch(connectWebSocket(user.id));
    dispatch(subscribeToPushNotifications({ prompt: true }));

    return () => {
      dispatch(disconnectWebSocket());
    };
  }, [dispatch, user?.id]);

  useEffect(() => {
    if (!user) return;
    dispatch(fetchAvitoMessengerEnabled());
  }, [dispatch, user]);

  // Загружаем чаты Свой Гараж с обработкой ошибок
  useEffect(() => {
    if (!user) return;
    
    const loadChats = async () => {
      try {
        await dispatch(fetchUserChats({}));
      } catch (error) {
        console.error('Ошибка загрузки чатов:', error);
      }
    };
    
    loadChats();
  }, [dispatch, user]);

  // Загружаем чаты Авито если интеграция включена
  useEffect(() => {
    if (!user?.organization_id || !avitoEnabled) return;
    dispatch(fetchAvitoChats());
  }, [dispatch, user?.organization_id, avitoEnabled]);

  // Fetch product links for Avito chats
  useEffect(() => {
    if (avitoChats.length > 0) {
      avitoChats.forEach(chat => {
        if (!chat.linked_product_id && chat.id) {
          dispatch(fetchAvitoChatProductLink(chat.id));
        }
      });
    }
  }, [avitoChats.length, dispatch]);

  // Объединяем чаты из обоих источников и сортируем по дате последнего сообщения
  const unifiedChats = useMemo(() => {
    const garage = (garageChats || [])
      .filter((chat) => getGarageChatListSource(chat) === 'garage')
      .map(chat => ({
        ...chat,
        _source: 'garage',
        _lastMessageAt: chat.last_message?.created_at || chat.created_at || '',
      }));

    const organization = (garageChats || [])
      .filter((chat) => getGarageChatListSource(chat) === 'organization')
      .map(chat => ({
        ...chat,
        _source: 'organization',
        _lastMessageAt: chat.last_message?.created_at || chat.created_at || '',
      }));

    const sellers = (garageChats || [])
      .filter((chat) => getGarageChatListSource(chat) === 'sellers')
      .map(chat => ({
        ...chat,
        _source: 'sellers',
        _lastMessageAt: chat.last_message?.created_at || chat.created_at || '',
      }));
    
    const avito = avitoEnabled
      ? (avitoChats || []).map(chat => ({
        ...chat,
        _source: 'avito',
        _lastMessageAt: chat.last_message_created_at || '',
      }))
      : [];
    
    return [...garage, ...organization, ...sellers, ...avito].sort((a, b) => {
      const dateA = new Date(a._lastMessageAt);
      const dateB = new Date(b._lastMessageAt);
      return dateB - dateA;
    });
  }, [garageChats, avitoChats, avitoEnabled]);

  const chatCounts = useMemo(() => ({
    all: unifiedChats.length,
    garage: unifiedChats.filter((c) => c._source === 'garage').length,
    organization: unifiedChats.filter((c) => c._source === 'organization').length,
    sellers: unifiedChats.filter((c) => c._source === 'sellers').length,
    avito: unifiedChats.filter((c) => c._source === 'avito').length,
  }), [unifiedChats]);

  const filteredChats = useMemo(() => {
    let list = unifiedChats;
    if (sourceFilter === 'garage') {
      list = list.filter((c) => c._source === 'garage');
    } else if (sourceFilter === 'organization') {
      list = list.filter((c) => c._source === 'organization');
    } else if (sourceFilter === 'sellers') {
      list = list.filter((c) => c._source === 'sellers');
    } else if (sourceFilter === 'avito') {
      list = list.filter((c) => c._source === 'avito');
    }
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((chat) => getChatSearchHaystack(
      chat,
      chat._source,
      avitoUserId,
      user?.id,
    ).includes(q));
  }, [unifiedChats, sourceFilter, searchQuery, avitoUserId, user?.id]);

  const sourceFilters = useMemo(() => {
    const items = [
      { id: 'all', label: 'Все', count: chatCounts.all },
      { id: 'garage', label: 'Гараж', count: chatCounts.garage },
    ];
    if (showOrganizationFilter) {
      items.push({ id: 'organization', label: 'Организация', count: chatCounts.organization });
    }
    if (showSellersFilter) {
      items.push({ id: 'sellers', label: 'Продавцы', count: chatCounts.sellers });
    }
    if (avitoEnabled) {
      items.push({ id: 'avito', label: 'Авито', count: chatCounts.avito });
    }
    return items;
  }, [chatCounts, avitoEnabled, showOrganizationFilter, showSellersFilter]);

  useEffect(() => {
    if (sourceFilter === 'avito' && !avitoEnabled) {
      setSourceFilter('all');
    }
    if (sourceFilter === 'organization' && !showOrganizationFilter) {
      setSourceFilter('all');
    }
    if (sourceFilter === 'sellers' && !showSellersFilter) {
      setSourceFilter('all');
    }
  }, [sourceFilter, avitoEnabled, showOrganizationFilter, showSellersFilter]);

  useEffect(() => {
    if (activeChatSource === 'avito' && !avitoEnabled) {
      const next = new URLSearchParams(searchParams);
      next.set('source', 'garage');
      next.delete('avitoChatId');
      setSearchParams(next, { replace: true });
    }
    if (activeChatSource === 'organization' && !showOrganizationFilter) {
      const next = new URLSearchParams(searchParams);
      next.set('source', 'garage');
      setSearchParams(next, { replace: true });
    }
    if (activeChatSource === 'sellers' && !showSellersFilter) {
      const next = new URLSearchParams(searchParams);
      next.set('source', 'garage');
      setSearchParams(next, { replace: true });
    }
  }, [activeChatSource, avitoEnabled, showOrganizationFilter, showSellersFilter, searchParams, setSearchParams]);

  const handleSelectChat = useCallback((chat) => {
    const source = chat._source;
    const next = new URLSearchParams(searchParams);
    next.set('source', source);
    next.set('chatId', String(chat.id));
    
    if (source === 'avito') {
      next.set('avitoChatId', String(chat.id));
      dispatch(setSelectedAvitoChatId(chat.id));
    } else {
      next.delete('avitoChatId');
      dispatch(setCurrentChat(chat));
    }
    
    setSearchParams(next);
  }, [dispatch, searchParams, setSearchParams]);

  const handleBackToList = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('source');
    next.delete('chatId');
    next.delete('avitoChatId');
    setSearchParams(next);
    dispatch(setCurrentChat(null));
    dispatch(setSelectedAvitoChatId(null));
  }, [dispatch, searchParams, setSearchParams]);

  // Определяем активный чат
  const isAvitoActive = activeChatSource === 'avito';
  const activeGarageChat = activeChatId
    ? garageChats.find((c) => String(c.id) === activeChatId)
    : null;
  const isGroupChatActive = isGarageGroupSource(activeChatSource)
    || (activeChatSource !== 'avito' && activeChatSource !== 'garage' && isGroupGarageChat(activeGarageChat));
  const selectedGarageChat = activeChatId && !isAvitoActive && !isGroupChatActive
    ? garageChats.find((c) => String(c.id) === activeChatId && getGarageChatListSource(c) === 'garage')
    : null;
  const selectedGroupChat = activeChatId && isGroupChatActive
    ? garageChats.find((c) => String(c.id) === activeChatId && isGarageGroupSource(getGarageChatListSource(c)))
    : null;
  const selectedAvitoChatObj = isAvitoActive && activeChatId
    ? avitoChats.find(c => String(c.id) === activeChatId)
    : null;

  const handleChatCreated = useCallback(
    (chat) => {
      dispatch(fetchUserChats({}));
      if (chat?.id) {
        const next = new URLSearchParams(searchParams);
        next.set('source', 'organization');
        next.set('chatId', String(chat.id));
        setSearchParams(next);
      }
    },
    [dispatch, searchParams, setSearchParams]
  );

  return (
    <div className="mx-auto flex h-full w-full max-w-7xl min-h-0 flex-col md:h-full md:overflow-hidden">
      <CreateGroupChatModal
        isOpen={createChatOpen}
        onClose={() => setCreateChatOpen(false)}
        onCreated={handleChatCreated}
        user={user}
      />

      <div className="flex min-h-0 w-full flex-1 flex-col max-md:h-full max-md:pb-[max(0.25rem,env(safe-area-inset-bottom,0px))] md:h-0 md:overflow-hidden">
        <div className="flex min-h-0 w-full flex-1 flex-row overflow-hidden bg-white max-md:h-full md:h-full md:max-h-full md:rounded-2xl md:border md:border-gray-200/80 md:shadow-lg md:shadow-gray-200/50">
          {/* Левая панель — список чатов */}
          <div
            className={`${
              activeChatId ? 'hidden lg:flex' : 'flex'
            } min-h-0 w-full min-w-0 flex-col overflow-hidden border-gray-200/80 bg-white md:h-full md:max-h-full md:w-[22rem] lg:w-96 md:border-r`}
          >
            <div className="flex-shrink-0 border-b border-gray-100 bg-white px-3 pb-3 pt-3 sm:px-4">
              {canCreateGroupChat ? (
                <button
                  type="button"
                  onClick={() => setCreateChatOpen(true)}
                  className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 py-2.5 text-sm font-semibold text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-50"
                >
                  <span className="text-lg leading-none">+</span>
                  Создать чат
                </button>
              ) : null}
              {(garageLoading || avitoLoading) && (
                <div className="mb-3 flex justify-end lg:hidden">
                  <span className="text-xs text-gray-400">Обновление…</span>
                </div>
              )}
              <div className="relative">
                <svg
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск по имени или товару"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <div className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {sourceFilters.map((item) => {
                  const active = sourceFilter === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSourceFilter(item.id)}
                      className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                        active
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {item.label}
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-white/20' : 'bg-white text-gray-500'}`}>
                        {item.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
              {(garageLoading || avitoLoading) && filteredChats.length === 0 ? (
                <div className="flex h-64 items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                    <p className="text-sm text-gray-500">Загрузка чатов…</p>
                  </div>
                </div>
              ) : garageError ? (
                <ChatEmptyState
                  icon={(
                    <svg className="h-10 w-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  )}
                  title="Не удалось загрузить чаты"
                  subtitle={garageError}
                  action={(
                    <button
                      type="button"
                      onClick={() => dispatch(fetchUserChats({}))}
                      className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
                    >
                      Повторить
                    </button>
                  )}
                />
              ) : filteredChats.length === 0 ? (
                <ChatEmptyState
                  icon={(
                    <svg className="h-10 w-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  )}
                  title={searchQuery.trim() ? 'Ничего не найдено' : 'Пока нет диалогов'}
                  subtitle={
                    searchQuery.trim()
                      ? 'Попробуйте другой запрос или сбросьте фильтр'
                      : 'Здесь появятся сообщения от покупателей и с площадок'
                  }
                  action={
                    searchQuery.trim() ? (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                      >
                        Очистить поиск
                      </button>
                    ) : null
                  }
                />
              ) : (
                <div className="divide-y divide-gray-100/80">
                  {filteredChats.map((chat) => {
                    const source = chat._source;
                    const isAvito = source === 'avito';
                    const isSelected = isAvito
                      ? String(chat.id) === String(selectedAvitoChatId)
                      : String(chat.id) === String(activeChatId);

                    return (
                      <UnifiedChatListRow
                        key={`${source}-${chat.id}`}
                        chat={chat}
                        source={source}
                        isSelected={isSelected}
                        avitoUserId={avitoUserId}
                        currentUserId={user?.id}
                        onSelect={() => handleSelectChat(chat)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Правая панель — активный чат */}
          <div
            className={`${
              activeChatId ? 'flex' : 'hidden lg:flex'
            } min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#eef2f6] md:h-full md:max-h-full`}
          >
            {activeChatId ? (
              isAvitoActive ? (
                <AvitoChatPanel
                  chat={selectedAvitoChatObj}
                  chatId={activeChatId}
                  avitoUserId={avitoUserId}
                  onBack={handleBackToList}
                />
              ) : (
                <GarageChatPanel
                  chat={isGroupChatActive ? selectedGroupChat : selectedGarageChat}
                  chatId={activeChatId}
                  isGroupChat={isGroupChatActive}
                  onBack={handleBackToList}
                  onChatDeleted={handleBackToList}
                />
              )
            ) : (
              <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-gradient-to-b from-[#eef2f6] to-[#e8edf3] p-6">
                <div className="max-w-sm text-center">
                  <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-3xl bg-white shadow-md ring-1 ring-gray-200/60">
                    <svg className="h-12 w-12 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <p className="text-lg font-semibold text-gray-800">Выберите диалог</p>
                  <p className="mt-2 text-sm leading-relaxed text-gray-500">
                    Слева — все переписки. Откройте чат, чтобы ответить покупателю или посмотреть историю.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Универсальный компонент строки чата
function UnifiedChatListRow({ chat, source, isSelected, avitoUserId, currentUserId, onSelect }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const isAvito = source === 'avito';
  const isOrganization = source === 'organization';
  const isSellers = source === 'sellers';
  const isGroupRow = isOrganization || isSellers;

  const counterpartyAvatar = !isAvito && !isGroupRow
    ? (currentUserId === chat.seller_id ? chat.buyer_avatar_url : chat.seller_avatar_url)
    : null;

  const img = isAvito
    ? (chat.context_image_url || chat.avatar_url)
    : isGroupRow
      ? chat.product_photo_url
      : (counterpartyAvatar || chat.product_photo_url);
  
  const title = isAvito
    ? (() => {
        const mine = avitoUserId != null ? String(avitoUserId) : '';
        const others = (chat.participants || []).filter((p) => p.id && p.id !== mine);
        const joined = others.map((p) => p.name).filter(Boolean).join(', ');
        return joined || chat.title || 'Чат';
      })()
    : isGroupRow
      ? (chat.title || chat.organization_name || (isSellers ? 'Чат продавцов' : 'Чат организации'))
      : (currentUserId === chat.seller_id 
          ? (chat.buyer_name || 'Покупатель')
          : (chat.seller_name || chat.seller_organization || 'Продавец'));

  const lastMessageText = isAvito
    ? (chat.last_message_text || 'Нет сообщений')
    : (chat.last_message?.message || '');

  const lastMessageTime = isAvito
    ? chat.last_message_created_at
    : chat.last_message?.created_at;

  const lastMessageIsMine = isAvito
    ? chat.last_message_is_mine
    : (chat.last_message?.sender_id === currentUserId);

  const placeholderLetter = (title && title.charAt(0).toUpperCase()) || 'Ч';

  // Handler for photo click - navigate to product
  const handlePhotoClick = async (e) => {
    e.stopPropagation();
    if (isGroupRow) return;
    
    if (isAvito) {
      // For Avito: check if product is linked
      if (chat.linked_product_id) {
        // Already have the link - navigate directly
        navigate(`/part/${chat.linked_product_id}`);
      } else if (chat.context_url) {
        // Try to fetch product link first
        try {
          const linkData = await dispatch(fetchAvitoChatProductLink(chat.id)).unwrap();
          if (linkData?.linked && linkData?.product_id) {
            // Product is linked - navigate to it
            navigate(`/part/${linkData.product_id}`);
          } else {
            // No link - open ProductNotFound page in new tab
            const encodedUrl = encodeURIComponent(chat.context_url);
            window.open(`/product-not-found?avitoUrl=${encodedUrl}`, '_blank');
          }
        } catch (error) {
          // Error fetching link - open ProductNotFound page
          const encodedUrl = encodeURIComponent(chat.context_url);
          window.open(`/product-not-found?avitoUrl=${encodedUrl}`, '_blank');
        }
      }
    } else {
      // For Свой Гараж: navigate to internal product
      if (chat.product_id) {
        navigate(`/part/${chat.product_id}`);
      }
    }
  };

  // Handler for source icon click
  const handleSourceIconClick = (e) => {
    e.stopPropagation();
    if (isGroupRow) return;
    
    if (isAvito) {
      // Avito icon: always open external URL
      if (chat.context_url) {
        window.open(chat.context_url, '_blank', 'noopener,noreferrer');
      }
    } else {
      // Свой Гараж icon: navigate to internal product
      if (chat.product_id) {
        navigate(`/part/${chat.product_id}`);
      }
    }
  };

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative w-full px-3 py-3.5 text-left transition-colors sm:px-4 ${
        isSelected
          ? 'bg-indigo-50/90 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-indigo-600'
          : 'hover:bg-gray-50/90'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`relative flex-shrink-0 ${isGroupRow ? '' : 'cursor-pointer'}`}
          onClick={isGroupRow ? undefined : handlePhotoClick}
          title={isGroupRow ? undefined : 'Перейти к товару'}
        >
          {img ? (
            <img
              src={img}
              alt=""
              className="h-12 w-12 rounded-2xl object-cover ring-2 ring-white shadow-sm transition-all group-hover:ring-indigo-200"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-lg font-semibold text-white shadow-sm ring-2 ring-white">
              {placeholderLetter}
            </div>
          )}
          <span
            className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow ring-1 ring-gray-200"
            onClick={isGroupRow ? undefined : handleSourceIconClick}
            title={isAvito ? 'Открыть на Авито' : isSellers ? 'Продавцы' : isOrganization ? 'Организация' : 'Перейти к товару'}
          >
            {isSellers ? (
              <span className="text-[9px] font-bold text-amber-700">П</span>
            ) : isOrganization ? (
              <span className="text-[9px] font-bold text-emerald-700">О</span>
            ) : (
              <img
                src={isAvito ? '/logos/avito.png' : '/logos/svoygarage.png'}
                alt=""
                className="h-3.5 w-3.5 object-contain"
              />
            )}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className={`truncate text-[15px] ${Number(chat.unread_count) > 0 ? 'font-bold text-gray-900' : 'font-semibold text-gray-900'}`}>
                {title}
              </h3>
              {!isAvito && !isGroupRow && chat.product_name && (
                <p className="truncate text-xs text-gray-500">{chat.product_name}</p>
              )}
              {isGroupRow && chat.participants_count > 0 && (
                <p className="truncate text-xs text-gray-500">{chat.participants_count} участников</p>
              )}
              {isAvito && chat.context_title && (
                <p className="truncate text-xs text-gray-500">{chat.context_title}</p>
              )}
            </div>
            {lastMessageTime && (
              <span className="flex-shrink-0 text-[11px] text-gray-400">
                {formatListDate(lastMessageTime)}
              </span>
            )}
          </div>

          {lastMessageText && (
            <div className="flex items-center gap-1.5">
              {lastMessageIsMine && (
                <svg className="h-3.5 w-3.5 flex-shrink-0 text-indigo-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
              )}
              <p className={`truncate text-sm ${Number(chat.unread_count) > 0 ? 'font-medium text-gray-800' : 'text-gray-500'}`}>
                {lastMessageIsMine ? `Вы: ${lastMessageText}` : lastMessageText}
              </p>
            </div>
          )}
        </div>

        {Number(chat.unread_count) > 0 && (
          <span className="mt-1 flex h-5 min-w-[20px] flex-shrink-0 items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[11px] font-bold text-white">
            {chat.unread_count > 99 ? '99+' : chat.unread_count}
          </span>
        )}
      </div>
    </button>
  );
}

// Панель чата Свой Гараж - полноценная реализация
function GarageChatPanel({ chat, chatId, isGroupChat = false, onBack, onChatDeleted }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const { messages, currentChat, wsConnected } = useSelector((state) => state.chats);
  const replyToMessage = useSelector(state => state.chats.replyToMessage);
  const [newMessage, setNewMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesScrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const messageInputRef = useRef(null);
  const prevMessagesCountRef = useRef(0);
  
  // Media Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxMediaIndex, setLightboxMediaIndex] = useState(0);

  // Загружаем сообщения при открытии чата
  useEffect(() => {
    if (chatId) {
      dispatch(setCurrentChat(chat));
      dispatch(fetchChatMessages({ chatId: parseInt(chatId) }));
    }
  }, [dispatch, chatId, chat]);

  useEffect(() => {
    setShowParticipants(false);
  }, [chatId]);

  // Автоскролл к последнему сообщению
  useEffect(() => {
    if (messages.length > prevMessagesCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: messages.length === prevMessagesCountRef.current + 1 ? 'smooth' : 'auto' });
    }
    prevMessagesCountRef.current = messages.length;
  }, [messages]);

  // Polling если WS не подключен
  useEffect(() => {
    if (!chatId || wsConnected) return;
    const interval = setInterval(() => {
      dispatch(fetchChatMessages({ chatId: parseInt(chatId) }));
    }, 3000);
    return () => clearInterval(interval);
  }, [chatId, wsConnected, dispatch]);

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if ((!newMessage.trim() && selectedFiles.length === 0) || !chatId || !user) return;

    if (selectedFiles.length > 0) {
      // Отправка медиа
      setUploading(true);
      try {
        await dispatch(sendChatMedia({
          chatId: parseInt(chatId),
          files: selectedFiles,
          message: newMessage.trim()
        }));
        setSelectedFiles([]);
        setNewMessage('');
      } catch (error) {
        console.error('Ошибка отправки медиа:', error);
      } finally {
        setUploading(false);
      }
      return;
    }

    // Отправка текстового сообщения
    dispatch(addOptimisticMessage({
      chatId: parseInt(chatId),
      message: newMessage.trim(),
      senderId: user.id,
      reply_to_id: replyToMessage?.id || null,
      reply_to: replyToMessage ? {
        id: replyToMessage.id,
        message: replyToMessage.message,
        sender_id: replyToMessage.sender_id,
        created_at: replyToMessage.created_at
      } : null
    }));

    dispatch(sendWebSocketMessage(
      parseInt(chatId),
      user.id,
      newMessage.trim(),
      replyToMessage?.id || null
    ));

    // Очищаем ответ и поле ввода
    setNewMessage('');
    dispatch(setReplyToMessage(null));
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length + selectedFiles.length > 5) {
      alert('Максимум 5 файлов');
      return;
    }
    setSelectedFiles([...selectedFiles, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Обработка ответа на сообщение
  const handleReply = (message) => {
    dispatch(setReplyToMessage(message));
    messageInputRef.current?.focus();
  };

  const formatMessageTime = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 86400000 && date.getDate() === now.getDate()) {
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    if (diff < 172800000) return 'Вчера';
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  // Получаем все медиа из всех сообщений чата
  const allChatMedia = useMemo(() => {
    const mediaList = [];
    const token = localStorage.getItem('token');
    
    messages.forEach(message => {
      if (message.media && message.media.length > 0) {
        message.media.forEach(mediaItem => {
          if (mediaItem.media_type === 'image' || mediaItem.media_type === 'video') {
            mediaList.push({
              id: mediaItem.id,
              messageId: message.id,
              url: `${API_BASE}/chats/media/${mediaItem.id}?token=${encodeURIComponent(token)}`,
              media_type: mediaItem.media_type,
              original_filename: mediaItem.original_filename,
            });
          }
        });
      }
    });
    
    return mediaList;
  }, [messages]);

  // Открыть lightbox с конкретным медиа
  const openMediaLightbox = (mediaId) => {
    const index = allChatMedia.findIndex(m => m.id === mediaId);
    if (index !== -1) {
      setLightboxMediaIndex(index);
      setLightboxOpen(true);
    }
  };

  // Получаем имя автора ответа
  const getReplyAuthorLabel = (replyTo) => {
    if (!replyTo || !user?.id || !chat) return 'Сообщение';
    const sid = replyTo.sender_id;
    if (sid === user.id) return 'Вы';
    if (sid === chat.seller_id) {
      return chat.seller_name || chat.seller_organization || 'Продавец';
    }
    if (sid === chat.buyer_id) {
      return chat.buyer_name || 'Покупатель';
    }
    return 'Собеседник';
  };

  const handleReplyJump = useCallback((replyToId) => {
    if (replyToId == null || replyToId === '') return;
    const sid = String(replyToId);
    const root = messagesScrollRef.current;
    const element = root?.querySelector(`[data-message-row-id="${CSS.escape(sid)}"]`);
    if (!element) return;

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const dimAfterMs = 280;
    const dimHoldMs = 420;
    const transitionMs = 320;
    window.setTimeout(() => {
      element.classList.add('transition-[filter]', 'duration-300', 'brightness-75');
    }, dimAfterMs);
    window.setTimeout(() => {
      element.classList.remove('brightness-75');
    }, dimAfterMs + dimHoldMs);
    window.setTimeout(() => {
      element.classList.remove('transition-[filter]', 'duration-300');
    }, dimAfterMs + dimHoldMs + transitionMs);
  }, []);

  const title = isGroupChat
    ? (chat?.title || chat?.organization_name || 'Чат организации')
    : (user?.id === chat?.seller_id 
        ? (chat?.buyer_name || 'Покупатель')
        : (chat?.seller_name || chat?.seller_organization || 'Продавец'));

  const panelSubtitle = isGroupChat
    ? (chat?.participants_count ? `${chat.participants_count} участников` : null)
    : (chat?.product_name ? `${chat.product_name}${chat.product_article ? ` · ${chat.product_article}` : ''}` : null);

  const counterpartyAvatar = !isGroupChat
    ? (user?.id === chat?.seller_id ? chat?.buyer_avatar_url : chat?.seller_avatar_url)
    : null;

  const openProduct = () => {
    if (chat?.product_id) {
      navigate(`/part/${chat.product_id}`);
    }
  };

  const counterpartyProfilePath = !isGroupChat
    ? getGarageCounterpartyProfilePath(chat, user?.id)
    : null;

  const handleDeleteChat = async () => {
    if (!chat?.can_delete || !chatId) return;
    if (!window.confirm('Удалить этот чат? Сообщения будут недоступны.')) return;
    try {
      await dispatch(deleteCustomChat(parseInt(chatId, 10))).unwrap();
      onChatDeleted?.();
      onBack?.();
    } catch (e) {
      alert(typeof e === 'string' ? e : 'Не удалось удалить чат');
    }
  };

  const headerTrailing = (
    <div className="flex flex-shrink-0 items-center gap-2">
      {isGroupChat ? (
        <button
          type="button"
          onClick={() => setShowParticipants(true)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          Участники
        </button>
      ) : counterpartyProfilePath ? (
        <Link
          to={counterpartyProfilePath}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          Профиль
        </Link>
      ) : null}
      {!isGroupChat && chat?.product_id ? (
        <button
          type="button"
          onClick={openProduct}
          className="hidden rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 sm:inline-flex"
        >
          К товару
        </button>
      ) : null}
      {chat?.can_delete ? (
        <button
          type="button"
          onClick={handleDeleteChat}
          className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
        >
          Удалить
        </button>
      ) : null}
    </div>
  );

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#eef2f6] max-md:min-h-0 md:h-full">
      <ChatPanelHeader
        pinned
        onBack={onBack}
        avatar={
          isGroupChat ? (
            chat?.product_photo_url ? (
              <img
                src={chat.product_photo_url}
                alt=""
                className="h-11 w-11 rounded-2xl object-cover ring-2 ring-white shadow-sm flex-shrink-0"
              />
            ) : (
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-sm font-semibold text-white shadow-sm ring-2 ring-white">
                {(title && title.charAt(0).toUpperCase()) || 'Ч'}
              </div>
            )
          ) : counterpartyAvatar ? (
            <UserAvatar
              avatarUrl={counterpartyAvatar}
              firstName={user?.id === chat?.seller_id ? undefined : chat?.seller_name}
              lastName={user?.id === chat?.seller_id ? chat?.buyer_name : undefined}
              size="md"
              className="ring-2 ring-white shadow-sm"
            />
          ) : chat?.product_photo_url ? (
            <button type="button" onClick={openProduct} className="flex-shrink-0">
              <img
                src={chat.product_photo_url}
                alt=""
                className="h-11 w-11 rounded-2xl object-cover ring-2 ring-white shadow-sm"
              />
            </button>
          ) : (
            <UserAvatar
              avatarUrl={null}
              firstName={user?.id === chat?.seller_id ? chat?.buyer_name : chat?.seller_name}
              lastName=""
              size="md"
              className="ring-2 ring-white shadow-sm"
            />
          )
        }
        title={title}
        subtitle={panelSubtitle}
        subtitleAction={
          isGroupChat && chat?.participants_count
            ? () => setShowParticipants(true)
            : undefined
        }
        badge={<SourceBadge source={isGroupChat ? getGarageChatListSource(chat) : 'garage'} />}
        trailing={headerTrailing}
      />

      <ChatParticipantsPanel
        chatId={chatId ? parseInt(chatId, 10) : null}
        isOpen={isGroupChat && showParticipants}
        onClose={() => setShowParticipants(false)}
        canManage={Boolean(chat?.can_manage)}
        onChanged={() => dispatch(fetchUserChats({}))}
      />

      {/* Сообщения */}
      <div
        ref={messagesScrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-4 sm:px-4"
      >
        {messages.length === 0 ? (
          <div className="flex h-full min-h-[200px] items-center justify-center">
            <ChatEmptyState
              icon={(
                <svg className="h-10 w-10 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              )}
              title="Начните беседу"
              subtitle={isGroupChat ? 'Напишите первое сообщение в групповой чат' : 'Напишите первое сообщение покупателю или продавцу'}
            />
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((message) => {
              const isOwn = message.sender_id === user?.id;
              return (
                <div
                  key={message.id}
                  data-message-row-id={message.id}
                  className={`group flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <SwipeableMessage 
                    message={message} 
                    onReply={handleReply}
                    isOwn={isOwn}
                  >
                    <div
                      className={`flex items-center gap-1.5 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                      <div className="message-bubble relative min-w-0">
                        {!isOwn && isGroupChat && message.sender_name && (
                          <p className="text-xs text-gray-500 mb-0.5 px-1">{message.sender_name}</p>
                        )}
                        {/* Превью ответа с визуальной связью */}
                        {message.reply_to && (
                          <div className="relative">
                            {/* Вертикальная линия связи */}
                            <div className={`absolute top-2 bottom-2 w-[3px] rounded-full ${
                              isOwn ? 'bg-white/50' : 'bg-blue-400/70'
                            }`} style={{ left: '8px' }}></div>
                            
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReplyJump(message.reply_to_id ?? message.reply_to?.id);
                              }}
                              className={`block w-full text-left overflow-hidden pl-4 pr-3 py-2 ${
                                isOwn 
                                  ? 'bg-blue-700/70 hover:bg-blue-700/80 rounded-t-2xl' 
                                  : 'bg-blue-50 hover:bg-blue-100 rounded-t-2xl'
                              } transition-colors border-b ${isOwn ? 'border-white/20' : 'border-blue-100'}`}
                            >
                              <div className={`${isOwn ? 'text-blue-100' : 'text-gray-700'}`}>
                                <p className={`text-[11px] font-semibold uppercase tracking-wide ${isOwn ? 'text-blue-200' : 'text-blue-600'}`}>
                                  {getReplyAuthorLabel(message.reply_to)}
                                </p>
                                <p className={`text-xs truncate mt-0.5 ${isOwn ? 'text-blue-50/90' : 'text-gray-600'}`}>
                                  {(message.reply_to.message && String(message.reply_to.message).trim()) ||
                                  (message.reply_to.media && message.reply_to.media.length > 0 ? '📎 Медиа' : 'Сообщение')}
                                </p>
                              </div>
                            </button>
                          </div>
                        )}
                        
                        <div className={`max-w-xs sm:max-w-sm px-4 py-2.5 ${
                          message.reply_to
                            ? (isOwn 
                                ? 'bg-blue-600 text-white rounded-t-none rounded-bl-xl rounded-br-2xl' 
                                : 'bg-white text-gray-900 shadow-sm rounded-t-none rounded-br-xl rounded-bl-2xl border border-gray-100')
                            : (isOwn 
                                ? 'bg-indigo-600 text-white rounded-2xl rounded-br-md' 
                                : 'bg-white text-gray-900 shadow-sm rounded-2xl rounded-bl-md border border-gray-100/80')
                        }`}
                        data-message-bubble="true"
                        >
                        {message.message && <p className="text-sm break-words">{message.message}</p>}
                        {message.media && message.media.length > 0 && (
                          <div className="mt-2 space-y-2">
                            {message.media.map((mediaItem) => (
                              <div key={mediaItem.id}>
                                {mediaItem.media_type === 'image' && (
                                  <img 
                                    src={`${API_BASE}/chats/media/${mediaItem.id}?token=${encodeURIComponent(localStorage.getItem('token'))}`}
                                    alt="" 
                                    className="max-w-full rounded-lg max-h-64 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() => openMediaLightbox(mediaItem.id)}
                                  />
                                )}
                                {mediaItem.media_type === 'video' && (
                                  <video 
                                    controls 
                                    src={`${API_BASE}/chats/media/${mediaItem.id}?token=${encodeURIComponent(localStorage.getItem('token'))}`}
                                    className="max-w-full rounded-lg max-h-64 cursor-pointer"
                                    onClick={() => openMediaLightbox(mediaItem.id)}
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center justify-end mt-1.5 space-x-1">
                          <p className={`text-xs ${isOwn ? 'text-blue-100' : 'text-gray-500'}`}>
                            {formatMessageTime(message.created_at)}
                          </p>
                          {isOwn && (
                            <span className="flex-shrink-0">
                              {message.id?.toString().startsWith('temp_') ? (
                                // Отправляется
                                <svg className="w-4 h-4 text-blue-200 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              ) : message.media && message.media.some(m => m.is_processing) ? (
                                // Медиа обрабатывается
                                <svg className="w-4 h-4 text-blue-200 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              ) : message.is_read ? (
                                // Прочитано (двойная галочка)
                                <svg className="w-4 h-4 text-blue-200" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z"/>
                                </svg>
                              ) : (
                                // Доставлено (одна галочка)
                                <svg className="w-4 h-4 text-blue-200" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                                </svg>
                              )}
                            </span>
                          )}
                        </div>
                        </div>
                      </div>
                      <ReplyArrow
                        message={message}
                        onReply={handleReply}
                        isOwn={isOwn}
                      />
                    </div>
                  </SwipeableMessage>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Ввод сообщения */}
      <form
        onSubmit={handleSendMessage}
        className="flex-shrink-0 border-t border-gray-200/80 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] backdrop-blur-sm sm:p-4"
      >
        {/* Reply Preview */}
        {replyToMessage && (
          <div className="px-4 pt-3">
            <ReplyPreview 
              replyTo={replyToMessage} 
              onCancel={() => dispatch(setReplyToMessage(null))} 
            />
          </div>
        )}
        
        {selectedFiles.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {selectedFiles.map((file, idx) => (
              <div key={idx} className="relative">
                <span className="text-xs bg-gray-100 px-2 py-1 rounded">{file.name}</span>
                <button
                  type="button"
                  onClick={() => setSelectedFiles(selectedFiles.filter((_, i) => i !== idx))}
                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-1.5 focus-within:border-indigo-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-500/15">
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()} 
            disabled={uploading || selectedFiles.length >= 5}
            className="flex-shrink-0 rounded-xl p-2.5 text-gray-500 transition-colors hover:bg-white hover:text-indigo-600 disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          <input 
            ref={fileInputRef} 
            type="file" 
            multiple 
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.7z"
            onChange={handleFileSelect} 
            className="hidden" 
          />
          <input 
            ref={messageInputRef}
            type="text" 
            value={newMessage} 
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={selectedFiles.length > 0 ? 'Добавить комментарий…' : replyToMessage ? 'Ответить…' : 'Сообщение…'}
            className="min-w-0 flex-1 border-0 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-gray-400"
            disabled={uploading}
          />
          <button 
            type="submit" 
            disabled={(!newMessage.trim() && selectedFiles.length === 0) || uploading}
            className="flex-shrink-0 rounded-xl bg-indigo-600 p-2.5 text-white transition-colors hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-5 h-5 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
      </form>

      {/* Media Lightbox */}
      <MediaLightbox
        mediaItems={allChatMedia}
        currentIndex={lightboxMediaIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onIndexChange={setLightboxMediaIndex}
      />
    </div>
  );
}

// Панель чата Авито
function AvitoChatPanel({ chat, chatId, avitoUserId, onBack }) {
  const dispatch = useDispatch();
  const { messages, chatDetail, chatDetailLoading, sending } = useSelector((state) => state.avitoChats);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);
  
  // Media Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxMediaIndex, setLightboxMediaIndex] = useState(0);

  useEffect(() => {
    if (chatId) {
      dispatch(fetchAvitoMessages(chatId));
      dispatch(fetchAvitoChatDetail(chatId));
      // Fetch product link for this chat
      dispatch(fetchAvitoChatProductLink(chatId));
    }
  }, [dispatch, chatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!newMessage.trim() || !chatId) return;
    await dispatch(sendAvitoMessage({ chatId, message: newMessage.trim() }));
    setNewMessage('');
  };

  // Получаем все медиа из всех сообщений чата Avito
  const allAvitoMedia = useMemo(() => {
    const mediaList = [];
    
    messages.forEach(message => {
      const urls = Array.isArray(message.image_urls) && message.image_urls.length > 0
        ? message.image_urls
        : message.image_url ? [message.image_url] : [];
      
      // Добавляем изображения
      urls.forEach((url, idx) => {
        mediaList.push({
          id: `${message.id}_image_${idx}`,
          messageId: message.id,
          url: url,
          media_type: 'image',
          original_filename: message.message || 'Изображение',
        });
      });
      
      // Добавляем голосовые сообщения (если нужно)
      if (message.voice_url) {
        mediaList.push({
          id: `${message.id}_voice`,
          messageId: message.id,
          url: message.voice_url,
          media_type: 'voice',
          original_filename: 'Голосовое сообщение',
        });
      }
    });
    
    return mediaList;
  }, [messages]);

  // Открыть lightbox с конкретным медиа
  const openAvitoMediaLightbox = (mediaId) => {
    const index = allAvitoMedia.findIndex(m => m.id === mediaId);
    if (index !== -1) {
      setLightboxMediaIndex(index);
      setLightboxOpen(true);
    }
  };

  const displayChat = chatDetail && String(chatDetail.id) === String(chatId) ? chatDetail : chat;
  const title = (() => {
    const mine = avitoUserId != null ? String(avitoUserId) : '';
    const others = (displayChat?.participants || []).filter((p) => p.id && p.id !== mine);
    const joined = others.map((p) => p.name).filter(Boolean).join(', ');
    return joined || displayChat?.title || 'Чат';
  })();

  const renderMessageBubble = (message) => {
    const isOwn = Boolean(message?.is_outgoing);
    const mt = String(message.message_type || 'text').toLowerCase();
    const urls = Array.isArray(message.image_urls) && message.image_urls.length > 0
      ? message.image_urls
      : message.image_url ? [message.image_url] : [];
    const showText = Boolean(String(message.message || '').trim());

    return (
      <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2`}>
        <div className="max-w-[85%] sm:max-w-md">
          {!isOwn && message.sender_name && (
            <p className="text-xs text-gray-500 mb-0.5 px-1">{message.sender_name}</p>
          )}
          <div className={`px-4 py-2.5 rounded-2xl ${
            isOwn
              ? 'bg-indigo-600 text-white rounded-br-md'
              : 'bg-white text-gray-900 shadow-sm rounded-bl-md border border-gray-100/80'
          }`}>
            {urls.length > 0 && (
              <div className="flex flex-col gap-2 mb-1">
                {urls.map((src, idx) => {
                  const mediaId = `${message.id}_image_${idx}`;
                  return (
                    <img 
                      key={src} 
                      src={src} 
                      alt="" 
                      className="max-w-full rounded-lg max-h-64 object-contain bg-black/5 cursor-pointer hover:opacity-90 transition-opacity" 
                      onClick={() => openAvitoMediaLightbox(mediaId)}
                    />
                  );
                })}
              </div>
            )}
            {message.voice_url ? (
              <audio 
                controls 
                src={message.voice_url} 
                className={`w-full max-w-xs my-1 ${isOwn ? 'opacity-95' : ''}`} 
              />
            ) : null}
            {(mt === 'image' || mt === 'voice' || mt === 'file') && !showText && urls.length === 0 && !message.voice_url ? (
              <p className={`text-sm ${isOwn ? 'text-blue-100' : 'text-gray-500'}`}>[вложение]</p>
            ) : null}
            {showText ? <p className="text-sm break-words">{message.message}</p> : null}
            <p className={`text-xs mt-1 ${isOwn ? 'text-blue-100' : 'text-gray-500'}`}>
              {formatTime(message.created_at)}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#eef2f6] max-md:min-h-0 md:h-full">
      <ChatPanelHeader
        pinned
        onBack={onBack}
        avatar={
          displayChat?.context_image_url || displayChat?.avatar_url ? (
            <img
              src={displayChat.context_image_url || displayChat.avatar_url}
              alt=""
              className="h-11 w-11 flex-shrink-0 rounded-2xl object-cover ring-2 ring-white shadow-sm"
            />
          ) : (
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-sm font-semibold text-white shadow-sm ring-2 ring-white">
              {(title && title.charAt(0).toUpperCase()) || 'Ч'}
            </div>
          )
        }
        title={title}
        subtitle={displayChat?.context_title ? [displayChat.context_title, displayChat.context_price].filter(Boolean).join(' · ') : null}
        badge={<SourceBadge source="avito" />}
        trailing={
          displayChat?.context_url ? (
            <a
              href={displayChat.context_url}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 sm:inline-flex"
            >
              На Авито
            </a>
          ) : null
        }
      />

      {chatDetailLoading && (
        <p className="flex-shrink-0 border-b border-gray-100 bg-white/80 px-4 py-1.5 text-xs text-gray-400">
          Обновление…
        </p>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-4 sm:px-4">
        {messages.length === 0 ? (
          <div className="flex h-full min-h-[200px] items-center justify-center">
            <ChatEmptyState
              icon={(
                <svg className="h-10 w-10 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              )}
              title="Нет сообщений"
              subtitle="История переписки с Авито появится здесь"
            />
          </div>
        ) : (
          messages.map(renderMessageBubble)
        )}
        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={handleSendMessage}
        className="flex-shrink-0 border-t border-gray-200/80 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] backdrop-blur-sm sm:p-4"
      >
        <div className="flex items-end gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-1.5 focus-within:border-indigo-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-500/15">
          <input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Сообщение…"
            className="min-w-0 flex-1 border-0 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-gray-400"
          />
          <button
            type="submit"
            disabled={sending || !newMessage.trim()}
            className="flex-shrink-0 rounded-xl bg-indigo-600 p-2.5 text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {sending ? (
              <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="h-5 w-5 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
      </form>

      {/* Media Lightbox */}
      <MediaLightbox
        mediaItems={allAvitoMedia}
        currentIndex={lightboxMediaIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onIndexChange={setLightboxMediaIndex}
        chatInfo={{
          isAvito: true,
          linkedProductId: displayChat?.linked_product_id || null,
          contextUrl: displayChat?.context_url || null,
        }}
      />
    </div>
  );
}

export default ChatsHubPage;
