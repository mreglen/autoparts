// src/layouts/MainLayout.jsx
import { Outlet } from 'react-router-dom';
import Navigation from '../pages/Navigation/Navigation';

export default function MainLayout() {
    return (
        <div className="min-h-screen bg-gray-50">
            <Navigation />
            <main className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-7 py-6 sm:py-8">
                <Outlet />
            </main>
        </div>
    );
}