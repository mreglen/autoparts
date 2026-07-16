import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiAxios } from '../../utils/apiClient';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';

/**
 * Stable label QR landing: /qr/label/{internal_code}
 * Resolves to seller part-card, edit-pending, or resubmit.
 */
export default function LabelQrResolvePage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { isReady, isAuthenticated } = useAuthReady();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isReady) return undefined;
    if (!isAuthenticated) {
      navigate('/auth', {
        replace: true,
        state: { from: `/qr/label/${encodeURIComponent(code || '')}` },
      });
      return undefined;
    }

    let cancelled = false;
    const raw = decodeURIComponent(code || '').trim();
    if (!raw) {
      setError('В QR нет внутреннего кода');
      return undefined;
    }

    (async () => {
      try {
        const response = await apiAxios.get(
          `/products/label-resolve/${encodeURIComponent(raw)}`,
        );
        const path = response.data?.path;
        if (!path) {
          if (!cancelled) setError('Запчасть не найдена');
          return;
        }
        if (!cancelled) navigate(path, { replace: true });
      } catch (_) {
        if (!cancelled) setError('Запчасть не найдена. Перепечатайте этикетку после модерации.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isReady, isAuthenticated, code, navigate]);

  if (!isReady) return <AuthLoadingScreen />;

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center">
        <h1 className="text-xl font-semibold text-gray-900">Запчасть не найдена</h1>
        <p className="mt-2 text-sm text-gray-600">{error}</p>
        <Link to="/my-parts" className="mt-6 inline-block text-indigo-600 hover:underline">
          К моим запчастям
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10 text-center text-sm text-gray-600">
      Открываем карточку…
    </div>
  );
}
