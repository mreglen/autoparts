import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import SeoTab from './analytics/SeoTab';

export default function SeoPage() {
  const { isReady, user, isAuthenticated } = useAuthReady();

  if (!isReady) return <AuthLoadingScreen />;
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  if (!user.is_admin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="mx-auto max-w-7xl space-y-4 max-lg:pb-[var(--sg-mobile-bottom-nav-total,4.5rem)]">
      <div className="md:hidden rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        SEO-инструменты и таблицы — рекомендуем на экране ≥1024px (desktop).
      </div>

      <header className="sticky top-0 z-10 -mx-1 border-b border-gray-100 bg-white/95 px-1 pb-4 pt-1 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <h1 className="text-xl font-bold text-gray-900">SEO</h1>
      </header>

      <SeoTab />
    </div>
  );
}
