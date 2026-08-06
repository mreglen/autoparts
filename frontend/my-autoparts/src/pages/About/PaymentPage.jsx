import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiAxiosUnauth } from '../../utils/apiClient';
import { buildPaymentSeo, PageSeoHelmet } from '../../utils/pageSeo';
import YandexWebmasterCounter from '../../components/Seo/YandexWebmasterCounter';
import { Card, PageHeader } from '../../components/UI';

export default function PaymentPage() {
  const seo = buildPaymentSeo();
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
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageSeoHelmet seo={seo} />
      <PageHeader
        title="Оплата"
        subtitle={
          <>
            Способы оплаты заказов в интернет-магазине «Свой Гараж»: перевод, наличные при получении или онлайн.
            <span className="mt-2 block text-sm text-ink-muted">
              Условия покупки — в{' '}
              <Link to="/offer" className="text-brand-600 hover:underline">
                публичной оферте
              </Link>
              .
            </span>
          </>
        }
      />

      {loading && <p className="text-sm text-ink-muted">Загрузка…</p>}
      {error && (
        <div className="mb-4 rounded-sg border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {error}
        </div>
      )}

      {info && (
        <Card as="section" padding="md">
          <ul className="list-disc space-y-2 pl-5 text-ink-soft">
            {(info.methods || []).map((method) => (
              <li key={method}>{method}</li>
            ))}
          </ul>
          {info.notes && <p className="mt-4 text-sm text-ink-muted">{info.notes}</p>}
        </Card>
      )}
      <YandexWebmasterCounter />
    </div>
  );
}
