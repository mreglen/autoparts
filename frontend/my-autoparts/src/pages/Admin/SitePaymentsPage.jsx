import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import { apiRequest } from '../../utils/apiClient';

const inputClass =
  'block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20';

const STATUS_LABELS = {
  active: 'Активен',
  paused: 'На паузе',
  paid: 'Оплачен',
  cancelled: 'Отменён',
};

const STATUS_STYLES = {
  active: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  paused: 'bg-amber-50 text-amber-800 ring-amber-200',
  paid: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  cancelled: 'bg-gray-100 text-gray-600 ring-gray-200',
};

export function formatMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatDate(value) {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) {
    // date-only YYYY-MM-DD
    const parts = String(value).slice(0, 10).split('-');
    if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
    return String(value);
  }
  return d.toLocaleDateString('ru-RU');
}

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status] || STATUS_STYLES.active}`}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function Modal({ title, children, onClose, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Закрыть" onClick={onClose} />
      <div
        className={`relative max-h-[90vh] w-full overflow-y-auto rounded-2xl bg-white shadow-xl ring-1 ring-gray-200 ${
          wide ? 'max-w-2xl' : 'max-w-lg'
        }`}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Закрыть"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function CreatePaymentModal({ onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [mode, setMode] = useState('days'); // 'days' | 'end'
  const [durationDays, setDurationDays] = useState('30');
  const [endDate, setEndDate] = useState('');
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const preview = useMemo(() => {
    const monthly = Number(monthlyAmount);
    if (!Number.isFinite(monthly) || monthly <= 0 || !startDate) return null;
    let days = null;
    let end = null;
    if (mode === 'days') {
      days = parseInt(durationDays, 10);
      if (!Number.isFinite(days) || days < 1) return null;
      const start = new Date(`${startDate}T00:00:00`);
      const e = new Date(start);
      e.setDate(e.getDate() + days);
      end = e.toISOString().slice(0, 10);
    } else {
      if (!endDate) return null;
      const start = new Date(`${startDate}T00:00:00`);
      const e = new Date(`${endDate}T00:00:00`);
      days = Math.round((e - start) / 86400000);
      if (days < 1) days = 1;
      end = endDate;
    }
    const total = Math.round(monthly * (days / 30) * 100) / 100;
    return { days, end, total };
  }, [mode, durationDays, endDate, startDate, monthlyAmount]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const body = {
        title: title.trim(),
        start_date: startDate,
        monthly_amount: Number(monthlyAmount),
        comment: comment.trim() || null,
      };
      if (mode === 'days') {
        body.duration_days = parseInt(durationDays, 10);
      } else {
        body.end_date = endDate;
      }
      const row = await apiRequest('/admin/site-payments', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      onCreated(row);
      onClose();
    } catch (err) {
      setError(err?.message || 'Не удалось создать платёж');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Добавить платёж" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Название</label>
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Дата начала услуги</label>
          <input
            type="date"
            className={inputClass}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </div>
        <div>
          <span className="mb-2 block text-sm font-medium text-gray-700">Срок</span>
          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={() => setMode('days')}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ring-1 ${
                mode === 'days'
                  ? 'bg-indigo-50 text-indigo-800 ring-indigo-200'
                  : 'bg-white text-gray-600 ring-gray-200'
              }`}
            >
              Количество дней
            </button>
            <button
              type="button"
              onClick={() => setMode('end')}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ring-1 ${
                mode === 'end'
                  ? 'bg-indigo-50 text-indigo-800 ring-indigo-200'
                  : 'bg-white text-gray-600 ring-gray-200'
              }`}
            >
              Дата конца
            </button>
          </div>
          {mode === 'days' ? (
            <input
              type="number"
              min={1}
              className={inputClass}
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
              required
            />
          ) : (
            <input
              type="date"
              className={inputClass}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          )}
          {preview && (
            <p className="mt-2 text-xs text-gray-500">
              {mode === 'days'
                ? `Дата конца: ${formatDate(preview.end)}`
                : `Длительность: ${preview.days} дн.`}
              {' · '}
              Общая сумма ≈ {formatMoney(preview.total)}
            </p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Ежемесячная сумма, ₽</label>
          <input
            type="number"
            min={0.01}
            step="0.01"
            className={inputClass}
            value={monthlyAmount}
            onChange={(e) => setMonthlyAmount(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Комментарий</label>
          <textarea
            className={inputClass}
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? 'Создание…' : 'Создать'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function PayModal({ payment, onClose, onDone }) {
  const remaining = Number(payment.remaining_amount);
  const [amount, setAmount] = useState(String(remaining));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const row = await apiRequest(`/admin/site-payments/${payment.id}/pay`, {
        method: 'POST',
        body: JSON.stringify({ amount: Number(amount), note: note.trim() || null }),
      });
      onDone(row);
      onClose();
    } catch (err) {
      setError(err?.message || 'Не удалось записать оплату');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Оплата" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
        <p className="text-sm text-gray-600">
          {payment.title}: к оплате осталось <strong>{formatMoney(remaining)}</strong>
        </p>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Сумма</label>
          <input
            type="number"
            min={0.01}
            max={remaining}
            step="0.01"
            className={inputClass}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Комментарий (необязательно)</label>
          <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Отмена
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? 'Сохранение…' : 'Оплачено'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function PaymentDetailModal({ paymentId, onClose, onChanged }) {
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [payOpen, setPayOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const row = await apiRequest(`/admin/site-payments/${paymentId}`);
      setPayment(row);
    } catch (err) {
      setError(err?.message || 'Не удалось загрузить');
    } finally {
      setLoading(false);
    }
  }, [paymentId]);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async (action) => {
    if (action === 'cancel' && !window.confirm('Отменить этот платёж?')) return;
    setBusy(true);
    try {
      const row = await apiRequest(`/admin/site-payments/${paymentId}/${action}`, { method: 'POST' });
      setPayment(row);
      onChanged?.(row);
    } catch (err) {
      setError(err?.message || 'Ошибка действия');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Modal title="Детали платежа" onClose={onClose} wide>
        {loading && <p className="text-sm text-gray-500">Загрузка…</p>}
        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
        {payment && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="text-xl font-bold text-gray-900">{payment.title}</h4>
                <p className="mt-1 text-sm text-gray-500">
                  {formatDate(payment.start_date)} — {formatDate(payment.end_date)} ({payment.duration_days} дн.)
                </p>
              </div>
              <StatusBadge status={payment.status} />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-gray-50 p-3 ring-1 ring-gray-100">
                <p className="text-xs text-gray-500">Ежемесячно</p>
                <p className="mt-1 font-semibold text-gray-900">{formatMoney(payment.monthly_amount)}</p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3 ring-1 ring-gray-100">
                <p className="text-xs text-gray-500">Общая сумма</p>
                <p className="mt-1 font-semibold text-gray-900">{formatMoney(payment.total_amount)}</p>
              </div>
              <div className="rounded-xl bg-indigo-50 p-3 ring-1 ring-indigo-100">
                <p className="text-xs text-indigo-700">К оплате осталось</p>
                <p className="mt-1 font-semibold text-indigo-900">{formatMoney(payment.remaining_amount)}</p>
              </div>
            </div>

            {payment.comment && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Комментарий</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{payment.comment}</p>
              </div>
            )}

            {payment.ledger?.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-semibold text-gray-900">История внесений</p>
                <ul className="divide-y divide-gray-100 rounded-xl ring-1 ring-gray-100">
                  {payment.ledger.map((entry) => (
                    <li key={entry.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                      <div>
                        <p className="font-medium text-gray-900">{formatMoney(entry.amount)}</p>
                        {entry.note && <p className="text-xs text-gray-500">{entry.note}</p>}
                      </div>
                      <p className="shrink-0 text-xs text-gray-400">{formatDate(entry.created_at)}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
              {payment.status !== 'cancelled' && payment.status !== 'paid' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setPayOpen(true)}
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  Оплачено
                </button>
              )}
              {payment.status === 'active' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => runAction('pause')}
                  className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-60"
                >
                  На паузу
                </button>
              )}
              {payment.status === 'paused' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => runAction('resume')}
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-60"
                >
                  Снять с паузы
                </button>
              )}
              {payment.status !== 'cancelled' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => runAction('cancel')}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-60"
                >
                  Отменить платёж
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
      {payOpen && payment && (
        <PayModal
          payment={payment}
          onClose={() => setPayOpen(false)}
          onDone={(row) => {
            setPayment(row);
            onChanged?.(row);
          }}
        />
      )}
    </>
  );
}

function ActionsMenu({ payment, onPay, onPause, onResume, onCancel, onOpen }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const canAct = payment.status !== 'cancelled' && payment.status !== 'paid';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
      >
        Действия
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            onClick={() => {
              setOpen(false);
              onOpen();
            }}
          >
            Подробнее
          </button>
          {canAct && (
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => {
                setOpen(false);
                onPay();
              }}
            >
              Оплачено
            </button>
          )}
          {payment.status === 'active' && (
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => {
                setOpen(false);
                onPause();
              }}
            >
              На паузу
            </button>
          )}
          {payment.status === 'paused' && (
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
              onClick={() => {
                setOpen(false);
                onResume();
              }}
            >
              Снять с паузы
            </button>
          )}
          {payment.status !== 'cancelled' && (
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50"
              onClick={() => {
                setOpen(false);
                onCancel();
              }}
            >
              Отменить
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function PaymentsTable({
  rows,
  emptyText,
  onRefreshRow,
  clickableRows,
}) {
  const [payTarget, setPayTarget] = useState(null);
  const [detailId, setDetailId] = useState(null);

  const runAction = async (id, action) => {
    if (action === 'cancel' && !window.confirm('Отменить этот платёж?')) return;
    try {
      const row = await apiRequest(`/admin/site-payments/${id}/${action}`, { method: 'POST' });
      onRefreshRow(row);
    } catch (err) {
      window.alert(err?.message || 'Ошибка');
    }
  };

  if (!rows.length) {
    return <p className="py-10 text-center text-sm text-gray-500">{emptyText}</p>;
  }

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Название</th>
              <th className="px-4 py-3 font-semibold">Период</th>
              <th className="px-4 py-3 font-semibold">Ежемесячно</th>
              <th className="px-4 py-3 font-semibold">Общая</th>
              <th className="px-4 py-3 font-semibold">К оплате осталось</th>
              <th className="px-4 py-3 font-semibold">Статус</th>
              <th className="px-4 py-3 font-semibold text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => (
              <tr
                key={row.id}
                className={clickableRows ? 'cursor-pointer hover:bg-indigo-50/40' : 'hover:bg-gray-50/80'}
                onClick={clickableRows ? () => setDetailId(row.id) : undefined}
              >
                <td className="px-4 py-3 font-medium text-gray-900">{row.title}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  {formatDate(row.start_date)} — {formatDate(row.end_date)}
                  <span className="block text-xs text-gray-400">{row.duration_days} дн.</span>
                </td>
                <td className="px-4 py-3 text-gray-800">{formatMoney(row.monthly_amount)}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{formatMoney(row.total_amount)}</td>
                <td className="px-4 py-3 font-semibold text-indigo-700">{formatMoney(row.remaining_amount)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={row.status} />
                </td>
                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <ActionsMenu
                    payment={row}
                    onOpen={() => setDetailId(row.id)}
                    onPay={() => setPayTarget(row)}
                    onPause={() => runAction(row.id, 'pause')}
                    onResume={() => runAction(row.id, 'resume')}
                    onCancel={() => runAction(row.id, 'cancel')}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {payTarget && (
        <PayModal
          payment={payTarget}
          onClose={() => setPayTarget(null)}
          onDone={(updated) => onRefreshRow(updated)}
        />
      )}
      {detailId != null && (
        <PaymentDetailModal
          paymentId={detailId}
          onClose={() => setDetailId(null)}
          onChanged={(updated) => onRefreshRow(updated)}
        />
      )}
    </>
  );
}

export default function SitePaymentsPage() {
  const navigate = useNavigate();
  const { isReady, user } = useAuthReady();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest('/admin/site-payments?scope=active');
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || 'Не удалось загрузить платежи');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isReady) return;
    if (!user?.is_admin) {
      navigate('/', { replace: true });
      return;
    }
    load();
  }, [isReady, user, navigate, load]);

  const totals = useMemo(() => {
    const total = rows.reduce((s, r) => s + Number(r.total_amount || 0), 0);
    const remaining = rows.reduce((s, r) => s + Number(r.remaining_amount || 0), 0);
    return { total, remaining };
  }, [rows]);

  const upsertRow = (updated) => {
    setRows((prev) => {
      const isActive = updated.status === 'active' || updated.status === 'paused';
      if (!isActive) return prev.filter((r) => r.id !== updated.id);
      const exists = prev.some((r) => r.id === updated.id);
      if (!exists) return [updated, ...prev];
      return prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r));
    });
  };

  if (!isReady) return <AuthLoadingScreen />;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Оплата сайта</h1>
          <p className="mt-1 text-sm text-gray-500">Учёт платежей за услуги платформы (только для администратора)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/admin/site-payments/history"
            className="inline-flex items-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50"
          >
            История платежей
          </Link>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            Добавить платёж
          </button>
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Общая сумма (активные)</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{formatMoney(totals.total)}</p>
        </div>
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-indigo-700">К оплате осталось</p>
          <p className="mt-1 text-2xl font-bold text-indigo-900">{formatMoney(totals.remaining)}</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      {loading ? (
        <p className="py-10 text-center text-sm text-gray-500">Загрузка…</p>
      ) : (
        <PaymentsTable
          rows={rows}
          emptyText="Активных платежей нет. Нажмите «Добавить платёж»."
          onRefreshRow={upsertRow}
        />
      )}

      {createOpen && (
        <CreatePaymentModal
          onClose={() => setCreateOpen(false)}
          onCreated={(row) => {
            setRows((prev) => [row, ...prev]);
          }}
        />
      )}
    </div>
  );
}
