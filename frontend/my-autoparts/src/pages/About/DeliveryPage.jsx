import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiAxiosUnauth } from '../../utils/apiClient';
import DeliveryFastIcon from '../../components/icons/DeliveryFastIcon';
import PickupIcon from '../../components/icons/PickupIcon';
import PageAmbientBackground from '../../components/PageAmbientBackground/PageAmbientBackground';
import {
  CHECKOUT_DELIVERY_REGIONS,
  CHECKOUT_PVZ_METHODS,
  YANDEX_PVZ_DELIVERY_TYPE_LABEL,
  findPickupDeliveryOption,
  findPvzDeliveryOption,
} from '../../utils/newPartsCheckoutDelivery';
import { buildDeliverySeo, PageSeoHelmet } from '../../utils/pageSeo';
import YandexWebmasterCounter from '../../components/Seo/YandexWebmasterCounter';
import { Badge, Button, Card, EmptyState, PageHeader, Skeleton } from '../../components/UI';
import { warehouseListShellClass } from '../../utils/warehouseListUi';

function formatMoney(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return `${num.toLocaleString('ru-RU')} ₽`;
}

function ModeCard({ icon, title, description, children }) {
  return (
    <Card as="section" padding="lg">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sg bg-brand-50 text-brand-700 ring-1 ring-brand-100">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          {description ? <p className="mt-1 text-sm text-ink-muted">{description}</p> : null}
        </div>
      </div>
      {children ? <div className="mt-5 border-t border-line pt-5">{children}</div> : null}
    </Card>
  );
}

function YandexDeliveryMatrixTable({ rows }) {
  const matrixRows = useMemo(() => {
    const list = [];
    CHECKOUT_DELIVERY_REGIONS.forEach((region) => {
      CHECKOUT_PVZ_METHODS.forEach((method) => {
        const opt = findPvzDeliveryOption(rows, region, method.key);
        list.push({
          id: `${region}-${method.key}`,
          region,
          deliveryType: YANDEX_PVZ_DELIVERY_TYPE_LABEL,
          carrier: method.carrierName,
          minAmount: formatMoney(opt?.min_order_amount),
        });
      });
    });
    return list;
  }, [rows]);

  return (
    <div className={`${warehouseListShellClass} overflow-x-auto`}>
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-line bg-surface-subtle text-ink-soft">
          <tr>
            <th className="px-4 py-3 font-medium">Регион</th>
            <th className="px-4 py-3 font-medium">Тип доставки</th>
            <th className="px-4 py-3 font-medium">Служба доставки</th>
            <th className="px-4 py-3 font-medium">Мин. сумма заказа</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {matrixRows.map((row) => (
            <tr key={row.id} className="bg-surface transition hover:bg-surface-subtle/60">
              <td className="whitespace-nowrap px-4 py-3 font-medium text-ink">{row.region}</td>
              <td className="px-4 py-3 text-ink-soft">{row.deliveryType}</td>
              <td className="px-4 py-3 text-ink-soft">{row.carrier}</td>
              <td className="whitespace-nowrap px-4 py-3 text-ink-muted">{row.minAmount || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeliverySkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-40 w-full rounded-sg-lg" />
      <Skeleton className="h-56 w-full rounded-sg-lg" />
      <Skeleton className="h-64 w-full rounded-sg-lg" />
    </div>
  );
}

export default function DeliveryPage() {
  const seo = buildDeliverySeo();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiAxiosUnauth.get('/public/site-delivery');
        if (!cancelled) {
          setRows(Array.isArray(res.data) ? res.data : []);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          const detail = e?.response?.data?.detail;
          setError(typeof detail === 'string' ? detail : 'Не удалось загрузить способы доставки');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pickupOption = useMemo(() => findPickupDeliveryOption(rows), [rows]);
  const pickupAddress =
    pickupOption?.pickup_point?.trim() || 'Адрес уточняется при оформлении заказа';
  const pickupMin = formatMoney(pickupOption?.min_order_amount);

  return (
    <div className="relative w-full pb-12">
      <PageSeoHelmet seo={seo} />
      <PageAmbientBackground />

      <div className="relative mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <Card padding="lg">
          <p className="text-sm font-semibold text-brand-700">Интернет-магазин</p>
          <PageHeader
            className="mb-0 mt-2"
            title="Доставка"
            subtitle="Условия доставки «Свой Гараж». Информация совпадает с оформлением заказа и настройками в Яндекс Товарах."
          />
          <div className="mt-5 flex flex-wrap gap-2">
            <Button as={Link} to="/payment" variant="secondary" size="sm">
              Способы оплаты
            </Button>
            <Button as={Link} to="/offer" variant="ghost" size="sm">
              Публичная оферта
            </Button>
          </div>
        </Card>

        {loading ? <DeliverySkeleton /> : null}

        {!loading && error ? (
          <EmptyState
            illustration="error"
            title="Не удалось загрузить"
            description={error}
          />
        ) : null}

        {!loading && !error ? (
          <div className="space-y-5">
            <ModeCard
              icon={<PickupIcon />}
              title="Самовывоз"
              description="Забор заказа в пункте выдачи магазина"
            >
              <div className="rounded-sg border border-success-100 bg-success-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-success-700">
                  Адрес самовывоза
                </p>
                <p className="mt-2 text-sm leading-relaxed text-ink">{pickupAddress}</p>
                {pickupMin ? (
                  <p className="mt-2 text-sm text-success-700">
                    Минимальная сумма заказа: <span className="font-semibold">{pickupMin}</span>
                  </p>
                ) : null}
              </div>
            </ModeCard>

            <ModeCard
              icon={<DeliveryFastIcon />}
              title="Доставка в ПВЗ"
              description={`Тип доставки: ${YANDEX_PVZ_DELIVERY_TYPE_LABEL}`}
            >
              <div className="space-y-5">
                <div>
                  <p className="mb-2 text-sm font-medium text-ink-soft">Регионы</p>
                  <div className="flex flex-wrap gap-2">
                    {CHECKOUT_DELIVERY_REGIONS.map((name) => (
                      <Badge key={name} tone="neutral">
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium text-ink-soft">Службы доставки</p>
                  <div className="flex flex-wrap gap-2">
                    {CHECKOUT_PVZ_METHODS.map((method) => (
                      <Badge key={method.key} tone="brand">
                        {method.carrierName}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-ink-muted">
                    В оформлении заказа: {CHECKOUT_PVZ_METHODS.map((m) => m.label).join(', ')}
                  </p>
                </div>

                <p className="rounded-sg border border-line bg-surface-subtle px-4 py-3 text-sm text-ink-muted">
                  При оформлении укажите адрес (город, улица, дом) — можно выбрать из подсказок или
                  ввести вручную.
                </p>
              </div>
            </ModeCard>

            <Card as="section" padding="lg">
              <h2 className="text-lg font-semibold text-ink">Доставка по регионам</h2>
              <p className="mb-5 mt-1 text-sm text-ink-muted">
                Полный перечень для проверки в Яндекс Товарах: тип «{YANDEX_PVZ_DELIVERY_TYPE_LABEL}»,
                службы «СДЭК», «Почта России», «Яндекс Доставка».
              </p>
              <YandexDeliveryMatrixTable rows={rows} />
            </Card>

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
          </div>
        ) : null}
      </div>

      <YandexWebmasterCounter />
    </div>
  );
}
