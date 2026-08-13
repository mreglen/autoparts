import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { apiAxios } from '../../utils/apiClient';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import { SkeletonListCards } from '../../components/UI';
import { subscribeToPushNotifications } from '../../redux/slices/ChatSlice';
import { fetchSalesMenuCounts } from '../../redux/slices/SalesMenuCountsSlice';
import {
  AVITO_RETURN_STATUS_LABELS,
  SELLER_NEXT_STATUSES,
  getReturnReasonLabel,
  getReturnStatusColor,
  getReturnStatusLabel,
} from '../../utils/returnStatusUi';

function SiteReturnCard({ item, onStatusChange }) {
  const [status, setStatus] = useState(item.status_code);
  const [sellerNote, setSellerNote] = useState('');
  const [saving, setSaving] = useState(false);

  const nextOptions = SELLER_NEXT_STATUSES[item.status_code] || [];

  const handleSave = async () => {
    setSaving(true);
    try {
      await onStatusChange(item.id, status, sellerNote);
    } finally {
      setSaving(false);
    }
  };

  const order = item.order;

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <p className="text-xs text-gray-500">Заявка №{item.id} · Заказ №{item.order_id}</p>
          <p className="font-semibold text-gray-900">{getReturnReasonLabel(item.reason)}</p>
          {order && (
            <p className="text-sm text-gray-600 mt-1">
              {order.buyer_name} · {order.buyer_phone}
            </p>
          )}
        </div>
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ring-1 ${getReturnStatusColor(item.status_code)}`}>
          {getReturnStatusLabel(item.status_code)}
        </span>
      </div>
      {item.comment && <p className="mt-2 text-sm text-gray-700">{item.comment}</p>}
      {item.attachments?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.attachments.map((a) => (
            <a key={a.id} href={a.file_url} target="_blank" rel="noreferrer">
              <img src={a.file_url} alt="" className="h-14 w-14 rounded object-cover border" />
            </a>
          ))}
        </div>
      )}
      {nextOptions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value={item.status_code}>{getReturnStatusLabel(item.status_code)} (текущий)</option>
            {nextOptions.map((s) => (
              <option key={s} value={s}>{getReturnStatusLabel(s)}</option>
            ))}
          </select>
          {(status === 'rejected' || sellerNote) && (
            <textarea
              value={sellerNote}
              onChange={(e) => setSellerNote(e.target.value)}
              placeholder="Комментарий продавца (обязателен при отклонении)"
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          )}
          {status !== item.status_code && (
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Сохранение…' : 'Обновить статус'}
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function AvitoReturnCard({ order, onAcceptReturn, onTransition }) {
  const [terminal, setTerminal] = useState('');
  const [transition, setTransition] = useState('');
  const [busy, setBusy] = useState(false);

  const statusLabel = AVITO_RETURN_STATUS_LABELS[order.avito_status_code] || order.avito_status_code;

  return (
    <article className="rounded-2xl border border-orange-200 bg-orange-50/30 p-4">
      <div className="flex flex-wrap justify-between gap-2">
        <div>
          <p className="text-xs text-gray-500">Avito · ID {order.avito_order_id}</p>
          <p className="font-semibold text-gray-900">{Number(order.total_amount || 0).toLocaleString('ru-RU')} ₽</p>
        </div>
        <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-800">{statusLabel}</span>
      </div>
      <div className="mt-4 space-y-2">
        <input
          type="text"
          value={terminal}
          onChange={(e) => setTerminal(e.target.value)}
          placeholder="Номер отделения Почты России"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={busy || !terminal.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              await onAcceptReturn(order.id, terminal.trim());
            } finally {
              setBusy(false);
            }
          }}
          className="rounded-lg bg-orange-600 px-4 py-2 text-sm text-white hover:bg-orange-700 disabled:opacity-50"
        >
          Принять возврат (Почта России)
        </button>
        <div className="flex gap-2">
          <select
            value={transition}
            onChange={(e) => setTransition(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Transition…</option>
            <option value="in_transit_return">in_transit_return</option>
            <option value="on_delivery_return">on_delivery_return</option>
            <option value="returned">returned</option>
          </select>
          <button
            type="button"
            disabled={busy || !transition}
            onClick={async () => {
              setBusy(true);
              try {
                await onTransition(order.id, transition);
              } finally {
                setBusy(false);
              }
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            Применить
          </button>
        </div>
      </div>
    </article>
  );
}

export default function SalesReturnsPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isReady } = useAuthReady();
  const { user, permissionCodes } = useSelector((state) => state.auth);
  const [loading, setLoading] = useState(true);
  const [siteReturns, setSiteReturns] = useState([]);
  const [avitoReturns, setAvitoReturns] = useState([]);
  const [error, setError] = useState(null);

  const hasPermission = user?.is_admin || user?.is_seller
    || (user?.is_employee && permissionCodes?.includes('sales.returns'));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [siteRes, avitoRes] = await Promise.allSettled([
        apiAxios.get('/sales/returns'),
        apiAxios.get('/sales/avito-orders/returns'),
      ]);
      setSiteReturns(siteRes.status === 'fulfilled' ? (siteRes.value.data || []) : []);
      setAvitoReturns(avitoRes.status === 'fulfilled' ? (avitoRes.value.data || []) : []);
    } catch {
      setError('Не удалось загрузить возвраты');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isReady) return;
    if (user && !hasPermission) navigate('/', { replace: true });
  }, [isReady, user, hasPermission, navigate]);

  useEffect(() => {
    if (!hasPermission) return;
    dispatch(subscribeToPushNotifications({ prompt: true }));
  }, [dispatch, hasPermission]);

  useEffect(() => {
    if (isReady && hasPermission) load();
  }, [isReady, hasPermission, load]);

  const handleStatusChange = async (returnId, statusCode, sellerNote) => {
    await apiAxios.patch(`/sales/returns/${returnId}/status`, {
      status_code: statusCode,
      seller_note: sellerNote || null,
    });
    dispatch(fetchSalesMenuCounts());
    load();
  };

  const handleAvitoAccept = async (orderId, terminal) => {
    await apiAxios.post(`/sales/avito-orders/${orderId}/accept-return`, {
      terminal_number: terminal,
    });
    alert('Запрос на принятие возврата отправлен в Avito');
    load();
  };

  const handleAvitoTransition = async (orderId, transition) => {
    await apiAxios.post(`/sales/avito-orders/${orderId}/transition`, { transition });
    load();
  };

  if (!isReady) return <AuthLoadingScreen />;
  if (!hasPermission) return null;

  return (
    <div className="mt-4 sm:mt-5 px-4 sm:px-0 pb-10 space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Возвраты</h1>
        <p className="mt-1 text-sm text-gray-600">Заявки покупателей и возвраты Avito</p>
      </div>

      {error && <p className="text-red-600">{error}</p>}

      {loading ? (
        <SkeletonListCards count={3} />
      ) : (
        <>
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">Заявки с сайта</h2>
            {siteReturns.length === 0 && (
              <p className="text-sm text-gray-500">Нет заявок на возврат</p>
            )}
            <div className="space-y-4">
              {siteReturns.map((item) => (
                <SiteReturnCard key={item.id} item={item} onStatusChange={handleStatusChange} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-3">Avito</h2>
            {avitoReturns.length === 0 && (
              <p className="text-sm text-gray-500">Нет заказов Avito в статусе возврата</p>
            )}
            <div className="space-y-4">
              {avitoReturns.map((order) => (
                <AvitoReturnCard
                  key={order.id}
                  order={order}
                  onAcceptReturn={handleAvitoAccept}
                  onTransition={handleAvitoTransition}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
