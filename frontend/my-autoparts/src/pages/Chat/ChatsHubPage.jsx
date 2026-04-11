import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import ChatPage from './ChatPage';
import AvitoChatPage from './AvitoChatPage';
import { fetchAvitoMessengerEnabled } from '../../redux/slices/AvitoChatSlice';
import {
  connectWebSocket,
  disconnectWebSocket,
  subscribeToPushNotifications,
} from '../../redux/slices/ChatSlice';

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

  /** WebSocket и push на уровне хаба: иначе при вкладке «Чат Авито» ChatPage размонтируется и WS отключается. */
  useEffect(() => {
    if (!user) return undefined;
    dispatch(connectWebSocket(user.id));
    return () => {
      dispatch(disconnectWebSocket());
    };
  }, [dispatch, user]);

  useEffect(() => {
    if (!user) return;
    dispatch(subscribeToPushNotifications());
  }, [dispatch, user]);

  const activeTab = showAvitoTabs ? (searchParams.get('tab') === 'avito' ? 'avito' : 'garage') : 'garage';

  /** На телефоне внутри переписки шапку «Чат свой гараж / Чат Авито» не показываем; в списке чатов — показываем. */
  const hideHubTabsOnMobile =
    (activeTab === 'garage' && /^\/chats\/\d+/.test(location.pathname)) ||
    (activeTab === 'avito' && Boolean(searchParams.get('avitoChatId')));

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

  const tabBar = showAvitoTabs ? (
    <div
      className={`flex flex-shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-2 py-2 md:px-0 md:pb-2 ${
        hideHubTabsOnMobile ? 'max-md:hidden' : ''
      }`}
    >
      <button
        type="button"
        onClick={() => switchTab('garage')}
        className={`min-w-0 flex-1 rounded-md px-3 py-2 text-center text-xs font-medium transition-colors sm:text-sm md:flex-none md:px-4 ${
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
        className={`min-w-0 flex-1 rounded-md px-3 py-2 text-center text-xs font-medium transition-colors sm:text-sm md:flex-none md:px-4 ${
          activeTab === 'avito'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
      >
        Чат Авито
      </button>
    </div>
  ) : null;

  return (
    <div className="max-md:fixed max-md:inset-0 max-md:z-[60] max-md:flex max-md:flex-col max-md:bg-white max-md:pt-[env(safe-area-inset-top,0px)] space-y-4 md:static md:z-auto md:inset-auto md:bg-transparent md:pt-0">
      {tabBar}
      <div className="max-md:flex max-md:min-h-0 max-md:flex-1 max-md:flex-col md:block">
        {activeTab === 'avito' ? <AvitoChatPage fillMobileHub /> : <ChatPage fillMobileHub />}
      </div>
    </div>
  );
};

export default ChatsHubPage;
