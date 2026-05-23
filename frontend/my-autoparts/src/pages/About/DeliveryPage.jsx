import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiAxiosUnauth } from '../../utils/apiClient';

const TYPE_LABELS = {
  pickup: 'Самовывоз из магазина',
  pvz: 'ПВЗ',
  courier: 'Курьер',
};

function formatMoney(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return '—';
  return `${num.toLocaleString('ru-RU')} ₽`;
}

export default function DeliveryPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiAxiosUnauth.get('/public/site-delivery');
        if (!cancelled) setRows(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        if (!cancelled) setError(e?.response?.data?.detail || 'Не удалось загрузить способы доставки');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => {
      const key = row.region_name || `region-${row.region_id}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    });
    return map;
  }, [rows]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <nav className="text-sm text-gray-500 mb-6">
        <Link to="/" className="hover:text-indigo-600">Главная</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">Доставка</span>
      </nav>

      <header className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Доставка</h1>
        <p className="mt-3 text-gray-600 leading-relaxed">
          Условия доставки интернет-магазина «Свой Гараж». Информация на этой странице
          соответствует настройкам в Яндекс Товарах и доступна при оформлении заказа.
        </p>
      </header>

      {loading && <p className="text-sm text-gray-500">Загрузка…</p>}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 text-red-800 text-sm px-4 py-3 border border-red-100">
          {error}
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <p className="text-sm text-gray-500">Способы доставки временно не опубликованы.</p>
      )}

      {[...grouped.entries()].map(([regionName, regionRows]) => (
        <section key={regionName} className="mb-8 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-900">{regionName}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-white text-left text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Тип доставки</th>
                  <th className="px-4 py-3 font-medium">Служба доставки</th>
                  <th className="px-4 py-3 font-medium">Пункт / условия</th>
                  <th className="px-4 py-3 font-medium">Мин. сумма заказа</th>
                </tr>
              </thead>
              <tbody>
                {regionRows.map((row) => (
                  <tr key={row.id} className="border-t border-gray-100">
                    <td className="px-4 py-3 text-gray-900">
                      {TYPE_LABELS[row.delivery_type] || row.delivery_type}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{row.carrier || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {row.pickup_point || row.notes || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{formatMoney(row.min_order_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <p className="text-sm text-gray-500">
        Доступность способов доставки зависит от региона и состава заказа. Точный способ
        выбирается на шаге оформления заказа.
      </p>
    </div>
  );
}
