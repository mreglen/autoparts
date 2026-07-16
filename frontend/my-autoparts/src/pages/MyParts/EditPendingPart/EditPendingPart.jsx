import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AddPart from '../AddPart/AddPart';
import AuthLoadingScreen from '../../../components/AuthLoadingScreen/AuthLoadingScreen';
import { apiAxios, apiAxiosUnauth } from '../../../utils/apiClient';
import { useAuthReady } from '../../../hooks/useAuthReady';
import { usePermissionCodes } from '../../../hooks/useWarehousePermissions';
import {
  resolvePathFromLabelResolve,
  resolvePublicPartPath,
} from '../../../utils/resolveProductQrScan';

/**
 * Legacy label QR lands here: /my-parts/edit-pending/{pendingId}
 * Resolve first → seller part-card / public /part/ / or edit form if still pending.
 */
const EditPendingPart = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isReady, isAuthenticated, user } = useAuthReady();
  const permissionCodes = usePermissionCodes();
  const [mode, setMode] = useState('loading'); // loading | form | error
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isReady) return undefined;

    const pendingId = Number(id);
    if (!Number.isFinite(pendingId) || pendingId <= 0) {
      setError('Некорректная ссылка этикетки');
      setMode('error');
      return undefined;
    }

    let cancelled = false;

    (async () => {
      try {
        const client = isAuthenticated ? apiAxios : apiAxiosUnauth;
        const response = await client.get(`/products/label-resolve-pending/${pendingId}`);
        if (cancelled) return;

        const data = response.data || {};

        if (data.type === 'product' && data.product_id != null) {
          if (isAuthenticated) {
            const routed = await resolvePathFromLabelResolve(data, user, permissionCodes);
            if (cancelled) return;
            if (routed?.path && routed.path !== `/my-parts/edit-pending/${pendingId}`) {
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
          setError('Товар найден, но публичная карточка недоступна');
          setMode('error');
          return;
        }

        if (data.type === 'pending') {
          if (!isAuthenticated) {
            navigate('/auth', {
              replace: true,
              state: { from: `/my-parts/edit-pending/${pendingId}` },
            });
            return;
          }
          const routed = await resolvePathFromLabelResolve(data, user, permissionCodes);
          if (cancelled) return;
          if (routed?.mode === 'pending') {
            setMode('form');
            return;
          }
          setError(routed?.message || 'Заявка на модерации доступна только организации продавца');
          setMode('error');
          return;
        }

        if (data.type === 'rejected') {
          if (!isAuthenticated) {
            navigate('/auth', {
              replace: true,
              state: { from: `/my-parts/edit-pending/${pendingId}` },
            });
            return;
          }
          const routed = await resolvePathFromLabelResolve(data, user, permissionCodes);
          if (cancelled) return;
          if (routed?.path) {
            navigate(routed.path, { replace: true });
            return;
          }
        }

        setError('Запчасть не найдена');
        setMode('error');
      } catch (err) {
        if (cancelled) return;
        const status = err?.response?.status;
        if (status === 401 || (!isAuthenticated && status !== 404)) {
          navigate('/auth', {
            replace: true,
            state: { from: `/my-parts/edit-pending/${pendingId}` },
          });
          return;
        }
        setError(
          'Заявка не найдена. Возможно, запчасть уже одобрена — перепечатайте этикетку или откройте товар в «Мои запчасти».',
        );
        setMode('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isReady, isAuthenticated, id, navigate, user, permissionCodes]);

  if (!isReady || mode === 'loading') {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <AuthLoadingScreen />
        <p className="mt-4 text-center text-sm text-gray-500">Открываем карточку по этикетке…</p>
      </div>
    );
  }

  if (mode === 'form') {
    return <AddPart editPendingMode />;
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10 text-center">
      <h1 className="text-xl font-semibold text-gray-900">Запчасть не найдена</h1>
      <p className="mt-2 text-sm text-gray-600">{error}</p>
      <Link to="/my-parts" className="mt-6 inline-block text-indigo-600 hover:underline">
        К моим запчастям
      </Link>
    </div>
  );
};

export default EditPendingPart;
