import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useSearchParams } from 'react-router-dom';
import {
  fetchAvitoChatDetail,
  fetchAvitoChats,
  fetchAvitoMessengerEnabled,
  fetchAvitoMessages,
  sendAvitoImageFile,
  sendAvitoMessage,
  sendAvitoVoiceFile,
  setSelectedAvitoChatId,
} from '../../redux/slices/AvitoChatSlice';

/**
 * Основной канал новых сообщений: вебхук Avito → бэкенд → WebSocket (`avito_messenger_refresh`).
 * Интервальный опрос к GET …/messenger/v3/…/messages/ — запасной вариант (нет вебхука / офлайн WS).
 */
const AVITO_VISIBLE_POLL_MS = 15000;

const formatTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
};

const BackChevron = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
  </svg>
);

const chatThumbSrc = (chat) => chat?.context_image_url || chat?.avatar_url || null;

/** Имя собеседника: участники чата, кроме аккаунта Авито организации. */
function interlocutorTitle(chat, avitoUserId) {
  if (!chat) return '';
  const mine = avitoUserId != null ? String(avitoUserId) : '';
  const others = (chat.participants || []).filter((p) => p.id && p.id !== mine);
  const joined = others.map((p) => p.name).filter(Boolean).join(', ');
  return joined || chat.title || 'Чат';
}

function placeholderLetter(chat, avitoUserId) {
  const t = interlocutorTitle(chat, avitoUserId);
  return (t && t.charAt(0).toUpperCase()) || 'Ч';
}

/** Сервер выставляет is_outgoing по direction и avito_user_id. */
function messageIsMine(message) {
  return Boolean(message?.is_outgoing);
}

/** Шапка активного чата — в том же духе, что «Чат свой гараж»: фото, имя, подпись объявления. */
function AvitoConversationHeader({ displayChat, avitoUserId, onBack }) {
  const title = interlocutorTitle(displayChat, avitoUserId);
  const img = chatThumbSrc(displayChat);
  const sub = [displayChat?.context_title, displayChat?.context_price].filter(Boolean).join(' — ');

  return (
    <div className="p-4 border-b border-gray-200 bg-white shadow-sm flex-shrink-0">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-gray-600 hover:text-gray-900 transition-colors flex-shrink-0"
          aria-label="Назад к списку"
        >
          <BackChevron />
        </button>
        {img ? (
          <img
            src={img}
            alt=""
            className="w-11 h-11 rounded-lg object-cover flex-shrink-0 ring-2 ring-gray-100"
          />
        ) : (
          <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold flex-shrink-0 ring-2 ring-gray-100">
            {placeholderLetter(displayChat, avitoUserId)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{title}</h3>
          {displayChat?.context_url && sub ? (
            <a
              href={displayChat.context_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:text-blue-800 hover:underline block truncate"
            >
              {sub}
            </a>
          ) : sub ? (
            <p className="text-xs text-gray-500 truncate">{sub}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Одна строка в списке чатов — как в «Чат свой гараж»: превью слева, текст, счётчик. */
function AvitoChatListRow({ chat, selected, avitoUserId, onSelect }) {
  const img = chatThumbSrc(chat);
  const title = interlocutorTitle(chat, avitoUserId);
  const lastPrefix = chat.last_message_is_mine ? 'Вы: ' : '';

  return (
    <button
      type="button"
      onClick={() => onSelect(chat)}
      className={`w-full flex items-center gap-3 p-4 text-left transition-colors duration-150 ${
        selected ? 'bg-blue-50' : 'hover:bg-gray-50'
      }`}
    >
      <div className="flex-shrink-0">
        {img ? (
          <img src={img} alt="" className="w-14 h-14 rounded-lg object-cover ring-2 ring-gray-100" />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold text-xl ring-2 ring-gray-100">
            {placeholderLetter(chat, avitoUserId)}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <h3 className="font-semibold text-gray-900 truncate text-base">{title}</h3>
          <span className="text-xs text-gray-500 flex-shrink-0">{formatTime(chat.last_message_created_at)}</span>
        </div>
        {chat.context_title && (
          <p className="text-xs text-gray-500 truncate mb-1">{chat.context_title}</p>
        )}
        <p className="text-sm text-gray-600 truncate">
          {lastPrefix}
          {chat.last_message_text || 'Нет сообщений'}
        </p>
      </div>
      {Number(chat.unread_count) > 0 && (
        <span className="flex-shrink-0 px-2.5 py-1 bg-blue-600 text-white text-xs font-bold rounded-full min-w-[20px] text-center">
          {chat.unread_count}
        </span>
      )}
    </button>
  );
}

const AvitoChatPage = ({ fillMobileHub = false }) => {
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    chats,
    messages,
    selectedChatId,
    loading,
    sending,
    enabled,
    integrationLoading,
    chatDetail,
    chatDetailLoading,
    avitoUserId,
  } = useSelector((state) => state.avitoChats);
  const { user } = useSelector((state) => state.auth);

  const canLoadAvitoApi = Boolean(user?.organization_id && enabled);

  const [newMessage, setNewMessage] = useState('');
  const messagesEndMobileRef = useRef(null);
  const messagesEndDesktopRef = useRef(null);
  const [mobileListMode, setMobileListMode] = useState(true);
  const imageInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const mediaStreamRef = useRef(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);

  useEffect(() => {
    if (!user?.organization_id) return;
    dispatch(fetchAvitoMessengerEnabled());
  }, [dispatch, user?.organization_id]);

  useEffect(() => {
    if (!canLoadAvitoApi) return;
    dispatch(fetchAvitoChats());
  }, [dispatch, canLoadAvitoApi]);

  useEffect(() => {
    const avitoChatId = searchParams.get('avitoChatId');
    if (avitoChatId) {
      dispatch(setSelectedAvitoChatId(avitoChatId));
      setMobileListMode(false);
    }
  }, [dispatch, searchParams]);

  useEffect(() => {
    if (!canLoadAvitoApi || !selectedChatId) return;
    dispatch(fetchAvitoMessages(selectedChatId));
    dispatch(fetchAvitoChatDetail(selectedChatId));
  }, [dispatch, canLoadAvitoApi, selectedChatId]);

  const refreshAvitoSilent = useCallback(
    (chatId) => {
      if (!canLoadAvitoApi) return;
      dispatch(fetchAvitoChats({ silent: true }));
      if (chatId) {
        dispatch(fetchAvitoMessages({ chatId, silent: true, markRead: false }));
        dispatch(fetchAvitoChatDetail({ chatId, silent: true }));
      }
    },
    [dispatch, canLoadAvitoApi]
  );

  /** Сразу подтянуть переписку, когда пользователь вернулся на вкладку / в окно. */
  useEffect(() => {
    if (!canLoadAvitoApi) return undefined;
    const pullIfVisible = () => {
      if (document.visibilityState !== 'visible') return;
      refreshAvitoSilent(selectedChatId);
    };
    document.addEventListener('visibilitychange', pullIfVisible);
    window.addEventListener('focus', pullIfVisible);
    return () => {
      document.removeEventListener('visibilitychange', pullIfVisible);
      window.removeEventListener('focus', pullIfVisible);
    };
  }, [canLoadAvitoApi, selectedChatId, refreshAvitoSilent]);

  /** Периодический «тихий» опрос без спиннеров (см. silent в Redux). */
  useEffect(() => {
    if (!canLoadAvitoApi) return undefined;
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      refreshAvitoSilent(selectedChatId);
    }, AVITO_VISIBLE_POLL_MS);
    return () => clearInterval(id);
  }, [canLoadAvitoApi, selectedChatId, refreshAvitoSilent]);

  useEffect(() => {
    messagesEndMobileRef.current?.scrollIntoView({ behavior: 'smooth' });
    messagesEndDesktopRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const selectedChat = useMemo(
    () => chats.find((chat) => String(chat.id) === String(selectedChatId)) || null,
    [chats, selectedChatId]
  );

  const displayChat = useMemo(() => {
    if (!selectedChatId) return null;
    if (chatDetail && String(chatDetail.id) === String(selectedChatId)) return chatDetail;
    return selectedChat;
  }, [chatDetail, selectedChat, selectedChatId]);

  const handleSelectChat = (chat) => {
    dispatch(setSelectedAvitoChatId(chat.id));
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'avito');
    next.set('avitoChatId', String(chat.id));
    setSearchParams(next);
    setMobileListMode(false);
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!canLoadAvitoApi || !newMessage.trim() || !selectedChatId) return;
    await dispatch(sendAvitoMessage({ chatId: selectedChatId, message: newMessage.trim() }));
    setNewMessage('');
  };

  const handleImageSelected = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selectedChatId || !canLoadAvitoApi) return;
    dispatch(sendAvitoImageFile({ chatId: selectedChatId, file }));
  };

  const stopVoiceRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') {
      try {
        mr.stop();
      } catch {
        /* ignore */
      }
    }
    mediaRecorderRef.current = null;
    setIsRecordingVoice(false);
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  const startVoiceRecording = useCallback(async () => {
    if (!selectedChatId || !canLoadAvitoApi || sending || isRecordingVoice) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];
      mr.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], 'voice.webm', { type: blob.type || 'audio/webm' });
        dispatch(sendAvitoVoiceFile({ chatId: selectedChatId, file }));
      };
      mr.start();
      setIsRecordingVoice(true);
    } catch {
      setIsRecordingVoice(false);
    }
  }, [canLoadAvitoApi, dispatch, isRecordingVoice, selectedChatId, sending]);

  useEffect(() => {
    return () => {
      const mr = mediaRecorderRef.current;
      if (mr && mr.state !== 'inactive') {
        try {
          mr.stop();
        } catch {
          /* ignore */
        }
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const handleMobileBack = () => {
    setMobileListMode(true);
    dispatch(setSelectedAvitoChatId(null));
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'avito');
    next.delete('avitoChatId');
    setSearchParams(next);
  };

  if (integrationLoading) {
    return (
      <>
        <div className="md:hidden min-h-[40vh] flex items-center justify-center px-4">
          <p className="text-sm text-gray-500">Проверка интеграции Avito...</p>
        </div>
        <div className="hidden md:flex h-[calc(100vh-200px)] items-center justify-center bg-white rounded-lg border border-gray-100">
          <p className="text-sm text-gray-500">Проверка интеграции Avito...</p>
        </div>
      </>
    );
  }

  if (!user?.organization_id) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[240px] md:min-h-[320px] px-6 text-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
        <p className="text-gray-700 font-medium mb-2">Чат Авито</p>
        <p className="text-sm text-gray-600 max-w-md">
          Раздел доступен для аккаунтов, привязанных к организации продавца.
        </p>
      </div>
    );
  }

  if (!enabled) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[240px] md:min-h-[320px] px-6 text-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
        <p className="text-gray-700 font-medium mb-2">Чат Авито</p>
        <p className="text-sm text-gray-600 max-w-md">
          Для загрузки переписок с Авито настройте интеграцию: ключи API и ID пользователя Авито в{' '}
          <Link to="/settings/integration" className="text-blue-600 hover:underline">
            Настройки → Интеграция Авито
          </Link>
          .
        </p>
      </div>
    );
  }

  const renderMessageBubble = (message) => {
    const isOwn = messageIsMine(message);
    const mt = String(message.message_type || 'text').toLowerCase();
    const urls =
      Array.isArray(message.image_urls) && message.image_urls.length > 0
        ? message.image_urls
        : message.image_url
          ? [message.image_url]
          : [];
    const showText = Boolean(String(message.message || '').trim());
    const linkCls = isOwn ? 'text-blue-100 hover:text-white underline' : 'text-blue-600 hover:underline';

    return (
      <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2`}>
        <div className="max-w-[85%] sm:max-w-md">
          {!isOwn && message.sender_name && (
            <p className="text-xs text-gray-500 mb-0.5 px-1">{message.sender_name}</p>
          )}
          <div
            className={`px-4 py-2 rounded-2xl ${
              isOwn
                ? 'bg-blue-600 text-white rounded-br-md'
                : 'bg-white text-gray-900 shadow-sm rounded-bl-md border border-gray-100'
            }`}
          >
            {urls.length > 0 && (
              <div className="flex flex-col gap-2 mb-1">
                {urls.map((src) => (
                  <a key={src} href={src} target="_blank" rel="noopener noreferrer" className={`block ${linkCls}`}>
                    <img src={src} alt="" className="max-w-full rounded-lg max-h-64 object-contain bg-black/5" />
                  </a>
                ))}
              </div>
            )}
            {message.voice_url ? (
              <audio
                controls
                src={message.voice_url}
                className={`w-full max-w-xs my-1 ${isOwn ? 'opacity-95' : ''}`}
              />
            ) : null}
            {(mt === 'image' || mt === 'voice' || mt === 'file') &&
            !showText &&
            urls.length === 0 &&
            !message.voice_url ? (
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

  const attachmentButtonClass =
    'p-2.5 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 flex-shrink-0';
  const voiceButtonClass = `${attachmentButtonClass} ${isRecordingVoice ? 'bg-red-50 border-red-300 text-red-700' : ''}`;

  return (
    <>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-hidden
        onChange={handleImageSelected}
      />
      <div
        className={`md:hidden flex flex-col overflow-hidden bg-white min-h-0 ${
          fillMobileHub
            ? 'relative h-full flex-1'
            : 'fixed inset-0 z-50 h-[100dvh]'
        }`}
      >
        {mobileListMode ? (
          <div className="h-full overflow-y-auto divide-y divide-gray-100">
            {chats.map((chat) => (
              <AvitoChatListRow
                key={chat.id}
                chat={chat}
                selected={String(chat.id) === String(selectedChatId)}
                avitoUserId={avitoUserId}
                onSelect={handleSelectChat}
              />
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <AvitoConversationHeader
              displayChat={displayChat}
              avitoUserId={avitoUserId}
              onBack={handleMobileBack}
            />
            {chatDetailLoading && (
              <p className="px-4 py-1 text-xs text-gray-400 bg-white border-b border-gray-100">Обновление…</p>
            )}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50 min-h-0">
              {messages.map(renderMessageBubble)}
              <div ref={messagesEndMobileRef} />
            </div>
            <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 bg-white flex gap-2 flex-shrink-0 items-center">
              <button
                type="button"
                className={attachmentButtonClass}
                disabled={sending || !selectedChatId}
                onClick={() => imageInputRef.current?.click()}
                aria-label="Прикрепить изображение"
                title="Изображение"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                  />
                </svg>
              </button>
              <button
                type="button"
                className={voiceButtonClass}
                disabled={sending || !selectedChatId}
                onClick={() => (isRecordingVoice ? stopVoiceRecording() : startVoiceRecording())}
                aria-label={isRecordingVoice ? 'Остановить запись' : 'Записать голос'}
                title={isRecordingVoice ? 'Стоп' : 'Голос'}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
                </svg>
              </button>
              <input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Введите сообщение..."
                className="flex-1 min-w-0 px-4 py-2 border border-gray-300 rounded-full"
              />
              <button
                type="submit"
                disabled={sending || !newMessage.trim()}
                className="px-5 py-2 bg-blue-600 text-white rounded-full disabled:bg-gray-300 flex-shrink-0"
              >
                Отправить
              </button>
            </form>
          </div>
        )}
      </div>

      <div className="hidden md:flex h-[calc(100vh-200px)] bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="w-96 border-r border-gray-200 overflow-y-auto flex flex-col">
          {loading && chats.length === 0 ? (
            <div className="p-6 text-sm text-gray-500">Загрузка чатов Avito...</div>
          ) : chats.length === 0 ? (
            <div className="p-6 text-sm text-gray-500">Чаты Avito не найдены.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {chats.map((chat) => (
                <AvitoChatListRow
                  key={chat.id}
                  chat={chat}
                  selected={String(chat.id) === String(selectedChatId)}
                  avitoUserId={avitoUserId}
                  onSelect={handleSelectChat}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          {selectedChatId ? (
            <>
              <AvitoConversationHeader
                displayChat={displayChat}
                avitoUserId={avitoUserId}
                onBack={() => {
                  dispatch(setSelectedAvitoChatId(null));
                  const next = new URLSearchParams(searchParams);
                  next.set('tab', 'avito');
                  next.delete('avitoChatId');
                  setSearchParams(next);
                }}
              />
              {chatDetailLoading && (
                <p className="px-4 py-1 text-xs text-gray-400 bg-white border-b border-gray-100">Обновление…</p>
              )}
              <div className="flex-1 overflow-y-auto p-4 bg-gray-50 min-h-0">
                {messages.map(renderMessageBubble)}
                <div ref={messagesEndDesktopRef} />
              </div>
              <form
                onSubmit={handleSendMessage}
                className="p-4 border-t border-gray-200 bg-white flex gap-2 flex-shrink-0 items-center"
              >
                <button
                  type="button"
                  className={attachmentButtonClass}
                  disabled={sending || !selectedChatId}
                  onClick={() => imageInputRef.current?.click()}
                  aria-label="Прикрепить изображение"
                  title="Изображение"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  className={voiceButtonClass}
                  disabled={sending || !selectedChatId}
                  onClick={() => (isRecordingVoice ? stopVoiceRecording() : startVoiceRecording())}
                  aria-label={isRecordingVoice ? 'Остановить запись' : 'Записать голос'}
                  title={isRecordingVoice ? 'Стоп' : 'Голос'}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
                  </svg>
                </button>
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Введите сообщение..."
                  className="flex-1 min-w-0 px-4 py-2.5 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim()}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:bg-gray-300 flex-shrink-0"
                >
                  Отправить
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <p className="text-gray-600">Выберите чат Авито</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default AvitoChatPage;
