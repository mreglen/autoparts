import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiAxios, apiAxiosUnauth } from '../../utils/apiClient';
import { useAuthReady } from '../../hooks/useAuthReady';
import { usePermissionCodes } from '../../hooks/useWarehousePermissions';
import {
  resolvePathFromLabelResolve,
  resolvePublicPartPath,
} from '../../utils/resolveProductQrScan';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';

/**
 * Stable label QR landing: /qr/label/{internal_code}
 * Seller of org → /seller/part-card/; others (incl. guests) → /part/...
 */
export default function LabelQrResolvePage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { isReady, isAuthenticated, user } = useAuthReady();
  const permissionCodes = usePermissionCodes();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isReady) return undefined;

    let cancelled = false;
    const raw = decodeURIComponent(code || '').trim();
    if (!raw) {
      setError('В QR нет внутреннего кода');
      return undefined;
    }

    (async () => {
      try {
        const client = isAuthenticated ? apiAxios : apiAxiosUnauth;
        const response = await client.get(
          `/products/label-resolve/${encodeURIComponent(raw)}`,
        );
        if (cancelled) return;

        const data = response.data || {};

        if (data.type === 'product' && data.product_id != null) {
          if (isAuthenticated) {
            const routed = await resolvePathFromLabelResolve(
              data,
              user,
              permissionCodes,
            );
            if (cancelled) return;
            if (routed?.path) {
              navigate(routed.path, { replace: true });
              return;
            }
          }
          const publicPath = await resolvePublicPartPath(data.product_id);
          if (cancelled) return;
          if (publicPath) {
            navigate(publicPath, { replace: true });
            return;
          }
          setError('Запчасть не найдена');
          return;
        }

        if (!isAuthenticated) {
          navigate('/auth', {
            replace: true,
            state: { from: `/qr/label/${encodeURIComponent(code || '')}` },
          });
          return;
        }

        const routed = await resolvePathFromLabelResolve(
          data,
          user,
          permissionCodes,
        );
        if (cancelled) return;
        if (!routed?.path) {
          setError(routed?.message || 'Запчасть не найдена');
          return;
        }
        navigate(routed.path, { replace: true });
      } catch (err) {
        if (cancelled) return;
        const status = err?.response?.status;
        if (status === 401 || (!isAuthenticated && status !== 404)) {
          navigate('/auth', {
            replace: true,
            state: { from: `/qr/label/${encodeURIComponent(code || '')}` },
          });
          return;
        }
        setError('Запчасть не найдена. Перепечатайте этикетку после модерации.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isReady, isAuthenticated, code, navigate, user, permissionCodes]);

  if (!isReady) return <AuthLoadingScreen />;

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center max-lg:pb-[var(--sg-mobile-bottom-nav-total,4.5rem)]">
        <h1 className="text-xl font-semibold text-gray-900">Запчасть не найдена</h1>
        <p className="mt-2 text-sm text-gray-600">{error}</p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <Link
            to="/warehouse/scan"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Открыть сканер
          </Link>
          <Link to="/my-parts" className="text-sm text-indigo-600 hover:underline">
            К моим запчастям
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10 text-center text-sm text-gray-600">
      Открываем карточку…
    </div>
  );
}
