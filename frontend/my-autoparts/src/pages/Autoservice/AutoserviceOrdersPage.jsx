import { useCallback, useEffect, useMemo, useState, Fragment } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import { apiAxios, apiRequest } from '../../utils/apiClient';
import { getRosskoMinPrice, getRosskoParts } from '../AutoParts/NewParts/rosskoHelpers';

const inputClass =
  'mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20';

const inputSmClass =
  'block w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20';

const STATUS_LABELS = {
  accepted: 'Принят',
  in_progress: 'В работе',
  ready: 'Готов',
  issued: 'Выдан',
  cancelled: 'Отменён',
  // legacy (на случай непатченных данных)
  open: 'Принят',
  completed: 'Выдан',
};

const STATUS_STYLES = {
  accepted: 'bg-amber-50 text-amber-800 ring-amber-200',
  in_progress: 'bg-sky-50 text-sky-800 ring-sky-200',
  ready: 'bg-violet-50 text-violet-800 ring-violet-200',
  issued: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  cancelled: 'bg-gray-100 text-gray-600 ring-gray-200',
  open: 'bg-amber-50 text-amber-800 ring-amber-200',
  completed: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
};

function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMoney(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return '0,00';
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function lineSum(qty, unitPrice) {
  const q = Number(qty) || 0;
  const p = Number(unitPrice) || 0;
  return Math.round(q * p * 100) / 100;
}

function priceWithMarkup(unitPrice, markupPercent) {
  const p = Number(unitPrice) || 0;
  const m = Number(markupPercent) || 0;
  return Math.round(p * (1 + m / 100) * 100) / 100;
}

function shopLineSum(qty, unitPrice, markupPercent) {
  return Math.round((Number(qty) || 0) * priceWithMarkup(unitPrice, markupPercent) * 100) / 100;
}

function vehicleLabel(v) {
  if (!v) return '—';
  const parts = [v.make, v.model, v.year].filter(Boolean);
  const base = parts.join(' ') || 'Авто';
  if (v.plate) return `${base} (${v.plate})`;
  return base;
}

function toLocalInputValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInputValue(local) {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function emptyWork() {
  return { title: '', qty: 1, unit_price: '0', executor_user_id: '' };
}

function emptyClientPart() {
  return { title: '', qty: 1 };
}

function emptyShopPart(overrides = {}) {
  return {
    title: '',
    qty: 1,
    unit_price: '0',
    markup_percent: '5',
    source: 'manual',
    product_id: null,
    rossko_brand: '',
    rossko_partnumber: '',
    ...overrides,
  };
}

function moveItem(list, index, delta) {
  const next = index + delta;
  if (next < 0 || next >= list.length) return list;
  const copy = [...list];
  const tmp = copy[index];
  copy[index] = copy[next];
  copy[next] = tmp;
  return copy;
}

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
        STATUS_STYLES[status] || STATUS_STYLES.open
      }`}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function Modal({ title, children, onClose, footer }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Закрыть" onClick={onClose} />
      <div className="relative flex max-h-[100dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl ring-1 ring-gray-200 sm:max-h-[90vh] sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3 sm:px-5 sm:py-4">
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>
        {footer ? (
          <div className="shrink-0 border-t border-gray-100 bg-white px-4 py-3 sm:px-5">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

function OrderLinesExpand({ row, showExecutors }) {
  const works = row.works || [];
  const parts = row.client_parts || [];
  const shop = row.shop_parts || [];
  const worksTotal = row.works_total ?? works.reduce((s, w) => s + lineSum(w.qty, w.unit_price), 0);
  const shopTotal =
    row.shop_parts_total
    ?? shop.reduce(
      (s, p) => s + (Number(p.line_sum) || shopLineSum(p.qty, p.unit_price, p.markup_percent)),
      0,
    );
  const grand = row.grand_total ?? worksTotal + shopTotal;
  return (
    <div className="space-y-4 text-sm text-gray-700">
      {showExecutors && (
        <div className="space-y-1 sm:hidden">
          <p>
            <span className="font-medium text-gray-900">Принял:</span> {row.accepted_by?.name || '—'}
          </p>
          <p>
            <span className="font-medium text-gray-900">Исполнители:</span>{' '}
            {(row.assignees || []).map((a) => a.name).join(', ') || '—'}
          </p>
        </div>
      )}
      {row.lift_number ? (
        <p>
          <span className="font-medium text-gray-900">Подъёмник:</span> №{row.lift_number}
        </p>
      ) : null}
      {row.staff_comment && showExecutors && (
        <p>
          <span className="font-medium text-gray-900">Комментарий сотрудника:</span> {row.staff_comment}
        </p>
      )}
      <div>
        <p className="font-medium text-gray-900">Работы</p>
        {works.length === 0 ? (
          <p className="mt-1 text-gray-500">Нет работ</p>
        ) : (
          <table className="mt-2 min-w-full text-left text-xs">
            <thead className="text-gray-500">
              <tr>
                <th className="py-1 pr-3">№</th>
                <th className="py-1 pr-3">Название</th>
                <th className="py-1 pr-3">Кол-во</th>
                <th className="py-1 pr-3">Цена</th>
                <th className="py-1 pr-3">Сумма</th>
                {showExecutors && <th className="py-1">Исполнитель</th>}
              </tr>
            </thead>
            <tbody>
              {works.map((w) => (
                <tr key={w.id || `${w.position}-${w.title}`}>
                  <td className="py-1 pr-3">{w.position}</td>
                  <td className="py-1 pr-3">{w.title}</td>
                  <td className="py-1 pr-3">{w.qty}</td>
                  <td className="py-1 pr-3">{formatMoney(w.unit_price)}</td>
                  <td className="py-1 pr-3">{formatMoney(w.line_sum ?? lineSum(w.qty, w.unit_price))}</td>
                  {showExecutors && <td className="py-1">{w.executor?.name || '—'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-2 font-medium text-gray-900">Итого работ: {formatMoney(worksTotal)} ₽</p>
      </div>
      <div>
        <p className="font-medium text-gray-900">Запчасти клиента</p>
        {parts.length === 0 ? (
          <p className="mt-1 text-gray-500">Нет запчастей клиента</p>
        ) : (
          <table className="mt-2 min-w-full text-left text-xs">
            <thead className="text-gray-500">
              <tr>
                <th className="py-1 pr-3">№</th>
                <th className="py-1 pr-3">Название</th>
                <th className="py-1">Кол-во</th>
              </tr>
            </thead>
            <tbody>
              {parts.map((p) => (
                <tr key={p.id || `${p.position}-${p.title}`}>
                  <td className="py-1 pr-3">{p.position}</td>
                  <td className="py-1 pr-3">{p.title}</td>
                  <td className="py-1">{p.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div>
        <p className="font-medium text-gray-900">Запчасти исполнителя</p>
        {shop.length === 0 ? (
          <p className="mt-1 text-gray-500">Нет запчастей исполнителя</p>
        ) : (
          <table className="mt-2 min-w-full text-left text-xs">
            <thead className="text-gray-500">
              <tr>
                <th className="py-1 pr-3">№</th>
                <th className="py-1 pr-3">Название</th>
                <th className="py-1 pr-3">Кол-во</th>
                {showExecutors && <th className="py-1 pr-3">Цена</th>}
                {showExecutors && <th className="py-1 pr-3">Наценка %</th>}
                <th className="py-1 pr-3">Цена с наценкой</th>
                <th className="py-1 pr-3">Сумма</th>
                {showExecutors && <th className="py-1">Источник</th>}
              </tr>
            </thead>
            <tbody>
              {shop.map((p) => (
                <tr key={p.id || `${p.position}-${p.title}`}>
                  <td className="py-1 pr-3">{p.position}</td>
                  <td className="py-1 pr-3">{p.title}</td>
                  <td className="py-1 pr-3">{p.qty}</td>
                  {showExecutors && <td className="py-1 pr-3">{formatMoney(p.unit_price)}</td>}
                  {showExecutors && <td className="py-1 pr-3">{p.markup_percent}</td>}
                  <td className="py-1 pr-3">
                    {formatMoney(p.price_with_markup ?? priceWithMarkup(p.unit_price, p.markup_percent))}
                  </td>
                  <td className="py-1 pr-3">
                    {formatMoney(p.line_sum ?? shopLineSum(p.qty, p.unit_price, p.markup_percent))}
                  </td>
                  {showExecutors && <td className="py-1">{p.source || '—'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-2 font-medium text-gray-900">Итого ЗЧ исполнителя: {formatMoney(shopTotal)} ₽</p>
        <p className="mt-1 font-semibold text-gray-900">Итого заказ: {formatMoney(grand)} ₽</p>
      </div>
    </div>
  );
}

function OrderFormModal({
  title,
  initial,
  clients,
  staffOptions,
  liftsCount = 0,
  onClose,
  onSubmit,
  saving,
}) {
  const [clientId, setClientId] = useState(initial?.client_id ? String(initial.client_id) : '');
  const [vehicleId, setVehicleId] = useState(initial?.vehicle_id ? String(initial.vehicle_id) : '');
  const [scheduledAt, setScheduledAt] = useState(
    initial?.scheduled_at ? toLocalInputValue(initial.scheduled_at) : toLocalInputValue(new Date().toISOString()),
  );
  const [comment, setComment] = useState(initial?.client_comment || '');
  const [staffComment, setStaffComment] = useState(initial?.staff_comment || '');
  const [liftNumber, setLiftNumber] = useState(
    initial?.lift_number != null ? String(initial.lift_number) : '',
  );
  const [assigneeIds, setAssigneeIds] = useState(
    (initial?.assignees || []).map((a) => a.id),
  );
  const [works, setWorks] = useState(() =>
    (initial?.works || []).length
      ? initial.works.map((w) => ({
          title: w.title || '',
          qty: w.qty || 1,
          unit_price: String(w.unit_price ?? '0'),
          executor_user_id: w.executor_user_id ? String(w.executor_user_id) : '',
        }))
      : [],
  );
  const [clientParts, setClientParts] = useState(() =>
    (initial?.client_parts || []).length
      ? initial.client_parts.map((p) => ({
          title: p.title || '',
          qty: p.qty || 1,
        }))
      : [],
  );
  const [shopParts, setShopParts] = useState(() =>
    (initial?.shop_parts || []).length
      ? initial.shop_parts.map((p) => ({
          title: p.title || '',
          qty: p.qty || 1,
          unit_price: String(p.unit_price ?? '0'),
          markup_percent: String(p.markup_percent ?? '5'),
          source: p.source || 'manual',
          product_id: p.product_id || null,
          rossko_brand: p.rossko_brand || '',
          rossko_partnumber: p.rossko_partnumber || '',
        }))
      : [],
  );
  const [bulkMarkup, setBulkMarkup] = useState('');
  const [picker, setPicker] = useState(null); // 'warehouse' | 'rossko' | null
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerResults, setPickerResults] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerError, setPickerError] = useState('');
  const [vehicles, setVehicles] = useState([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [error, setError] = useState('');

  const worksTotal = useMemo(
    () => works.reduce((sum, w) => sum + lineSum(w.qty, w.unit_price), 0),
    [works],
  );
  const shopPartsTotal = useMemo(
    () => shopParts.reduce((sum, p) => sum + shopLineSum(p.qty, p.unit_price, p.markup_percent), 0),
    [shopParts],
  );
  const grandTotal = worksTotal + shopPartsTotal;

  const bulkMarkupDisplay = useMemo(() => {
    if (shopParts.length === 0) return '';
    const values = shopParts.map((p) => String(Number(p.markup_percent)));
    const unique = [...new Set(values)];
    return unique.length === 1 ? unique[0] : '';
  }, [shopParts]);

  useEffect(() => {
    if (!clientId) {
      setVehicles([]);
      setVehicleId('');
      return;
    }
    let cancelled = false;
    (async () => {
      setVehiclesLoading(true);
      try {
        const data = await apiRequest(`/autoservice/garage/vehicles?client_id=${clientId}`);
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        setVehicles(list);
        if (!list.some((v) => String(v.id) === vehicleId)) {
          setVehicleId(list[0] ? String(list[0].id) : '');
        }
      } catch {
        if (!cancelled) {
          setVehicles([]);
          setVehicleId('');
        }
      } finally {
        if (!cancelled) setVehiclesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleAssignee = (id) => {
    setAssigneeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const updateWork = (index, patch) => {
    setWorks((prev) => prev.map((w, i) => (i === index ? { ...w, ...patch } : w)));
  };

  const updatePart = (index, patch) => {
    setClientParts((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };

  const updateShopPart = (index, patch) => {
    setShopParts((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };

  const applyBulkMarkup = (value) => {
    setBulkMarkup(value);
    if (value === '' || Number.isNaN(Number(value)) || Number(value) < 0) return;
    setShopParts((prev) => prev.map((p) => ({ ...p, markup_percent: String(value) })));
  };

  const openPicker = (kind) => {
    setPicker(kind);
    setPickerQuery('');
    setPickerResults([]);
    setPickerError('');
  };

  const runWarehouseSearch = async () => {
    setPickerLoading(true);
    setPickerError('');
    try {
      const data = await apiRequest(
        `/autoservice/repair-orders/warehouse-products?q=${encodeURIComponent(pickerQuery.trim())}`,
      );
      setPickerResults(Array.isArray(data) ? data : []);
    } catch (err) {
      setPickerError(err?.message || 'Ошибка поиска склада');
      setPickerResults([]);
    } finally {
      setPickerLoading(false);
    }
  };

  const runRosskoSearch = async () => {
    const text = pickerQuery.trim();
    if (!text) {
      setPickerError('Введите артикул или название');
      return;
    }
    setPickerLoading(true);
    setPickerError('');
    try {
      const response = await apiAxios.post('/rossko/GetSearch', {
        text,
        delivery_id: '000000001',
        address_id: 176458,
      });
      const parts = getRosskoParts(response.data).slice(0, 20).map((part) => ({
        brand: part.brand || '',
        partnumber: part.partnumber || '',
        name: part.name || part.guid || '',
        price: getRosskoMinPrice(part),
      }));
      setPickerResults(parts);
    } catch (err) {
      setPickerError(err?.response?.data?.detail || err?.message || 'Ошибка поиска Rossko');
      setPickerResults([]);
    } finally {
      setPickerLoading(false);
    }
  };

  const pickWarehouse = (item) => {
    setShopParts((prev) => [
      ...prev,
      emptyShopPart({
        title: item.title || '',
        unit_price: String(item.price ?? 0),
        source: 'warehouse',
        product_id: item.id,
      }),
    ]);
    setPicker(null);
  };

  const pickRossko = (item) => {
    const title = [item.brand, item.partnumber, item.name].filter(Boolean).join(' ').trim()
      || item.partnumber
      || 'Rossko';
    setShopParts((prev) => [
      ...prev,
      emptyShopPart({
        title: title.slice(0, 255),
        unit_price: String(item.price ?? 0),
        source: 'rossko',
        rossko_brand: item.brand || '',
        rossko_partnumber: item.partnumber || '',
      }),
    ]);
    setPicker(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!clientId || !vehicleId || !scheduledAt) {
      setError('Выберите клиента, автомобиль и дату записи');
      return;
    }
    const iso = fromLocalInputValue(scheduledAt);
    if (!iso) {
      setError('Некорректная дата записи');
      return;
    }
    for (const w of works) {
      if (!String(w.title || '').trim()) {
        setError('У каждой работы должно быть название');
        return;
      }
      if (!Number.isInteger(Number(w.qty)) || Number(w.qty) < 1) {
        setError('Количество работы должно быть целым числом ≥ 1');
        return;
      }
      if (Number.isNaN(Number(w.unit_price)) || Number(w.unit_price) < 0) {
        setError('Цена работы должна быть ≥ 0');
        return;
      }
    }
    for (const p of clientParts) {
      if (!String(p.title || '').trim()) {
        setError('У каждой запчасти клиента должно быть название');
        return;
      }
      if (!Number.isInteger(Number(p.qty)) || Number(p.qty) < 1) {
        setError('Количество запчасти должно быть целым числом ≥ 1');
        return;
      }
    }
    for (const p of shopParts) {
      if (!String(p.title || '').trim()) {
        setError('У каждой запчасти исполнителя должно быть название');
        return;
      }
      if (!Number.isInteger(Number(p.qty)) || Number(p.qty) < 1) {
        setError('Количество ЗЧ исполнителя должно быть целым числом ≥ 1');
        return;
      }
      if (Number.isNaN(Number(p.unit_price)) || Number(p.unit_price) < 0) {
        setError('Цена ЗЧ исполнителя должна быть ≥ 0');
        return;
      }
      if (Number.isNaN(Number(p.markup_percent)) || Number(p.markup_percent) < 0) {
        setError('Наценка должна быть ≥ 0');
        return;
      }
    }
    try {
      await onSubmit({
        client_id: Number(clientId),
        vehicle_id: Number(vehicleId),
        scheduled_at: iso,
        client_comment: comment.trim() || null,
        staff_comment: staffComment.trim() || null,
        lift_number: liftNumber ? Number(liftNumber) : null,
        assignee_user_ids: assigneeIds,
        works: works.map((w) => ({
          title: w.title.trim(),
          qty: Number(w.qty),
          unit_price: Number(w.unit_price),
          executor_user_id: w.executor_user_id ? Number(w.executor_user_id) : null,
        })),
        client_parts: clientParts.map((p) => ({
          title: p.title.trim(),
          qty: Number(p.qty),
        })),
        shop_parts: shopParts.map((p) => ({
          title: p.title.trim(),
          qty: Number(p.qty),
          unit_price: Number(p.unit_price),
          markup_percent: Number(p.markup_percent),
          source: p.source || 'manual',
          product_id: p.source === 'warehouse' ? p.product_id : null,
          rossko_brand: p.source === 'rossko' ? (p.rossko_brand || null) : null,
          rossko_partnumber: p.source === 'rossko' ? (p.rossko_partnumber || null) : null,
        })),
      });
    } catch (err) {
      setError(err?.message || 'Не удалось сохранить');
    }
  };

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={(
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Отмена
          </button>
          <button
            type="submit"
            form="repair-order-form"
            disabled={saving}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      )}
    >
      <form id="repair-order-form" onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Клиент</label>
            <select
              className={inputClass}
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
            >
              <option value="">Выберите клиента</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.phone}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Автомобиль</label>
            <select
              className={inputClass}
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              required
              disabled={!clientId || vehiclesLoading}
            >
              <option value="">
                {vehiclesLoading ? 'Загрузка…' : clientId ? 'Выберите авто' : 'Сначала клиент'}
              </option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {vehicleLabel(v)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Дата записи</label>
            <input
              type="datetime-local"
              className={inputClass}
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Подъёмник</label>
            <select
              className={inputClass}
              value={liftNumber}
              onChange={(e) => setLiftNumber(e.target.value)}
              disabled={liftsCount <= 0}
            >
              <option value="">{liftsCount > 0 ? 'Не назначен' : 'Нет подъёмников'}</option>
              {Array.from({ length: liftsCount }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  №{n}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Комментарий клиента</label>
          <textarea
            className={inputClass}
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Комментарий сотрудника</label>
          <textarea
            className={inputClass}
            rows={2}
            value={staffComment}
            onChange={(e) => setStaffComment(e.target.value)}
          />
        </div>
        <div>
          <p className="block text-sm font-medium text-gray-700">Исполнители заказа</p>
          <div className="mt-2 max-h-32 space-y-1.5 overflow-y-auto rounded-lg border border-gray-200 p-2">
            {staffOptions.length === 0 ? (
              <p className="text-xs text-gray-500">Нет сотрудников</p>
            ) : (
              staffOptions.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm text-gray-800">
                  <input
                    type="checkbox"
                    checked={assigneeIds.includes(s.id)}
                    onChange={() => toggleAssignee(s.id)}
                  />
                  {s.name}
                </label>
              ))
            )}
          </div>
        </div>

        <div className="space-y-2 border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">Работы</p>
            <button
              type="button"
              onClick={() => setWorks((prev) => [...prev, emptyWork()])}
              className="text-sm text-indigo-600 hover:underline"
            >
              + Добавить
            </button>
          </div>
          {works.length === 0 ? (
            <p className="text-xs text-gray-500">Пока нет работ</p>
          ) : (
            <div className="space-y-3">
              {works.map((w, index) => (
                <div key={index} className="rounded-lg border border-gray-200 p-3">
                  <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
                    <span>№ {index + 1}</span>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setWorks((p) => moveItem(p, index, -1))}>
                        ↑
                      </button>
                      <button type="button" onClick={() => setWorks((p) => moveItem(p, index, 1))}>
                        ↓
                      </button>
                      <button
                        type="button"
                        className="text-red-600"
                        onClick={() => setWorks((p) => p.filter((_, i) => i !== index))}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <input
                        className={inputSmClass}
                        placeholder="Название"
                        value={w.title}
                        onChange={(e) => updateWork(index, { title: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Кол-во</label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        className={inputSmClass}
                        value={w.qty}
                        onChange={(e) => updateWork(index, { qty: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Цена</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className={inputSmClass}
                        value={w.unit_price}
                        onChange={(e) => updateWork(index, { unit_price: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Сумма</label>
                      <p className="mt-1 text-sm text-gray-800">{formatMoney(lineSum(w.qty, w.unit_price))} ₽</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Исполнитель работы</label>
                      <select
                        className={inputSmClass}
                        value={w.executor_user_id}
                        onChange={(e) => updateWork(index, { executor_user_id: e.target.value })}
                      >
                        <option value="">Не назначен</option>
                        {staffOptions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-sm font-medium text-gray-900">Итого работ: {formatMoney(worksTotal)} ₽</p>
        </div>

        <div className="space-y-2 border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">Запчасти клиента</p>
            <button
              type="button"
              onClick={() => setClientParts((prev) => [...prev, emptyClientPart()])}
              className="text-sm text-indigo-600 hover:underline"
            >
              + Добавить
            </button>
          </div>
          {clientParts.length === 0 ? (
            <p className="text-xs text-gray-500">Пока нет запчастей клиента</p>
          ) : (
            <div className="space-y-3">
              {clientParts.map((p, index) => (
                <div key={index} className="rounded-lg border border-gray-200 p-3">
                  <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
                    <span>№ {index + 1}</span>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setClientParts((prev) => moveItem(prev, index, -1))}>
                        ↑
                      </button>
                      <button type="button" onClick={() => setClientParts((prev) => moveItem(prev, index, 1))}>
                        ↓
                      </button>
                      <button
                        type="button"
                        className="text-red-600"
                        onClick={() => setClientParts((prev) => prev.filter((_, i) => i !== index))}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      <input
                        className={inputSmClass}
                        placeholder="Название"
                        value={p.title}
                        onChange={(e) => updatePart(index, { title: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Кол-во</label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        className={inputSmClass}
                        value={p.qty}
                        onChange={(e) => updatePart(index, { qty: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2 border-t border-gray-100 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-900">Запчасти исполнителя</p>
            <div className="flex flex-wrap gap-2 text-sm">
              <button
                type="button"
                onClick={() => setShopParts((prev) => [...prev, emptyShopPart()])}
                className="text-indigo-600 hover:underline"
              >
                Вручную
              </button>
              <button type="button" onClick={() => openPicker('warehouse')} className="text-indigo-600 hover:underline">
                Со склада
              </button>
              <button type="button" onClick={() => openPicker('rossko')} className="text-indigo-600 hover:underline">
                Из Rossko
              </button>
            </div>
          </div>
          <div className="flex items-end gap-2">
            <div>
              <label className="text-xs text-gray-500">Наценка для всех %</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className={inputSmClass}
                placeholder={shopParts.length && bulkMarkupDisplay === '' ? '—' : ''}
                value={bulkMarkup !== '' ? bulkMarkup : bulkMarkupDisplay}
                onChange={(e) => applyBulkMarkup(e.target.value)}
              />
            </div>
          </div>
          {picker && (
            <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900">
                  {picker === 'warehouse' ? 'Поиск по складу' : 'Поиск Rossko'}
                </p>
                <button type="button" className="text-xs text-gray-500" onClick={() => setPicker(null)}>
                  Закрыть
                </button>
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  className={inputSmClass}
                  value={pickerQuery}
                  onChange={(e) => setPickerQuery(e.target.value)}
                  placeholder={picker === 'warehouse' ? 'Название / артикул' : 'Артикул'}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (picker === 'warehouse') runWarehouseSearch();
                      else runRosskoSearch();
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={pickerLoading}
                  onClick={() => (picker === 'warehouse' ? runWarehouseSearch() : runRosskoSearch())}
                  className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white disabled:opacity-60"
                >
                  {pickerLoading ? '…' : 'Найти'}
                </button>
              </div>
              {pickerError && <p className="mt-2 text-xs text-red-600">{pickerError}</p>}
              <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                {pickerResults.length === 0 && !pickerLoading ? (
                  <p className="text-xs text-gray-500">Нет результатов</p>
                ) : (
                  pickerResults.map((item, idx) => (
                    <button
                      key={item.id || `${item.brand}-${item.partnumber}-${idx}`}
                      type="button"
                      className="block w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-left text-xs hover:bg-gray-50"
                      onClick={() => (picker === 'warehouse' ? pickWarehouse(item) : pickRossko(item))}
                    >
                      {picker === 'warehouse' ? (
                        <>
                          <span className="font-medium">{item.title}</span>
                          {' · '}
                          {formatMoney(item.price)} ₽
                          {item.article ? ` · ${item.article}` : ''}
                        </>
                      ) : (
                        <>
                          <span className="font-medium">
                            {item.brand} {item.partnumber}
                          </span>
                          {item.name ? ` — ${item.name}` : ''}
                          {' · '}
                          {formatMoney(item.price)} ₽
                        </>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
          {shopParts.length === 0 ? (
            <p className="text-xs text-gray-500">Пока нет запчастей исполнителя</p>
          ) : (
            <div className="space-y-3">
              {shopParts.map((p, index) => (
                <div key={index} className="rounded-lg border border-gray-200 p-3">
                  <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
                    <span>
                      № {index + 1}
                      {p.source && p.source !== 'manual' ? ` · ${p.source}` : ''}
                    </span>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setShopParts((prev) => moveItem(prev, index, -1))}>
                        ↑
                      </button>
                      <button type="button" onClick={() => setShopParts((prev) => moveItem(prev, index, 1))}>
                        ↓
                      </button>
                      <button
                        type="button"
                        className="text-red-600"
                        onClick={() => setShopParts((prev) => prev.filter((_, i) => i !== index))}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <input
                        className={inputSmClass}
                        placeholder="Название"
                        value={p.title}
                        onChange={(e) => updateShopPart(index, { title: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Кол-во</label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        className={inputSmClass}
                        value={p.qty}
                        onChange={(e) => updateShopPart(index, { qty: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Цена</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className={inputSmClass}
                        value={p.unit_price}
                        onChange={(e) => updateShopPart(index, { unit_price: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Наценка %</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className={inputSmClass}
                        value={p.markup_percent}
                        onChange={(e) => updateShopPart(index, { markup_percent: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Цена с наценкой / сумма</label>
                      <p className="mt-1 text-sm text-gray-800">
                        {formatMoney(priceWithMarkup(p.unit_price, p.markup_percent))} ₽ ·{' '}
                        {formatMoney(shopLineSum(p.qty, p.unit_price, p.markup_percent))} ₽
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-sm font-medium text-gray-900">
            Итого ЗЧ исполнителя: {formatMoney(shopPartsTotal)} ₽
          </p>
        </div>

        <div className="space-y-1 border-t border-gray-100 pt-3 text-sm">
          <p>Итого работ: {formatMoney(worksTotal)} ₽</p>
          <p>Итого ЗЧ исполнителя: {formatMoney(shopPartsTotal)} ₽</p>
          <p className="font-semibold text-gray-900">Итого заказ: {formatMoney(grandTotal)} ₽</p>
        </div>
      </form>
    </Modal>
  );
}

export default function AutoserviceOrdersPage() {
  const { isReady, isAuthenticated, user } = useAuthReady();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewHistory = searchParams.get('view') === 'history';

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [qApplied, setQApplied] = useState('');
  const [historyStatus, setHistoryStatus] = useState('');
  const [clients, setClients] = useState([]);
  const [staffOptions, setStaffOptions] = useState([]);
  const [liftsCount, setLiftsCount] = useState(0);
  const [expandedId, setExpandedId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [saving, setSaving] = useState(false);
  const [statusSavingId, setStatusSavingId] = useState(null);

  const scope = viewHistory ? 'history' : 'active';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ scope });
      if (qApplied.trim()) params.set('q', qApplied.trim());
      if (viewHistory && historyStatus) params.set('status', historyStatus);
      const data = await apiRequest(`/autoservice/repair-orders?${params.toString()}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить записи');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [scope, qApplied, viewHistory, historyStatus]);

  const loadMeta = useCallback(async () => {
    try {
      const [clientsData, staffData, liftsData] = await Promise.all([
        apiRequest('/autoservice/clients'),
        apiRequest('/autoservice/repair-orders/staff-options'),
        apiRequest('/autoservice/repair-orders/lifts-meta'),
      ]);
      setClients(Array.isArray(clientsData) ? clientsData : []);
      setStaffOptions(Array.isArray(staffData) ? staffData : []);
      setLiftsCount(typeof liftsData?.lifts_count === 'number' ? liftsData.lifts_count : 0);
    } catch {
      /* ignore meta errors until create */
    }
  }, []);

  useEffect(() => {
    if (isReady && isAuthenticated) {
      load();
      loadMeta();
    }
  }, [isReady, isAuthenticated, load, loadMeta]);

  const setHistoryMode = (on) => {
    if (on) setSearchParams({ view: 'history' });
    else setSearchParams({});
    setExpandedId(null);
  };

  const handleCreate = async (body) => {
    setSaving(true);
    try {
      await apiRequest('/autoservice/repair-orders', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setFormOpen(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (body) => {
    if (!editRow) return;
    setSaving(true);
    try {
      await apiRequest(`/autoservice/repair-orders/${editRow.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setEditRow(null);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleStatus = async (id, nextStatus) => {
    setStatusSavingId(id);
    setError('');
    try {
      await apiRequest(`/autoservice/repair-orders/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      await load();
    } catch (e) {
      setError(e?.message || 'Не удалось сменить статус');
    } finally {
      setStatusSavingId(null);
    }
  };

  const statusActions = useMemo(
    () =>
      viewHistory
        ? [
            { value: 'accepted', label: 'Вернуть: принят' },
            { value: 'in_progress', label: 'В работу' },
            { value: 'ready', label: 'Готов' },
          ]
        : [
            { value: 'accepted', label: 'Принят' },
            { value: 'in_progress', label: 'В работу' },
            { value: 'ready', label: 'Готов' },
            { value: 'issued', label: 'Выдан' },
            { value: 'cancelled', label: 'Отменить' },
          ],
    [viewHistory],
  );

  if (!isReady) return <AuthLoadingScreen />;
  if (!isAuthenticated || !user) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {viewHistory ? 'История записей' : 'Записи на ремонт'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {viewHistory ? 'Завершённые и отменённые' : 'Текущие записи организации'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {viewHistory ? (
            <button
              type="button"
              onClick={() => setHistoryMode(false)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              К активным
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setHistoryMode(true)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                История записей
              </button>
              <button
                type="button"
                onClick={() => setFormOpen(true)}
                className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Добавить
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700">Поиск</label>
          <input
            className={inputClass}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Номер, клиент, авто, VIN, номер"
            onKeyDown={(e) => {
              if (e.key === 'Enter') setQApplied(q);
            }}
          />
        </div>
        {viewHistory && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Статус</label>
            <select
              className={inputClass}
              value={historyStatus}
              onChange={(e) => setHistoryStatus(e.target.value)}
            >
              <option value="">Все</option>
              <option value="issued">Выдан</option>
              <option value="cancelled">Отменён</option>
            </select>
          </div>
        )}
        <button
          type="button"
          onClick={() => setQApplied(q)}
          className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          Найти
        </button>
        <button
          type="button"
          onClick={load}
          className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          Обновить
        </button>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="mt-6 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Номер</th>
              <th className="px-4 py-3">Авто</th>
              <th className="px-4 py-3">Клиент</th>
              <th className="hidden px-4 py-3 md:table-cell">Комментарий</th>
              <th className="px-4 py-3">Дата</th>
              <th className="px-4 py-3">Подъёмник</th>
              <th className="hidden px-4 py-3 sm:table-cell">Принял</th>
              <th className="hidden px-4 py-3 sm:table-cell">Исполнители</th>
              <th className="px-4 py-3">Статус</th>
              <th className="px-4 py-3">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                  Загрузка…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                  Записей пока нет
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <Fragment key={row.id}>
                  <tr className="hover:bg-gray-50/80">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <button
                        type="button"
                        className="text-left text-indigo-600 hover:underline"
                        onClick={() =>
                          setExpandedId((id) => (id === row.id ? null : row.id))
                        }
                      >
                        {row.order_number}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-800">{vehicleLabel(row.vehicle)}</td>
                    <td className="px-4 py-3 text-gray-800">{row.client?.name || '—'}</td>
                    <td className="hidden max-w-[12rem] truncate px-4 py-3 text-gray-600 md:table-cell">
                      {row.client_comment || '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                      {formatDateTime(row.scheduled_at)}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {row.lift_number != null ? `№${row.lift_number}` : '—'}
                    </td>
                    <td className="hidden px-4 py-3 text-gray-700 sm:table-cell">{row.accepted_by?.name || '—'}</td>
                    <td className="hidden px-4 py-3 text-gray-700 sm:table-cell">
                      {(row.assignees || []).map((a) => a.name).join(', ') || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          className="text-left text-sm text-indigo-600 hover:underline"
                          onClick={() => setEditRow(row)}
                        >
                          Изменить
                        </button>
                        <select
                          className="rounded border border-gray-200 px-1.5 py-1 text-xs"
                          disabled={statusSavingId === row.id}
                          value=""
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v) handleStatus(row.id, v);
                            e.target.value = '';
                          }}
                        >
                          <option value="">Статус…</option>
                          {statusActions
                            .filter((a) => a.value !== row.status)
                            .map((a) => (
                              <option key={a.value} value={a.value}>
                                {a.label}
                              </option>
                            ))}
                        </select>
                      </div>
                    </td>
                  </tr>
                  {expandedId === row.id && (
                    <tr>
                      <td colSpan={10} className="bg-gray-50 px-4 py-4">
                        <OrderLinesExpand row={row} showExecutors />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      {formOpen && (
        <OrderFormModal
          title="Новая запись"
          clients={clients}
          staffOptions={staffOptions}
          liftsCount={liftsCount}
          onClose={() => setFormOpen(false)}
          onSubmit={handleCreate}
          saving={saving}
        />
      )}
      {editRow && (
        <OrderFormModal
          title={`Запись ${editRow.order_number}`}
          initial={editRow}
          clients={clients}
          staffOptions={staffOptions}
          liftsCount={liftsCount}
          onClose={() => setEditRow(null)}
          onSubmit={handleUpdate}
          saving={saving}
        />
      )}
    </div>
  );
}
