import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import { apiRequest } from '../../utils/apiClient';
import { selectIsAutoserviceClient } from '../../redux/slices/AutoserviceClientSlice';

const inputClass =
  'mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20';

const STATUS_LABELS = {
  new: 'Новая',
  processed: 'Обработана',
  cancelled: 'Отменена',
};

function todayIso() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return '—';
  const parts = String(value).slice(0, 10).split('-');
  if (parts.length !== 3) return value;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

export default function AutoserviceRepairBookingPage() {
  const navigate = useNavigate();
  const { isReady, isAuthenticated } = useAuthReady();
  const user = useSelector((state) => state.auth.user);
  const isClient = useSelector(selectIsAutoserviceClient);
  const clientStatus = useSelector((state) => state.autoserviceClient.status);
  const client = useSelector((state) => state.autoserviceClient.client);

  const defaultName = useMemo(() => {
    if (client?.name) return client.name;
    return [user?.first_name, user?.last_name].filter(Boolean).join(' ');
  }, [client?.name, user?.first_name, user?.last_name]);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [preferredDate, setPreferredDate] = useState(todayIso());
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [rowsLoading, setRowsLoading] = useState(false);

  useEffect(() => {
    setName(defaultName);
  }, [defaultName]);

  useEffect(() => {
    setPhone(client?.phone || user?.phone || '');
  }, [client?.phone, user?.phone]);

  useEffect(() => {
    if (isReady && isAuthenticated && clientStatus === 'succeeded' && !isClient) {
      navigate('/autoservice/welcome', { replace: true });
    }
  }, [isReady, isAuthenticated, clientStatus, isClient, navigate]);

  const loadBookings = useCallback(async () => {
    setRowsLoading(true);
    try {
      const data = await apiRequest('/autoservice/repair-bookings/me');
      setRows(Array.isArray(data) ? data : []);
    } catch {
      setRows([]);
    } finally {
      setRowsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isReady && isAuthenticated && isClient) loadBookings();
  }, [isReady, isAuthenticated, isClient, loadBookings]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (!preferredDate) {
      setError('Укажите желаемую дату');
      return;
    }
    setSaving(true);
    try {
      const row = await apiRequest('/autoservice/repair-bookings', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim() || null,
          phone: phone.trim() || null,
          preferred_date: preferredDate,
          comment: comment.trim() || null,
        }),
      });
      setRows((prev) => [row, ...prev]);
      setComment('');
    } catch (err) {
      setError(err?.message || 'Не удалось отправить заявку');
    } finally {
      setSaving(false);
    }
  };

  if (!isReady) return <AuthLoadingScreen />;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Запись на ремонт</h1>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4 rounded-lg border border-gray-200 bg-white p-5">
        <div>
          <label htmlFor="booking-name" className="block text-sm font-medium text-gray-700">
            Имя
          </label>
          <input
            id="booking-name"
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            disabled={saving}
          />
        </div>
        <div>
          <label htmlFor="booking-phone" className="block text-sm font-medium text-gray-700">
            Телефон
          </label>
          <input
            id="booking-phone"
            className={inputClass}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={40}
            disabled={saving}
          />
        </div>
        <div>
          <label htmlFor="booking-date" className="block text-sm font-medium text-gray-700">
            Желаемая дата
          </label>
          <input
            id="booking-date"
            type="date"
            className={inputClass}
            value={preferredDate}
            min={todayIso()}
            onChange={(e) => setPreferredDate(e.target.value)}
            disabled={saving}
          />
        </div>
        <div>
          <label htmlFor="booking-comment" className="block text-sm font-medium text-gray-700">
            Что нужно сделать
          </label>
          <textarea
            id="booking-comment"
            className={inputClass}
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={2000}
            disabled={saving}
          />
        </div>

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between">
          <Link to="/garage" className="text-sm text-indigo-600 hover:underline">
            Мои авто
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? 'Отправка…' : 'Отправить заявку'}
          </button>
        </div>
      </form>

      <h2 className="mt-8 text-sm font-semibold text-gray-900">Мои заявки</h2>
      <div className="mt-2 space-y-2">
        {rowsLoading ? (
          <p className="text-sm text-gray-500">Загрузка…</p>
        ) : rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">
            Заявок пока нет
          </p>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium text-gray-900">{formatDate(row.preferred_date)}</p>
                {row.comment && <p className="mt-0.5 truncate text-gray-600">{row.comment}</p>}
              </div>
              <span className="shrink-0 text-gray-500">
                {STATUS_LABELS[row.status] || row.status}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
