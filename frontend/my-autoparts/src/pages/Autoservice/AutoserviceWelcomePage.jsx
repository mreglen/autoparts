import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import { apiRequest, apiRequestUnauth } from '../../utils/apiClient';
import { BECOME_CLIENT_CONFIRM } from '../../utils/autoservicePublic';
import { AUTOSERVICE_PUBLIC_NAME } from '../../utils/autoserviceConstants';
import {
  fetchAutoserviceClientMe,
  selectIsAutoserviceClient,
} from '../../redux/slices/AutoserviceClientSlice';

export default function AutoserviceWelcomePage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isReady, isAuthenticated } = useAuthReady();
  const isClient = useSelector(selectIsAutoserviceClient);
  const clientStatus = useSelector((state) => state.autoserviceClient.status);

  const [info, setInfo] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadInfo = useCallback(async () => {
    try {
      const data = await apiRequestUnauth('/public/autoservice/info');
      setInfo(data || null);
    } catch {
      setInfo(null);
    }
  }, []);

  useEffect(() => {
    loadInfo();
  }, [loadInfo]);

  useEffect(() => {
    if (isReady && isAuthenticated && isClient) {
      navigate('/garage', { replace: true });
    }
  }, [isReady, isAuthenticated, isClient, navigate]);

  const serviceName = info?.name || AUTOSERVICE_PUBLIC_NAME;

  const handleBecomeClient = async () => {
    setError('');
    if (!window.confirm(BECOME_CLIENT_CONFIRM(serviceName))) return;
    setSaving(true);
    try {
      await apiRequest('/autoservice/clients/me', { method: 'POST' });
      await dispatch(fetchAutoserviceClientMe());
      navigate('/garage', { replace: true });
    } catch (err) {
      setError(err?.message || 'Не удалось стать клиентом');
    } finally {
      setSaving(false);
    }
  };

  if (!isReady) return <AuthLoadingScreen />;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">{serviceName}</h1>

      <div className="mt-4 rounded-lg border border-gray-200 bg-white p-5">
        {info?.description ? (
          <p className="text-sm text-gray-700">{info.description}</p>
        ) : (
          <p className="text-sm text-gray-700">
            Станьте клиентом, чтобы хранить свои автомобили, записываться на ремонт и видеть историю работ.
          </p>
        )}

        {(info?.address || info?.phone) && (
          <p className="mt-3 text-sm text-gray-500">
            {[info.address, info.phone].filter(Boolean).join(' · ')}
          </p>
        )}

        {error && (
          <p className="mt-4 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleBecomeClient}
          disabled={saving || clientStatus === 'loading' || !isAuthenticated}
          className="mt-5 inline-flex rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {saving ? 'Сохранение…' : 'Стать клиентом'}
        </button>
      </div>
    </div>
  );
}
