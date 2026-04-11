import React, { useState, useRef, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { blockUserInChat, unblockUserInChat } from '../../redux/slices/ChatSlice';
import ConfirmModal from '../../components/ConfirmModal';

const ChatMenu = ({ chat, currentUserId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showUnblockModal, setShowUnblockModal] = useState(false);
  const menuRef = useRef(null);
  const dispatch = useDispatch();
  
  // Определить другого пользователя
  const otherUserId = currentUserId === chat.buyer_id ? chat.seller_id : chat.buyer_id;
  
  // Проверить заблокирован ли пользователь
  const isBlocked = chat.blocked_users_count > 0;
  
  // Закрыть меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const handleBlock = async () => {
    await dispatch(blockUserInChat({ chatId: chat.id, userId: otherUserId }));
    setIsOpen(false);
  };
  
  const handleUnblock = async () => {
    await dispatch(unblockUserInChat({ chatId: chat.id, userId: otherUserId }));
    setIsOpen(false);
  };
  
  return (
    <div className="relative" ref={menuRef}>
      {/* Кнопка три точки */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
      >
        <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
        </svg>
      </button>
      
      {/* Выпадающее меню */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
          {isBlocked ? (
            <button
              onClick={() => {
                setShowUnblockModal(true);
                setIsOpen(false);
              }}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-green-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/>
              </svg>
              <span className="text-sm font-medium">Разблокировать</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setShowBlockModal(true);
                setIsOpen(false);
              }}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-red-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
              </svg>
              <span className="text-sm font-medium">Заблокировать</span>
            </button>
          )}
        </div>
      )}
      
      {/* Модальное окно блокировки */}
      <ConfirmModal
        isOpen={showBlockModal}
        onClose={() => setShowBlockModal(false)}
        onConfirm={handleBlock}
        title="Заблокировать пользователя"
        message="Заблокированный пользователь не сможет отправлять сообщения в этом чате."
        confirmText="Заблокировать"
        type="danger"
      />
      
      {/* Модальное окно разблокировки */}
      <ConfirmModal
        isOpen={showUnblockModal}
        onClose={() => setShowUnblockModal(false)}
        onConfirm={handleUnblock}
        title="Разблокировать пользователя"
        message="Разблокированный пользователь сможет снова отправлять сообщения в этом чате."
        confirmText="Разблокировать"
        type="success"
      />
    </div>
  );
};

export default ChatMenu;
