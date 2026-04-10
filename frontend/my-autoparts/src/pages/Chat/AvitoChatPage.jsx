import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import {
  fetchAvitoChats,
  fetchAvitoMessages,
  sendAvitoMessage,
  setSelectedAvitoChatId,
} from '../../redux/slices/AvitoChatSlice';

const formatTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
};

const AvitoChatPage = () => {
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const { chats, messages, selectedChatId, loading, sending } = useSelector((state) => state.avitoChats);
  const { user } = useSelector((state) => state.auth);

  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);
  const [mobileListMode, setMobileListMode] = useState(true);

  useEffect(() => {
    dispatch(fetchAvitoChats());
  }, [dispatch]);

  useEffect(() => {
    const avitoChatId = searchParams.get('avitoChatId');
    if (avitoChatId) {
      dispatch(setSelectedAvitoChatId(avitoChatId));
      setMobileListMode(false);
    }
  }, [dispatch, searchParams]);

  useEffect(() => {
    if (!selectedChatId) return;
    dispatch(fetchAvitoMessages(selectedChatId));
  }, [dispatch, selectedChatId]);

  useEffect(() => {
    const interval = setInterval(() => {
      dispatch(fetchAvitoChats());
      if (selectedChatId) {
        dispatch(fetchAvitoMessages(selectedChatId));
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [dispatch, selectedChatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const selectedChat = useMemo(
    () => chats.find((chat) => String(chat.id) === String(selectedChatId)) || null,
    [chats, selectedChatId]
  );

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
    if (!newMessage.trim() || !selectedChatId) return;
    await dispatch(sendAvitoMessage({ chatId: selectedChatId, message: newMessage.trim() }));
    setNewMessage('');
  };

  return (
    <>
      <div className="md:hidden h-[100dvh] bg-white overflow-hidden fixed inset-0 z-50">
        {mobileListMode ? (
          <div className="h-full overflow-y-auto divide-y divide-gray-100">
            {chats.map((chat) => (
              <button
                type="button"
                key={chat.id}
                onClick={() => handleSelectChat(chat)}
                className="w-full text-left p-4 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-900 truncate">{chat.title}</p>
                  <span className="text-xs text-gray-500">{formatTime(chat.last_message_created_at)}</span>
                </div>
                <p className="text-sm text-gray-600 truncate mt-1">{chat.last_message_text || 'Нет сообщений'}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileListMode(true)}
                className="text-gray-600 hover:text-gray-900"
              >
                ←
              </button>
              <h3 className="font-semibold text-gray-900 truncate">{selectedChat?.title || 'Чат Авито'}</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              {messages.map((message) => {
                const isOwn = String(message.sender_id) === String(user?.id);
                return (
                  <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2`}>
                    <div className={`max-w-xs px-4 py-2 rounded-2xl ${isOwn ? 'bg-blue-600 text-white' : 'bg-white shadow-sm'}`}>
                      <p className="text-sm break-words">{message.message || ''}</p>
                      <p className={`text-xs mt-1 ${isOwn ? 'text-blue-100' : 'text-gray-500'}`}>{formatTime(message.created_at)}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 bg-white flex gap-2">
              <input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Введите сообщение..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-full"
              />
              <button
                type="submit"
                disabled={sending || !newMessage.trim()}
                className="px-5 py-2 bg-blue-600 text-white rounded-full disabled:bg-gray-300"
              >
                Отправить
              </button>
            </form>
          </div>
        )}
      </div>

      <div className="hidden md:flex h-[calc(100vh-200px)] bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="w-96 border-r border-gray-200 overflow-y-auto">
          {loading && chats.length === 0 ? (
            <div className="p-6 text-sm text-gray-500">Загрузка чатов Avito...</div>
          ) : chats.length === 0 ? (
            <div className="p-6 text-sm text-gray-500">Чаты Avito не найдены.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {chats.map((chat) => {
                const isSelected = String(chat.id) === String(selectedChatId);
                return (
                  <button
                    type="button"
                    key={chat.id}
                    onClick={() => handleSelectChat(chat)}
                    className={`w-full text-left p-4 ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900 truncate">{chat.title}</h3>
                      <span className="text-xs text-gray-500 ml-2">{formatTime(chat.last_message_created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-600 truncate mt-1">{chat.last_message_text || 'Нет сообщений'}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col">
          {selectedChat ? (
            <>
              <div className="p-4 border-b border-gray-200 bg-white">
                <h3 className="font-semibold text-gray-900 truncate">{selectedChat.title}</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                {messages.map((message) => {
                  const isOwn = String(message.sender_id) === String(user?.id);
                  return (
                    <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2`}>
                      <div className={`max-w-md px-4 py-2 rounded-2xl ${isOwn ? 'bg-blue-600 text-white rounded-br-md' : 'bg-white text-gray-900 shadow-sm rounded-bl-md'}`}>
                        <p className="text-sm break-words">{message.message || ''}</p>
                        <p className={`text-xs mt-1 ${isOwn ? 'text-blue-100' : 'text-gray-500'}`}>{formatTime(message.created_at)}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
              <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 bg-white flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Введите сообщение..."
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim()}
                  className="px-6 py-2.5 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:bg-gray-300"
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
