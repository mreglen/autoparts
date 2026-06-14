import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiAxiosUnauth } from '../../utils/apiClient';
import YandexWebmasterCounter from '../../components/Seo/YandexWebmasterCounter';

export default function PaymentPage() {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiAxiosUnauth.get('/public/site-payment');
        if (!cancelled) setInfo(res.data);
      } catch (e) {
        if (!cancelled) setError(e?.response?.data?.detail || 'Не удалось загрузить информацию об оплате');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Оплата</h1>
        <p className="mt-3 text-gray-600 leading-relaxed">
          Способы оплаты заказов в интернет-магазине «Свой Гараж»: перевод, наличные при получении или онлайн.
        </p>
        <p className="mt-2 text-sm text-gray-600">
          Условия покупки — в{' '}
          <Link to="/offer" className="text-indigo-600 hover:underline">
            публичной оферте
          </Link>
          .
        </p>
      </header>

      {loading && <p className="text-sm text-gray-500">Загрузка…</p>}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 text-red-800 text-sm px-4 py-3 border border-red-100">
          {error}
        </div>
      )}

      {info && (
        <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <ul className="list-disc pl-5 space-y-2 text-gray-800">
            {(info.methods || []).map((method) => (
              <li key={method}>{method}</li>
            ))}
          </ul>
          {info.notes && <p className="mt-4 text-sm text-gray-600">{info.notes}</p>}
        </section>
      )}
      <YandexWebmasterCounter />
    </div>
  );
}
