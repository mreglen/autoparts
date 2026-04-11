import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import ChatPage from './ChatPage';
import AvitoChatPage from './AvitoChatPage';
import { fetchAvitoMessengerEnabled } from '../../redux/slices/AvitoChatSlice';

const ChatsHubPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useSelector((state) => state.auth);

  /** Вкладка «Чат Авито» видна всем авторизованным пользователям; доступ к API — по флагу enabled внутри страницы. */
  const showAvitoTabs = Boolean(user);

  useEffect(() => {
    if (!user) return;
    dispatch(fetchAvitoMessengerEnabled());
  }, [dispatch, user]);

  const activeTab = showAvitoTabs ? (searchParams.get('tab') === 'avito' ? 'avito' : 'garage') : 'garage';

  const switchTab = (tab) => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'garage') {
      next.delete('tab');
      next.delete('avitoChatId');
    } else {
      next.set('tab', 'avito');
    }
    setSearchParams(next);
    if (location.pathname !== '/chats') {
      navigate('/chats');
    }
  };

  return (
    <div className="space-y-4">
      {showAvitoTabs && (
        <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
          <button
            type="button"
            onClick={() => switchTab('garage')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'garage'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Чат свой гараж
          </button>
          <button
            type="button"
            onClick={() => switchTab('avito')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'avito'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Чат Авито
          </button>
        </div>
      )}

      {activeTab === 'avito' ? (
        <AvitoChatPage />
      ) : (
        <ChatPage />
      )}
    </div>
  );
};

export default ChatsHubPage;
