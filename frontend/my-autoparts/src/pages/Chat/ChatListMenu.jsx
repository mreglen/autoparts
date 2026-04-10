import React, { useState, useRef, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { blockUserInChat, unblockUserInChat } from '../../redux/slices/ChatSlice';
import ConfirmModal from '../../components/ConfirmModal';

const ChatListMenu = ({ chat, currentUserId, onClose }) => {
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
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);
  
  const handleBlock = async () => {
    await dispatch(blockUserInChat({ chatId: chat.id, userId: otherUserId }));
    onClose();
  };
  
  const handleUnblock = async () => {
    await dispatch(unblockUserInChat({ chatId: chat.id, userId: otherUserId }));
    onClose();
  };
  
  return (
    <div className="absolute right-0 top-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50" ref={menuRef}>
      {isBlocked ? (
        <button
          onClick={() => {
            setShowUnblockModal(true);
            onClose();
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
            onClose();
          }}
          className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-red-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
          </svg>
          <span className="text-sm font-medium">Заблокировать</span>
        </button>
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

export default ChatListMenu;
