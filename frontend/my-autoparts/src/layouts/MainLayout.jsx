// src/layouts/MainLayout.jsx
import { Outlet, useLocation } from 'react-router-dom';
import Navigation from '../pages/Navigation/Navigation';
import MobileBottomNav from '../components/MobileBottomNav/MobileBottomNav';

export default function MainLayout() {
    const location = useLocation();
    // Detect if we're in a specific chat (not just the chat list)
    const isSpecificChatPage = /^\/chats\/\d+/.test(location.pathname);
    
    return (
        <div className={`min-h-screen bg-gray-50 ${!isSpecificChatPage ? 'pb-24 md:pb-0' : 'pb-0'}`}>
            {!isSpecificChatPage && <Navigation />}
            <main className={`mx-auto ${isSpecificChatPage ? 'max-w-full p-0' : 'max-w-7xl px-3 sm:px-1 lg:px-2 py-6 sm:py-8'}`}>
                <Outlet />
            </main>
            {!isSpecificChatPage && <MobileBottomNav />}
        </div>
    );
}