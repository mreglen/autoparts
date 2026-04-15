import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import MobileBottomNav from '../../components/MobileBottomNav/MobileBottomNav';
import {
  connectWebSocket,
  disconnectWebSocket,
  subscribeToPushNotifications,
  setCurrentChat,
  fetchUserChats,
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

const formatTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
};

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
  const activeChatSource = searchParams.get('source'); // 'garage' или 'avito'
  const activeChatId = searchParams.get('chatId');

  // Подключаем WebSocket при загрузке
  useEffect(() => {
    if (!user?.id) return;
    dispatch(connectWebSocket(user.id));
    
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
    const garage = (garageChats || []).map(chat => ({
      ...chat,
      _source: 'garage',
      _lastMessageAt: chat.last_message?.created_at || chat.created_at || '',
    }));
    
    const avito = (avitoChats || []).map(chat => ({
      ...chat,
      _source: 'avito',
      _lastMessageAt: chat.last_message_created_at || '',
    }));
    
    // Сортируем по дате последнего сообщения (новые сверху)
    return [...garage, ...avito].sort((a, b) => {
      const dateA = new Date(a._lastMessageAt);
      const dateB = new Date(b._lastMessageAt);
      return dateB - dateA;
    });
  }, [garageChats, avitoChats]);

  const handleSelectChat = useCallback((chat) => {
    const isAvito = chat._source === 'avito';
    const next = new URLSearchParams(searchParams);
    next.set('source', isAvito ? 'avito' : 'garage');
    next.set('chatId', String(chat.id));
    
    if (isAvito) {
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
  const selectedGarageChat = !isAvitoActive && activeChatId 
    ? garageChats.find(c => String(c.id) === activeChatId)
    : null;
  const selectedAvitoChatObj = isAvitoActive && activeChatId
    ? avitoChats.find(c => String(c.id) === activeChatId)
    : null;

  return (
    <div className="max-md:fixed max-md:inset-0 max-md:z-[60] max-md:flex max-md:min-h-0 max-md:flex-col max-md:bg-white max-md:pt-[env(safe-area-inset-top,0px)] md:static md:z-auto md:min-h-0 md:inset-auto md:bg-transparent md:pt-0">
      <div className="flex min-h-0 w-full flex-1 flex-row bg-white max-md:min-h-0 max-md:pb-[env(safe-area-inset-bottom,0px)] md:h-[calc(100vh-200px)] md:overflow-hidden md:rounded-lg md:border md:border-gray-200 md:shadow-sm">
        {/* Левая панель - Список чатов */}
        <div
          className={`${
            activeChatId ? 'hidden md:flex' : 'flex'
          } min-h-0 w-full min-w-0 flex-col border-gray-200 md:w-96 md:border-r`}
        >
          <div className="flex flex-shrink-0 items-center border-b border-gray-200 bg-white px-4 py-3 md:hidden">
            <h1 className="text-lg font-semibold text-gray-900">Сообщения</h1>
          </div>

          {/* Список чатов */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
            {(garageLoading || avitoLoading) && unifiedChats.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm text-gray-500">Загрузка чатов...</p>
                </div>
              </div>
            ) : garageError ? (
              <div className="flex flex-col items-center justify-center h-full px-6 py-12">
                <div className="w-20 h-20 mb-4 rounded-full bg-red-100 flex items-center justify-center">
                  <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <p className="text-red-600 font-medium mb-1">Ошибка загрузки чатов</p>
                <p className="text-sm text-gray-500 text-center">{garageError}</p>
                <button 
                  onClick={() => dispatch(fetchUserChats({}))}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Повторить
                </button>
              </div>
            ) : unifiedChats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full px-6 py-12">
                <div className="w-20 h-20 mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-gray-600 font-medium mb-1">У вас пока нет сообщений</p>
                <p className="text-sm text-gray-500 text-center">Здесь будут отображаться ваши диалоги</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {unifiedChats.map((chat) => {
                  const isAvito = chat._source === 'avito';
                  const isSelected = isAvito
                    ? String(chat.id) === String(selectedAvitoChatId)
                    : String(chat.id) === String(activeChatId);
                  
                  return (
                    <UnifiedChatListRow
                      key={`${chat._source}-${chat.id}`}
                      chat={chat}
                      isAvito={isAvito}
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

        {/* Правая панель - Активный чат */}
        <div
          className={`${
            activeChatId ? 'flex' : 'hidden md:flex'
          } min-h-0 min-w-0 flex-1 flex-col`}
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
                chat={selectedGarageChat}
                chatId={activeChatId}
                onBack={handleBackToList}
              />
            )
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-gray-600 font-medium">Выберите чат</p>
                <p className="text-sm text-gray-500 mt-1">Начните беседу или продолжите существующую</p>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Мобильное нижнее меню - показывается только в списке чатов */}
      {!activeChatId && <MobileBottomNav />}
    </div>
  );
};

// Универсальный компонент строки чата
function UnifiedChatListRow({ chat, isAvito, isSelected, avitoUserId, currentUserId, onSelect }) {
  const navigate = useNavigate();
  const img = isAvito 
    ? (chat.context_image_url || chat.avatar_url)
    : chat.product_photo_url;
  
  const title = isAvito
    ? (() => {
        const mine = avitoUserId != null ? String(avitoUserId) : '';
        const others = (chat.participants || []).filter((p) => p.id && p.id !== mine);
        const joined = others.map((p) => p.name).filter(Boolean).join(', ');
        return joined || chat.title || 'Чат';
      })()
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
  const handlePhotoClick = (e) => {
    e.stopPropagation(); // Prevent chat selection
    
    if (isAvito) {
      // For Avito: check if product is linked
      if (chat.linked_product_id) {
        navigate(`/part/${chat.linked_product_id}`);
      } else if (chat.context_url) {
        window.open(chat.context_url, '_blank', 'noopener,noreferrer');
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
    e.stopPropagation(); // Prevent chat selection
    
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
      className={`w-full flex items-start gap-3 p-4 text-left transition-colors duration-150 ${
        isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
      }`}
    >
      {/* Аватар */}
      <div 
        className="flex-shrink-0 cursor-pointer" 
        onClick={handlePhotoClick}
        title="Перейти к товару"
      >
        {img ? (
          <img 
            src={img} 
            alt="" 
            className="w-14 h-14 rounded-lg object-cover ring-2 ring-gray-100 hover:ring-blue-300 transition-all" 
          />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold text-xl ring-2 ring-gray-100">
            {placeholderLetter}
          </div>
        )}
      </div>
      
      {/* Информация о чате */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h3 className="font-semibold truncate text-base text-gray-900">
            {title}
          </h3>
          {lastMessageTime && (
            <span className="text-xs text-gray-500 flex-shrink-0">
              {formatTime(lastMessageTime)}
            </span>
          )}
        </div>
        
        {!isAvito && chat.product_name && (
          <p className="text-xs text-gray-500 truncate mb-1.5">
            {chat.product_name}
          </p>
        )}
        
        {isAvito && chat.context_title && (
          <p className="text-xs text-gray-500 truncate mb-1.5">
            {chat.context_title}
          </p>
        )}
        
        {lastMessageText && (
          <div className="flex items-center gap-1.5">
            {lastMessageIsMine && (
              <span className="flex-shrink-0">
                <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
              </span>
            )}
            <p className="text-sm text-gray-600 truncate">
              {lastMessageIsMine && 'Вы: '}
              {lastMessageText}
            </p>
          </div>
        )}
      </div>
      
      {/* Счётчик непрочитанных */}
      {Number(chat.unread_count) > 0 && (
        <span className="ml-2 px-2.5 py-1 bg-blue-600 text-white text-xs font-bold rounded-full flex-shrink-0 min-w-[20px] text-center">
          {chat.unread_count}
        </span>
      )}
      
      {/* Иконка источника чата */}
      <div 
        className="flex-shrink-0 flex flex-col items-center justify-center ml-2 cursor-pointer hover:opacity-70 transition-opacity"
        onClick={handleSourceIconClick}
        title={isAvito ? 'Открыть на Авито' : 'Перейти к товару'}
      >
        <img 
          src={isAvito ? '/logos/avito.png' : '/logos/svoygarage.png'} 
          alt={isAvito ? 'Авито' : 'Свой Гараж'} 
          className="w-6 h-6 object-contain" 
        />
      </div>
    </button>
  );
}

// Панель чата Свой Гараж - полноценная реализация
function GarageChatPanel({ chat, chatId, onBack }) {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { messages, currentChat, wsConnected } = useSelector((state) => state.chats);
  const replyToMessage = useSelector(state => state.chats.replyToMessage);
  const [newMessage, setNewMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
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

  const title = user?.id === chat?.seller_id 
    ? (chat?.buyer_name || 'Покупатель')
    : (chat?.seller_name || chat?.seller_organization || 'Продавец');

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* Шапка чата */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-white p-4 pb-3 shadow-sm max-md:pt-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="text-gray-600 hover:text-gray-900 transition-colors flex-shrink-0"
            aria-label="Назад к списку"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          {chat?.product_photo_url ? (
            <img 
              src={chat.product_photo_url}
              alt={chat?.product_name || 'Товар'}
              className="w-11 h-11 rounded-lg object-cover flex-shrink-0 ring-2 ring-gray-100"
            />
          ) : (
            <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold flex-shrink-0 ring-2 ring-gray-100">
              {(title && title.charAt(0).toUpperCase()) || 'Ч'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{title}</h3>
            {chat?.product_name ? (
              <p className="text-xs text-gray-500 truncate">{chat.product_name}{chat.product_article ? ` - ${chat.product_article}` : ''}</p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Сообщения */}
      <div
        ref={messagesScrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-gray-50 p-4"
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-gray-600 font-medium">Начните беседу!</p>
            </div>
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
                                ? 'bg-blue-600 text-white rounded-2xl rounded-br-md' 
                                : 'bg-white text-gray-900 shadow-sm rounded-2xl rounded-bl-md border border-gray-100')
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
        className="flex-shrink-0 border-t border-gray-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
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
        <div className="flex items-center gap-2">
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()} 
            disabled={uploading || selectedFiles.length >= 5}
            className="p-2.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors disabled:opacity-50"
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
            placeholder={selectedFiles.length > 0 ? "Добавить комментарий..." : replyToMessage ? "Ответить..." : "Введите сообщение..."}
            className="flex-1 min-w-0 px-4 py-2.5 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            disabled={uploading}
          />
          <button 
            type="submit" 
            disabled={(!newMessage.trim() && selectedFiles.length === 0) || uploading}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
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
          <div className={`px-4 py-2 rounded-2xl ${
            isOwn
              ? 'bg-blue-600 text-white rounded-br-md'
              : 'bg-white text-gray-900 shadow-sm rounded-bl-md border border-gray-100'
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
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* Шапка чата */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-white p-4 pb-3 shadow-sm max-md:pt-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="text-gray-600 hover:text-gray-900 transition-colors flex-shrink-0"
            aria-label="Назад к списку"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          {displayChat?.context_image_url || displayChat?.avatar_url ? (
            <img
              src={displayChat.context_image_url || displayChat.avatar_url}
              alt=""
              className="w-11 h-11 rounded-lg object-cover flex-shrink-0 ring-2 ring-gray-100"
            />
          ) : (
            <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold flex-shrink-0 ring-2 ring-gray-100">
              {(title && title.charAt(0).toUpperCase()) || 'Ч'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{title}</h3>
            {displayChat?.context_title ? (
              <p className="text-xs text-gray-500 truncate">{[displayChat.context_title, displayChat.context_price].filter(Boolean).join(' — ')}</p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Сообщения */}
      {chatDetailLoading && (
        <p className="flex-shrink-0 border-b border-gray-100 bg-white px-4 py-1 text-xs text-gray-400">
          Обновление…
        </p>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-gray-50 p-4">
        {messages.map(renderMessageBubble)}
        <div ref={messagesEndRef} />
      </div>

      {/* Ввод сообщения */}
      <form
        onSubmit={handleSendMessage}
        className="flex flex-shrink-0 items-center gap-2 border-t border-gray-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))]"
      >
        <input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Введите сообщение..."
          className="flex-1 min-w-0 px-4 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        />
        <button
          type="submit"
          disabled={sending || !newMessage.trim()}
          className="px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:bg-gray-300 flex-shrink-0"
        >
          Отправить
        </button>
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
