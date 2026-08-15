import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiAxiosUnauth } from '../../utils/apiClient';
import PageAmbientBackground from '../../components/PageAmbientBackground/PageAmbientBackground';
import { buildPaymentSeo, PageSeoHelmet } from '../../utils/pageSeo';
import YandexWebmasterCounter from '../../components/Seo/YandexWebmasterCounter';
import { Badge, Button, Card, EmptyState, PageHeader, Skeleton } from '../../components/UI';

function PaymentIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
      />
    </svg>
  );
}

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
        if (!cancelled) {
          setInfo(res.data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          const detail = e?.response?.data?.detail;
          setError(
            typeof detail === 'string' ? detail : 'Не удалось загрузить информацию об оплате',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const methods = Array.isArray(info?.methods) ? info.methods : [];

  return (
    <div className="relative w-full pb-12">
      <PageSeoHelmet seo={seo} />
      <PageAmbientBackground />

      <div className="relative mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <Card padding="lg">
          <p className="text-sm font-semibold text-brand-700">Интернет-магазин</p>
          <PageHeader
            className="mb-0 mt-2"
            title="Оплата"
            subtitle="Способы оплаты заказов в «Свой Гараж»: перевод, наличные при получении или онлайн."
          />
          <div className="mt-5 flex flex-wrap gap-2">
            <Button as={Link} to="/delivery" variant="secondary" size="sm">
              Условия доставки
            </Button>
            <Button as={Link} to="/offer" variant="ghost" size="sm">
              Публичная оферта
            </Button>
          </div>
        </Card>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full rounded-sg-lg" />
            <Skeleton className="h-28 w-full rounded-sg-lg" />
            <Skeleton className="h-20 w-full rounded-sg-lg" />
          </div>
        ) : null}

        {!loading && error ? (
          <EmptyState illustration="error" title="Не удалось загрузить" description={error} />
        ) : null}

        {!loading && !error && info ? (
          <>
            <Card as="section" padding="lg">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sg bg-brand-50 text-brand-700 ring-1 ring-brand-100">
                  <PaymentIcon />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold text-ink">Способы оплаты</h2>
                  <p className="mt-1 text-sm text-ink-muted">
                    Доступны при оформлении заказа в корзине
                  </p>
                </div>
                {methods.length > 0 ? (
                  <Badge tone="brand">{methods.length}</Badge>
                ) : null}
              </div>

              {methods.length > 0 ? (
                <ul className="mt-5 space-y-2 border-t border-line pt-5">
                  {methods.map((method) => (
                    <li
                      key={method}
                      className="flex items-start gap-3 rounded-sg border border-line bg-surface-subtle px-4 py-3"
                    >
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-hidden />
                      <span className="text-sm font-medium text-ink">{method}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-5 border-t border-line pt-5 text-sm text-ink-muted">
                  Способы оплаты пока не указаны.
                </p>
              )}
            </Card>

            {info.notes ? (
              <Card padding="md" className="border-line bg-surface-subtle shadow-none">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Важно
                </p>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{info.notes}</p>
              </Card>
            ) : null}

            <Card padding="md" className="bg-surface-subtle shadow-none">
              <div className="flex flex-wrap gap-2">
                <Button as={Link} to="/catalog" variant="secondary">
                  В каталог
                </Button>
                <Button as={Link} to="/about" variant="ghost">
                  О компании
                </Button>
              </div>
            </Card>
          </>
        ) : null}
      </div>

      <YandexWebmasterCounter />
    </div>
  );
}
