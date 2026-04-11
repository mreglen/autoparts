import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import ChatPage from './ChatPage';
import AvitoChatPage from './AvitoChatPage';
import {
  connectWebSocket,
  disconnectWebSocket,
  subscribeToPushNotifications,
} from '../../redux/slices/ChatSlice';
import { fetchAvitoMessengerEnabled } from '../../redux/slices/AvitoChatSlice';

const ChatsHubPage = () => {
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const { user } = useSelector((state) => state.auth);
  const avitoChatId = searchParams.get('avitoChatId');

  useEffect(() => {
    if (!user) return;
    dispatch(fetchAvitoMessengerEnabled());
  }, [dispatch, user]);

  return (
    <div className="max-md:fixed max-md:inset-0 max-md:z-[60] max-md:flex max-md:flex-col max-md:bg-white max-md:pt-[env(safe-area-inset-top,0px)] space-y-4 md:static md:z-auto md:inset-auto md:bg-transparent md:pt-0">
      <div className="max-md:flex max-md:min-h-0 max-md:flex-1 max-md:flex-col md:block">
        {avitoChatId ? (
          <AvitoChatPage fillMobileHub />
        ) : (
          <ChatPage fillMobileHub />
        )}
      </div>
    </div>
  );
};

export default ChatsHubPage;
