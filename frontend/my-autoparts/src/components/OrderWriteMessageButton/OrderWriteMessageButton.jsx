import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { createOrGetChat, createOrGetChatWithUser } from '../../redux/slices/ChatSlice';

function ChatIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );
}

export default function OrderWriteMessageButton({
  label = 'Написать',
  targetUserId,
  productId,
  avitoChatId,
  className = '',
}) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const [loading, setLoading] = useState(false);

  const hasAvitoChat = Boolean(avitoChatId);
  const hasGarageTarget = Boolean(targetUserId) || Boolean(productId);

  if (!hasAvitoChat && !hasGarageTarget) {
    return null;
  }

  if (targetUserId && user?.id && Number(targetUserId) === Number(user.id)) {
    return null;
  }

  const handleClick = async (e) => {
    e.stopPropagation();
    e.preventDefault();

    if (hasAvitoChat) {
      const id = String(avitoChatId);
      navigate(`/chats?source=avito&chatId=${encodeURIComponent(id)}&avitoChatId=${encodeURIComponent(id)}`);
      return;
    }

    if (!user?.id) {
      navigate('/auth', { state: { from: window.location.pathname } });
      return;
    }

    setLoading(true);
    try {
      let chat;
      if (targetUserId) {
        chat = await dispatch(createOrGetChatWithUser(targetUserId)).unwrap();
      } else if (productId) {
        chat = await dispatch(
          createOrGetChat({
            buyer_id: user.id,
            seller_id: null,
            product_id: productId,
          }),
        ).unwrap();
      } else {
        return;
      }
      navigate(`/chats?source=garage&chatId=${chat.id}`);
    } catch (err) {
      const msg = typeof err === 'string' ? err : 'Не удалось открыть чат';
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50 disabled:opacity-60 ${className}`}
    >
      <ChatIcon />
      {loading ? 'Открываем…' : label}
    </button>
  );
}
