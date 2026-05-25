import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../AuthLoadingScreen/AuthLoadingScreen';

/**
 * Доступ только для авторизованных пользователей.
 */
export default function RequireAuth({ children }) {
  const location = useLocation();
  const { isReady, user, token } = useAuthReady();

  if (!isReady) {
    return <AuthLoadingScreen className="min-h-[40vh]" />;
  }

  if (!token || !user) {
    const redirectTo = `${location.pathname}${location.search}`;
    return <Navigate to="/auth" replace state={{ from: redirectTo }} />;
  }

  return children;
}
