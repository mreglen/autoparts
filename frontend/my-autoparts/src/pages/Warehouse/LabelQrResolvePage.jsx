import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiAxios } from '../../utils/apiClient';
import { useAuthReady } from '../../hooks/useAuthReady';
import { usePermissionCodes } from '../../hooks/useWarehousePermissions';
import { resolvePathFromLabelResolve } from '../../utils/resolveProductQrScan';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';

/**
 * Stable label QR landing: /qr/label/{internal_code}
 * Seller of org → /seller/part-card/; others → /part/...
 */
export default function LabelQrResolvePage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { isReady, isAuthenticated, user } = useAuthReady();
  const permissionCodes = usePermissionCodes();
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
        const routed = await resolvePathFromLabelResolve(
          response.data,
          user,
          permissionCodes,
        );
        if (cancelled) return;
        if (!routed?.path) {
          setError(routed?.message || 'Запчасть не найдена');
          return;
        }
        navigate(routed.path, { replace: true });
      } catch (_) {
        if (!cancelled) {
          setError('Запчасть не найдена. Перепечатайте этикетку после модерации.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isReady, isAuthenticated, code, navigate, user, permissionCodes]);

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
