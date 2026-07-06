import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiAxios, apiRequestFormData } from '../../utils/apiClient';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import {
  RETURN_REASONS,
  TERMINAL_RETURN_STATUSES,
  getReturnReasonLabel,
  getReturnStatusColor,
  getReturnStatusLabel,
  isUsedOrderReturnEligible,
} from '../../utils/returnStatusUi';

const MAX_PHOTOS = 5;

function ReturnCreateModal({ orders, activeOrderIds, initialOrderId, onClose, onCreated }) {
  const [orderId, setOrderId] = useState(initialOrderId ? String(initialOrderId) : '');
  const [reason, setReason] = useState('defect');
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const eligibleOrders = useMemo(
    () => orders.filter(
      (o) => isUsedOrderReturnEligible(o) && !activeOrderIds.has(o.id),
    ),
    [orders, activeOrderIds],
  );

  useEffect(() => {
    if (!orderId && eligibleOrders.length) {
      setOrderId(String(eligibleOrders[0].id));
    }
  }, [eligibleOrders, orderId]);

  const handlePhotoAdd = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setPhotos((prev) => [...prev, ...files].slice(0, MAX_PHOTOS));
    e.target.value = '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!orderId) {
      setError('Выберите заказ');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const photoUrls = [];
      for (const file of photos) {
        const fd = new FormData();
        fd.append('file', file);
        const uploaded = await apiRequestFormData('/upload/media', fd);
        const url = uploaded?.path || uploaded?.url || uploaded?.photo_url;
        if (url) photoUrls.push(url.startsWith('/') ? url : `/${url}`);
      }

      const { data } = await apiAxios.post('/sales/purchases/returns', {
        order_id: Number(orderId),
        reason,
        comment: comment.trim() || null,
        photo_urls: photoUrls,
      });
      onCreated(data);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Не удалось создать заявку');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-gray-900">Заявка на возврат</h2>
        <p className="mt-1 text-sm text-gray-600">Только для б/у заказов с сайта (до 14 дней после получения).</p>

        {eligibleOrders.length === 0 ? (
          <p className="mt-4 text-sm text-amber-700">Нет заказов, доступных для возврата.</p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Заказ</label>
              <select
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                {eligibleOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    №{o.id} · {o.organization_name} · {Number(o.total_amount || 0).toLocaleString('ru-RU')} ₽
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Причина</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                {RETURN_REASONS.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Комментарий</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
                placeholder="Опишите проблему"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Фото (до {MAX_PHOTOS})</label>
              <input type="file" accept="image/*" multiple onChange={handlePhotoAdd} className="text-sm" />
              {photos.length > 0 && (
                <p className="mt-1 text-xs text-gray-500">Выбрано: {photos.length}</p>
              )}
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300">
                Отмена
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {submitting ? 'Отправка…' : 'Отправить заявку'}
              </button>
            </div>
          </form>
        )}
        {eligibleOrders.length === 0 && (
          <button type="button" onClick={onClose} className="mt-4 px-4 py-2 rounded-lg border border-gray-300">
            Закрыть
          </button>
        )}
      </div>
    </div>
  );
}

function ReturnCard({ item }) {
  const order = item.order;
  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500">Заявка №{item.id} · Заказ №{item.order_id}</p>
          <p className="font-semibold text-gray-900">{getReturnReasonLabel(item.reason)}</p>
          {order?.organization_name && (
            <p className="text-sm text-gray-600 mt-1">{order.organization_name}</p>
          )}
        </div>
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ring-1 ${getReturnStatusColor(item.status_code)}`}>
          {getReturnStatusLabel(item.status_code)}
        </span>
      </div>
      {item.comment && (
        <p className="mt-3 text-sm text-gray-700">{item.comment}</p>
      )}
      {item.seller_note && (
        <p className="mt-2 text-sm text-gray-600">
          <span className="font-medium">Комментарий продавца:</span> {item.seller_note}
        </p>
      )}
      {item.attachments?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.attachments.map((a) => (
            <a key={a.id} href={a.file_url} target="_blank" rel="noreferrer" className="block">
              <img src={a.file_url} alt="" className="h-16 w-16 rounded-lg object-cover border" />
            </a>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-gray-400">
        Обновлено: {new Date(item.status_changed_at || item.updated_at).toLocaleString('ru-RU')}
      </p>
    </article>
  );
}

export default function PurchasesReturnsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isReady, isAuthenticated } = useAuthReady();
  const [loading, setLoading] = useState(true);
  const [returns, setReturns] = useState([]);
  const [usedOrders, setUsedOrders] = useState([]);
  const [showCreate, setShowCreate] = useState(searchParams.get('create') === '1');
  const initialOrderId = searchParams.get('orderId');
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [returnsRes, ordersRes] = await Promise.all([
        apiAxios.get('/sales/purchases/returns'),
        apiAxios.get('/sales/purchases/used-orders'),
      ]);
      setReturns(returnsRes.data || []);
      setUsedOrders(ordersRes.data || []);
    } catch (e) {
      setError('Не удалось загрузить возвраты');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated) navigate('/auth', { replace: true });
  }, [isReady, isAuthenticated, navigate]);

  useEffect(() => {
    if (isReady && isAuthenticated) load();
  }, [isReady, isAuthenticated, load]);

  const activeOrderIds = useMemo(() => {
    const ids = new Set();
    returns.forEach((r) => {
      if (!TERMINAL_RETURN_STATUSES.has(r.status_code)) ids.add(r.order_id);
    });
    return ids;
  }, [returns]);

  if (!isReady || !isAuthenticated) return <AuthLoadingScreen />;

  return (
    <div className="mt-4 sm:mt-5 px-4 sm:px-0 pb-10 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Возвраты</h1>
          <p className="mt-1 text-sm text-gray-600">Заявки на возврат б/у товаров с сайта</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Создать заявку
        </button>
      </div>

      <p className="text-sm text-gray-500 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
        Возвраты заказов Avito оформляются в приложении Avito. Здесь — только покупки б/у запчастей на сайте.
      </p>

      {loading && <AuthLoadingScreen />}
      {error && <p className="text-red-600">{error}</p>}

      {!loading && !error && returns.length === 0 && (
        <div className="text-center py-12 text-gray-500">Заявок на возврат пока нет</div>
      )}

      <div className="space-y-4">
        {returns.map((item) => (
          <ReturnCard key={item.id} item={item} />
        ))}
      </div>

      {showCreate && (
        <ReturnCreateModal
          orders={usedOrders}
          activeOrderIds={activeOrderIds}
          initialOrderId={initialOrderId}
          onClose={() => {
            setShowCreate(false);
            setSearchParams({});
          }}
          onCreated={() => {
            setShowCreate(false);
            setSearchParams({});
            load();
          }}
        />
      )}
    </div>
  );
}
