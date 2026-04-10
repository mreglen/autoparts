import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
  fetchUserChats,
  fetchChatMessages,
  sendWebSocketMessage,
  sendChatMedia,
  addOptimisticMessage,
  setCurrentChat,
  setReplyToMessage,
  subscribeToPushNotifications,
  connectWebSocket,
  disconnectWebSocket,
  updateMediaFailedStatus
} from '../../redux/slices/ChatSlice';
import { fetchAdminOrganizationPhone } from '../../redux/slices/PublicInfoSlice';
import MediaMessage from './MediaMessage';
import MediaPreview from './MediaPreview';
import ChatMenu from './ChatMenu';
import ChatListMenu from './ChatListMenu';
import ReplyArrow from './ReplyArrow';
import ReplyPreview from './ReplyPreview';
import SwipeableMessage from './SwipeableMessage';
import ConfirmModal from '../../components/ConfirmModal';

const formatPhoneNumber = (phone) => {
    if (!phone) return '';

    // Удаляем все нецифровые символы
    let digits = phone.replace(/\D/g, '');

    // Если начинается с 7 или 8, заменяем на 7
    if (digits.startsWith('7') || digits.startsWith('8')) {
        digits = '7' + digits.slice(1);
    }

    // Форматируем как +7 (XXX) XXX-XX-XX
    let formatted = '+7 ';
    if (digits.length > 1) {
        formatted += '(' + digits.slice(1, 4);
    }
    if (digits.length > 4) {
        formatted += ') ' + digits.slice(4, 7);
    }
    if (digits.length > 7) {
        formatted += '-' + digits.slice(7, 9);
    }
    if (digits.length > 9) {
        formatted += '-' + digits.slice(9, 11);
    }

    return formatted;
};

const ChatPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { chatId } = useParams();
  
  // Check if we're in a specific chat or just the chat list
  const isSpecificChat = /^\/chats\/\d+/.test(location.pathname);
  
  const { user } = useSelector((state) => state.auth);
  const { chats, currentChat, messages, loading, wsConnected: wsConnectedState } = useSelector((state) => state.chats);
  const { adminOrganizationPhone } = useSelector((state) => state.publicInfo);
  
  const [newMessage, setNewMessage] = useState('');
  const [selectedChatId, setSelectedChatId] = useState(chatId || null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [showFileLimitModal, setShowFileLimitModal] = useState(false);
  const [showUnsupportedFilesModal, setShowUnsupportedFilesModal] = useState(false);
  const [showRetryModal, setShowRetryModal] = useState(false);
  const [activeChatMenuId, setActiveChatMenuId] = useState(null);
  const replyToMessage = useSelector(state => state.chats.replyToMessage);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const messageInputRef = useRef(null);

  // Fetch admin organization phone on component mount
  useEffect(() => {
    dispatch(fetchAdminOrganizationPhone());
  }, [dispatch]);

  // Подключаем WebSocket при загрузке
  useEffect(() => {
    if (user) {
      dispatch(connectWebSocket(user.id));
    }
    
    return () => {
      dispatch(disconnectWebSocket());
    };
  }, [dispatch, user]);

  // Подписываемся на push уведомления
  useEffect(() => {
    if (user) {
      dispatch(subscribeToPushNotifications());
    }
  }, [dispatch, user]);

  // Загружаем чаты пользователя
  useEffect(() => {
    if (user) {
      dispatch(fetchUserChats({}));
    }
  }, [dispatch, user]);

  // Если есть chatId в URL, загружаем этот чат
  useEffect(() => {
    if (chatId) {
      setSelectedChatId(chatId);
      const chat = chats.find(c => c.id === parseInt(chatId));
      if (chat) {
        dispatch(setCurrentChat(chat));
        dispatch(fetchChatMessages({ chatId: parseInt(chatId) }));
      }
    } else {
      // Если нет chatId в URL, сбрасываем текущий чат
      dispatch(setCurrentChat(null));
      setSelectedChatId(null);
    }
  }, [chatId, chats, dispatch]);

  // Автоскролл к последнему сообщению
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Единый polling: fallback при отключенном WS + обновление статуса медиа в обработке
  useEffect(() => {
    if (!selectedChatId) return;

    const hasProcessingMedia = messages.some(msg =>
      msg.media && msg.media.some(m => m.is_processing)
    );
    const shouldPoll = !wsConnectedState || hasProcessingMedia;

    if (!shouldPoll) return;

    const intervalMs = !wsConnectedState ? 3000 : 5000;
    const interval = setInterval(() => {
      dispatch(fetchChatMessages({ chatId: parseInt(selectedChatId) }));
    }, intervalMs);

    return () => {
      clearInterval(interval);
    };
  }, [wsConnectedState, messages, selectedChatId, dispatch]);

  // Закрыть меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (activeChatMenuId && !event.target.closest('[title="Меню чата"]')) {
        setActiveChatMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeChatMenuId]);

  // Выбираем чат
  const handleSelectChat = (chat) => {
    setSelectedChatId(chat.id);
    dispatch(setCurrentChat(chat));
    dispatch(fetchChatMessages({ chatId: chat.id }));
    navigate(`/chats/${chat.id}`);
  };

  // Отправляем сообщение
  const handleSendMessage = (e) => {
    e.preventDefault();
    
    // Проверить заблокирован ли пользователь
    if (currentChat?.is_current_user_blocked) {
      setShowBlockedModal(true);
      return;
    }
    
    if ((!newMessage.trim() && selectedFiles.length === 0) || !selectedChatId || !user) return;
    
    const messageText = newMessage.trim();
    const chatIdNum = parseInt(selectedChatId);
    
    // Если есть файлы, отправляем их
    if (selectedFiles.length > 0) {
      handleSendMedia();
      return;
    }
    
    // Сразу добавляем сообщение в UI (оптимистичное обновление)
    dispatch(addOptimisticMessage({
      chatId: chatIdNum,
      message: messageText,
      senderId: user.id,
      reply_to_id: replyToMessage?.id || null
    }));
    
    // Отправляем через WebSocket в реальном времени
    dispatch(sendWebSocketMessage(
      chatIdNum,
      user.id,
      messageText,
      replyToMessage?.id || null
    ));
    
    // Очищаем ответ и поле ввода
    setNewMessage('');
    dispatch(setReplyToMessage(null));
  };

  // Обработка ответа на сообщение
  const handleReply = (message) => {
    dispatch(setReplyToMessage(message));
    messageInputRef.current?.focus();
  };

  // Обработка клика на ответ - прокрутка к оригинальному сообщению
  const handleReplyClick = (replyToId) => {
    if (!replyToId) return;
    
    const element = document.getElementById(`message-${replyToId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Добавляем подсветку
      element.classList.add('bg-blue-100');
      setTimeout(() => {
        element.classList.remove('bg-blue-100');
      }, 2000);
    }
  };

  // Обработка выбора файлов
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    
    // Проверяем лимит файлов
    if (selectedFiles.length + files.length > 5) {
      setShowFileLimitModal(true);
      return;
    }
    
    // Проверяем типы файлов - теперь поддерживаем больше форматов
    const allowedTypes = [
      // Изображения
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif',
      // Видео
      'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
      // Документы
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'application/zip',
      'application/x-rar-compressed',
      'application/x-7z-compressed'
    ];
    
    const invalidFiles = files.filter(f => !allowedTypes.includes(f.type));
    
    if (invalidFiles.length > 0) {
      setShowUnsupportedFilesModal(true);
      return;
    }
    
    setSelectedFiles([...selectedFiles, ...files]);
    
    // Сбрасываем input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Удаление файла из очереди
  const handleRemoveFile = (index) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
  };

  // Отправка медиа
  const handleSendMedia = async () => {
    if (selectedFiles.length === 0 || !selectedChatId || !user) return;
    
    // Проверить заблокирован ли пользователь
    if (currentChat?.is_current_user_blocked) {
      setShowBlockedModal(true);
      return;
    }
    
    setUploading(true);
    const chatIdNum = parseInt(selectedChatId);
    const messageText = newMessage.trim();
    
    try {
      // Создаем временное сообщение с медиа
      const tempMedia = selectedFiles.map(file => {
        let mediaType;
        if (file.type.startsWith('image/')) {
          mediaType = 'image';
        } else if (file.type.startsWith('video/')) {
          mediaType = 'video';
        } else {
          mediaType = 'document';
        }
        
        return {
          id: `temp_${Date.now()}_${Math.random()}`,
          media_type: mediaType,
          is_processing: true,
          original_filename: file.name,
          file_size: file.size,
          mime_type: file.type
        };
      });
      
      // Оптимистичное добавление
      dispatch(addOptimisticMessage({
        chatId: chatIdNum,
        message: messageText,
        senderId: user.id,
        media: tempMedia
      }));
      
      // Отправляем на сервер
      await dispatch(sendChatMedia({
        chatId: chatIdNum,
        files: selectedFiles,
        message: messageText
      }));
      
      // Очищаем
      setSelectedFiles([]);
      setNewMessage('');
    } catch (error) {
      console.error('Ошибка отправки медиа:', error);
      // Обновляем статус медиа на failed
      dispatch(updateMediaFailedStatus({
        chatId: chatIdNum,
        isFailed: true
      }));
    } finally {
      setUploading(false);
    }
  };

  // Форматируем время
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    // Если сегодня - показываем время
    if (diff < 86400000 && date.getDate() === now.getDate()) {
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    
    // Если вчера
    if (diff < 172800000) {
      return 'Вчера';
    }
    
    // Иначе дату
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  // Отмена загрузки медиа
  const handleCancelMediaUpload = (mediaId) => {
    console.log('Отменена загрузка медиа:', mediaId);
    // Здесь можно добавить дополнительную логику отмены
  };

  // Повторная отправка медиа
  const handleRetryMediaUpload = async (mediaItem) => {
    if (!selectedChatId || !user) return;
    
    const chatIdNum = parseInt(selectedChatId);
    
    try {
      // Для повторной отправки нужно попросить пользователя выбрать файл заново
      // или можно попробовать извлечь данные из mediaItem если они сохранены
      setShowRetryModal(true);
      
      // Открываем диалог выбора файла
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    } catch (error) {
      console.error('Ошибка повторной отправки медиа:', error);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-gray-600">Пожалуйста, войдите в систему</p>
          <button
            onClick={() => navigate('/auth')}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Войти
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Mobile: Full-screen chat interface */}
      <div className="md:hidden h-[100dvh] bg-white overflow-hidden fixed inset-0 z-50">
        <div className="flex h-full">
          {/* Mobile Chat List */}
          <div className={`flex flex-col h-full w-full ${currentChat ? 'hidden' : 'flex'}`}>
            {/* Chat List */}
            <div className="flex-1 overflow-y-auto">
              {loading && chats.length === 0 ? (
                <div className="flex items-center justify-center h-64">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm text-gray-500">Загрузка чатов...</p>
                  </div>
                </div>
              ) : chats.length === 0 ? (
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
                  {chats.map((chat) => {
                    const isSelected = selectedChatId === chat.id.toString();
                    const otherUserName = user.id === chat.seller_id 
                      ? (chat.buyer_name || 'Покупатель')
                      : (chat.seller_name || chat.seller_organization || 'Продавец');
                    
                    return (
                      <div
                        key={chat.id}
                        onClick={() => handleSelectChat(chat)}
                        className={`flex items-start gap-3 p-4 cursor-pointer transition-colors duration-150 ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                      >
                        {/* Avatar */}
                        {chat.product_photo_url ? (
                          <img 
                            src={chat.product_photo_url}
                            alt={chat.product_name || 'Товар'}
                            className="w-14 h-14 rounded-lg object-cover flex-shrink-0 ring-2 ring-gray-100"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold text-xl flex-shrink-0 ring-2 ring-gray-100">
                            {(chat.seller_name || 'П').charAt(0).toUpperCase()}
                          </div>
                        )}
                        
                        {/* Chat Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="font-semibold text-gray-900 truncate text-base">
                              {otherUserName}
                            </h3>
                            {chat.last_message && (
                              <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                                {formatTime(chat.last_message.created_at)}
                              </span>
                            )}
                          </div>
                          
                          {chat.product_name && (
                            <p className="text-xs text-gray-500 truncate mb-1.5">
                              {chat.product_name}
                            </p>
                          )}
                          
                          {chat.last_message && (
                            <div className="flex items-center gap-1.5">
                              {chat.last_message.sender_id === user.id && (
                                <span className="flex-shrink-0">
                                  {chat.last_message.is_read ? (
                                    <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z"/>
                                    </svg>
                                  ) : (
                                    <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                                    </svg>
                                  )}
                                </span>
                              )}
                              <p className="text-sm text-gray-600 truncate">
                                {chat.last_message.sender_id === user.id && 'Вы: '}
                                {chat.last_message.message}
                              </p>
                            </div>
                          )}
                        </div>
                        
                        {chat.unread_count > 0 && (
                          <span className="ml-2 px-2.5 py-1 bg-blue-600 text-white text-xs font-bold rounded-full flex-shrink-0 min-w-[20px] text-center">
                            {chat.unread_count}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        
          {/* Mobile Chat Area */}
          {currentChat && (
            <div className="flex flex-col h-full w-full">
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-200 bg-white shadow-sm flex-shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      dispatch(setCurrentChat(null));
                      setSelectedChatId(null);
                      navigate('/chats');
                    }}
                    className="text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  
                  {currentChat.product_photo_url ? (
                    <img 
                      src={currentChat.product_photo_url}
                      alt={currentChat.product_name || 'Товар'}
                      className="w-11 h-11 rounded-lg object-cover flex-shrink-0 ring-2 ring-gray-100"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold flex-shrink-0 ring-2 ring-gray-100">
                      {(user.id === currentChat.seller_id 
                        ? (currentChat.buyer_name || 'П')
                        : (currentChat.seller_name || currentChat.seller_organization || 'П')
                      ).charAt(0).toUpperCase()}
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {user.id === currentChat.seller_id 
                        ? (currentChat.buyer_name || 'Покупатель')
                        : (currentChat.seller_name || currentChat.seller_organization || 'Продавец')
                      }
                    </h3>
                    {currentChat.product_name && (
                      <a 
                        href={currentChat.product_url || `/part/${currentChat.product_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-800 hover:underline block truncate"
                      >
                        {currentChat.product_name} - {currentChat.product_article}
                      </a>
                    )}
                  </div>
                  
                  {/* Меню чата (три точки) */}
                  <ChatMenu chat={currentChat} currentUserId={user.id} />
                </div>
              </div>
              
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 bg-gray-50 min-h-0">
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
                      const isOwn = message.sender_id === user.id;
                      return (
                        <div 
                          key={message.id} 
                          id={`message-${message.id}`}
                          className={`group flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                        >
                          <SwipeableMessage 
                            message={message} 
                            onReply={handleReply}
                            isOwn={isOwn}
                          >
                            <div className="relative">
                              {/* Reply badge - показываем если это ответ */}
                              {message.reply_to && (
                                <button
                                  onClick={() => handleReplyClick(message.reply_to_id)}
                                  className={`block w-full text-left mb-2 px-3 py-1.5 rounded-lg border-l-2 border-blue-400 ${
                                    isOwn ? 'bg-blue-500' : 'bg-gray-50'
                                  } hover:opacity-80 transition-opacity`}
                                >
                                  <p className={`text-xs truncate ${
                                    isOwn ? 'text-blue-100' : 'text-gray-600'
                                  }`}>
                                    {message.reply_to.message || '📎 Медиафайл'}
                                  </p>
                                </button>
                              )}
                              
                              {/* Стрелка ответа при наведении */}
                              <ReplyArrow 
                                message={message} 
                                onReply={handleReply}
                                isOwn={isOwn}
                              />
                              
                              {/* Message content */}
                              <div className={`max-w-xs sm:max-w-sm px-4 py-2.5 rounded-2xl ${
                                isOwn ? 'bg-blue-600 text-white rounded-br-md' : 'bg-white text-gray-900 shadow-sm rounded-bl-md'
                              }`}>
                                {message.message && <p className="text-sm break-words">{message.message}</p>}
                                {message.media && message.media.length > 0 && (
                                  <div className="mt-2 space-y-2">
                                    {message.media.map((mediaItem) => (
                                      <MediaMessage
                                        key={mediaItem.id}
                                        media={mediaItem}
                                        isOwn={isOwn}
                                        onCancelUpload={handleCancelMediaUpload}
                                        onRetryUpload={handleRetryMediaUpload}
                                      />
                                    ))}
                                  </div>
                                )}
                                <div className="flex items-center justify-end mt-1.5 space-x-1">
                                  <p className={`text-xs ${isOwn ? 'text-blue-100' : 'text-gray-500'}`}>{formatTime(message.created_at)}</p>
                                  {isOwn && (
                                    <span>
                                      {message.id?.toString().startsWith('temp_') ? (
                                        <svg className="w-4 h-4 text-blue-200 animate-spin" fill="none" viewBox="0 0 24 24">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                  ) : message.media && message.media.some(m => m.is_processing) ? (
                                    <svg className="w-4 h-4 text-blue-200 animate-spin" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                  ) : message.is_read ? (
                                    <svg className="w-4 h-4 text-blue-200" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z"/>
                                    </svg>
                                  ) : (
                                    <svg className="w-4 h-4 text-blue-200" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                                    </svg>
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                            </div>
                          </SwipeableMessage>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>
              
              {/* Сообщение о блокировке */}
              {currentChat?.is_current_user_blocked && (
                <div className="p-4 bg-yellow-50 border-t border-yellow-200">
                  <div className="flex items-center gap-2 text-yellow-800">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
                    </svg>
                    <p className="text-sm font-medium">Вы заблокированы в этом чате</p>
                  </div>
                </div>
              )}
              
              {/* Message Input */}
              <form onSubmit={handleSendMessage} className="border-t border-gray-200 bg-white flex-shrink-0">
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
                  <MediaPreview files={selectedFiles} onRemove={handleRemoveFile} uploading={uploading} />
                )}
                <div className="p-4">
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading || selectedFiles.length >= 5} className="p-2.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                    </button>
                    <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.7z" onChange={handleFileSelect} className="hidden" />
                    <input 
                      ref={messageInputRef}
                      type="text" 
                      value={newMessage} 
                      onChange={(e) => setNewMessage(e.target.value)} 
                      placeholder={selectedFiles.length > 0 ? "Добавить комментарий..." : "Введите сообщение..."} 
                      className="flex-1 px-4 py-2.5 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" 
                      disabled={uploading} 
                    />
                    <button type="submit" disabled={(!newMessage.trim() && selectedFiles.length === 0) || uploading} className="px-6 py-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium">
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
                  {selectedFiles.length > 0 && (
                    <p className="text-xs text-gray-500 mt-2 text-center">Максимум 5 файлов</p>
                  )}
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Desktop: Chat interface inside main layout */}
      <div className="hidden md:flex h-[calc(100vh-200px)] bg-white rounded-lg shadow-sm overflow-hidden">
        {/* Desktop Chat List Sidebar */}
        <div className={`w-96 flex flex-col border-r border-gray-200 ${currentChat ? 'hidden' : 'flex'}`}>
          <div className="flex-1 overflow-y-auto">
            {loading && chats.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : chats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full px-6 py-12">
                <div className="w-20 h-20 mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-gray-600 font-medium mb-1">У вас пока нет сообщений</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {chats.map((chat) => {
                  const isSelected = selectedChatId === chat.id.toString();
                  const otherUserName = user.id === chat.seller_id ? (chat.buyer_name || 'Покупатель') : (chat.seller_name || chat.seller_organization || 'Продавец');
                  const showMenu = activeChatMenuId === chat.id;
                  
                  return (
                    <div key={chat.id} className={`flex items-center gap-3 p-4 transition-colors duration-150 ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                      {/* Аватар или фото товара */}
                      <div onClick={() => handleSelectChat(chat)} className="flex-shrink-0 cursor-pointer">
                        {chat.product_photo_url ? (
                          <img src={chat.product_photo_url} alt={chat.product_name || 'Товар'} className="w-14 h-14 rounded-lg object-cover ring-2 ring-gray-100" />
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold text-xl ring-2 ring-gray-100">{(chat.seller_name || 'П').charAt(0).toUpperCase()}</div>
                        )}
                      </div>
                      
                      {/* Информация о чате */}
                      <div onClick={() => handleSelectChat(chat)} className="flex-1 min-w-0 cursor-pointer">
                        {/* Имя и время */}
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-semibold text-gray-900 truncate text-base">{otherUserName}</h3>
                          {chat.last_message && (
                            <span className="text-xs text-gray-500 ml-2 flex-shrink-0">{formatTime(chat.last_message.created_at)}</span>
                          )}
                        </div>
                        
                        {/* Название товара */}
                        {chat.product_name && (
                          <p className="text-xs text-gray-500 truncate mb-1.5">{chat.product_name}</p>
                        )}
                        
                        {/* Последнее сообщение */}
                        {chat.last_message && (
                          <div className="flex items-center gap-1.5">
                            {chat.last_message.sender_id === user.id && (
                              <span className="flex-shrink-0">
                                {chat.last_message.is_read ? (
                                  <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z"/>
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                                  </svg>
                                )}
                              </span>
                            )}
                            <p className="text-sm text-gray-600 truncate">
                              {chat.last_message.sender_id === user.id && 'Вы: '}
                              {chat.last_message.message}
                            </p>
                          </div>
                        )}
                      </div>
                      
                      {/* Счётчик непрочитанных */}
                      {chat.unread_count > 0 && (
                        <span className="flex-shrink-0 px-2.5 py-1 bg-blue-600 text-white text-xs font-bold rounded-full min-w-[20px] text-center">
                          {chat.unread_count}
                        </span>
                      )}
                      
                      {/* Меню чата (три точки) */}
                      <div className="relative flex-shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveChatMenuId(showMenu ? null : chat.id);
                          }}
                          className="p-1.5 hover:bg-gray-200 rounded-full transition-colors"
                          title="Меню чата"
                        >
                          <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                          </svg>
                        </button>
                        
                        {/* Выпадающее меню */}
                        {showMenu && (
                          <ChatListMenu chat={chat} currentUserId={user.id} onClose={() => setActiveChatMenuId(null)} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Desktop Chat Area */}
        {currentChat ? (
          <div className="flex-1 flex flex-col">
            <div className="p-4 border-b border-gray-200 bg-white shadow-sm flex-shrink-0">
              <div className="flex items-center gap-3">
                {/* Back button for desktop */}
                <button
                  onClick={() => {
                    dispatch(setCurrentChat(null));
                    setSelectedChatId(null);
                    navigate('/chats');
                  }}
                  className="hidden lg:flex items-center justify-center w-9 h-9 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
                  title="Вернуться к списку чатов"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                
                {currentChat.product_photo_url ? (
                  <img src={currentChat.product_photo_url} alt={currentChat.product_name || 'Товар'} className="w-11 h-11 rounded-lg object-cover flex-shrink-0 ring-2 ring-gray-100" />
                ) : (
                  <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold flex-shrink-0 ring-2 ring-gray-100">{(user.id === currentChat.seller_id ? (currentChat.buyer_name || 'П') : (currentChat.seller_name || currentChat.seller_organization || 'П')).charAt(0).toUpperCase()}</div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{user.id === currentChat.seller_id ? (currentChat.buyer_name || 'Покупатель') : (currentChat.seller_name || currentChat.seller_organization || 'Продавец')}</h3>
                  {currentChat.product_name && (<a href={currentChat.product_url || `/part/${currentChat.product_id}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:text-blue-800 hover:underline block truncate">{currentChat.product_name} - {currentChat.product_article}</a>)}
                </div>
                
                {/* Меню чата (три точки) */}
                <ChatMenu chat={currentChat} currentUserId={user.id} />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50 min-h-0">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                      <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    </div>
                    <p className="text-gray-600 font-medium">Начните беседу!</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {messages.map((message) => {
                    const isOwn = message.sender_id === user.id;
                    return (
                      <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-md px-4 py-2.5 rounded-2xl ${isOwn ? 'bg-blue-600 text-white rounded-br-md' : 'bg-white text-gray-900 shadow-sm rounded-bl-md'}`}>
                          {message.message && <p className="text-sm break-words">{message.message}</p>}
                          {message.media && message.media.length > 0 && (
                            <div className="mt-2 space-y-2">
                              {message.media.map((mediaItem) => (<MediaMessage key={mediaItem.id} media={mediaItem} isOwn={isOwn} onCancelUpload={handleCancelMediaUpload} onRetryUpload={handleRetryMediaUpload} />))}
                            </div>
                          )}
                          <div className="flex items-center justify-end mt-1.5 space-x-1">
                            <p className={`text-xs ${isOwn ? 'text-blue-100' : 'text-gray-500'}`}>{formatTime(message.created_at)}</p>
                            {isOwn && (<span>{message.id?.toString().startsWith('temp_') ? (<svg className="w-4 h-4 text-blue-200 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>) : message.media && message.media.some(m => m.is_processing) ? (<svg className="w-4 h-4 text-blue-200 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>) : message.is_read ? (<svg className="w-4 h-4 text-blue-200" fill="currentColor" viewBox="0 0 24 24"><path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z"/></svg>) : (<svg className="w-4 h-4 text-blue-200" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>)}</span>)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
            
            {/* Сообщение о блокировке */}
            {currentChat?.is_current_user_blocked && (
              <div className="p-4 bg-yellow-50 border-t border-yellow-200">
                <div className="flex items-center gap-2 text-yellow-800">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
                  </svg>
                  <p className="text-sm font-medium">Вы заблокированы в этом чате</p>
                </div>
              </div>
            )}
            
            <form onSubmit={handleSendMessage} className="border-t border-gray-200 bg-white flex-shrink-0">
              {/* Reply Preview */}
              {replyToMessage && (
                <div className="px-4 pt-3">
                  <ReplyPreview 
                    replyTo={replyToMessage} 
                    onCancel={() => dispatch(setReplyToMessage(null))} 
                  />
                </div>
              )}
              
              {selectedFiles.length > 0 && (<MediaPreview files={selectedFiles} onRemove={handleRemoveFile} uploading={uploading} />)}
              <div className="p-4">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading || selectedFiles.length >= 5} className="p-2.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                  </button>
                  <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.7z" onChange={handleFileSelect} className="hidden" />
                  <input 
                    ref={messageInputRef}
                    type="text" 
                    value={newMessage} 
                    onChange={(e) => setNewMessage(e.target.value)} 
                    placeholder={selectedFiles.length > 0 ? "Добавить комментарий..." : "Введите сообщение..."} 
                    className="flex-1 px-4 py-2.5 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" 
                    disabled={uploading} 
                  />
                  <button type="submit" disabled={(!newMessage.trim() && selectedFiles.length === 0) || uploading} className="px-6 py-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium">
                    {uploading ? (<svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>) : (<svg className="w-5 h-5 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>)}
                  </button>
                </div>
              </div>
            </form>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              </div>
              <p className="text-gray-600 font-medium text-lg">Выберите чат, чтобы начать общение</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Модальные окна */}
      <ConfirmModal
        isOpen={showBlockedModal}
        onClose={() => setShowBlockedModal(false)}
        onConfirm={() => {}}
        title="Доступ запрещён"
        message="Вы заблокированы в этом чате и не можете отправлять сообщения."
        confirmText="Понятно"
        cancelText=""
        type="warning"
      />
      
      <ConfirmModal
        isOpen={showFileLimitModal}
        onClose={() => setShowFileLimitModal(false)}
        onConfirm={() => {}}
        title="Лимит файлов"
        message="Можно отправить максимум 5 файлов за раз."
        confirmText="OK"
        cancelText=""
        type="warning"
      />
      
      <ConfirmModal
        isOpen={showUnsupportedFilesModal}
        onClose={() => setShowUnsupportedFilesModal(false)}
        onConfirm={() => {}}
        title="Неподдерживаемый формат"
        message="Поддерживаются: изображения, видео, PDF, Word, Excel, PowerPoint, текстовые файлы, архивы."
        confirmText="OK"
        cancelText=""
        type="warning"
      />
      
      <ConfirmModal
        isOpen={showRetryModal}
        onClose={() => setShowRetryModal(false)}
        onConfirm={() => {}}
        title="Повторная отправка"
        message="Для повторной отправки выберите файл заново."
        confirmText="OK"
        cancelText=""
        type="warning"
      />
    </>
  );
};

export default ChatPage;
