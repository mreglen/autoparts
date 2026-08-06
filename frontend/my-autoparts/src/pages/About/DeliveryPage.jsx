import React, { useEffect, useMemo, useState } from 'react';
import { apiAxiosUnauth } from '../../utils/apiClient';
import DeliveryFastIcon from '../../components/icons/DeliveryFastIcon';
import PickupIcon from '../../components/icons/PickupIcon';
import {
  CHECKOUT_DELIVERY_REGIONS,
  CHECKOUT_PVZ_METHODS,
  YANDEX_PVZ_DELIVERY_TYPE_LABEL,
  findPickupDeliveryOption,
  findPvzDeliveryOption,
} from '../../utils/newPartsCheckoutDelivery';
import { buildDeliverySeo, PageSeoHelmet } from '../../utils/pageSeo';
import YandexWebmasterCounter from '../../components/Seo/YandexWebmasterCounter';
import { Card, PageHeader } from '../../components/UI';

function formatMoney(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return `${num.toLocaleString('ru-RU')} ₽`;
}

function ModeCard({ icon, title, description, children }) {
  return (
    <Card as="section" padding="md">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sg bg-brand-50 text-brand-600">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-ink">{title}</h2>
          {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
        </div>
      </div>
      {children ? <div className="mt-4 border-t border-line pt-4">{children}</div> : null}
    </Card>
  );
}

function InfoChip({ children }) {
  return (
    <span className="inline-flex rounded-sg border border-line bg-surface-muted px-3 py-2 text-sm font-medium text-ink">
      {children}
    </span>
  );
}

/** Таблица для сверки с Яндекс Товарами (регион × ПВЗ × служба). */
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
    <div className="overflow-x-auto rounded-sg border border-line">
      <table className="min-w-full text-sm">
        <thead className="bg-surface-muted text-left text-ink-muted">
          <tr>
            <th className="px-4 py-3 font-medium">Регион</th>
            <th className="px-4 py-3 font-medium">Тип доставки</th>
            <th className="px-4 py-3 font-medium">Служба доставки</th>
            <th className="px-4 py-3 font-medium">Мин. сумма заказа</th>
          </tr>
        </thead>
        <tbody>
          {matrixRows.map((row) => (
            <tr key={row.id} className="border-t border-line">
              <td className="px-4 py-3 font-medium text-ink">{row.region}</td>
              <td className="px-4 py-3 text-ink-soft">{row.deliveryType}</td>
              <td className="px-4 py-3 text-ink-soft">{row.carrier}</td>
              <td className="px-4 py-3 text-ink-muted">{row.minAmount || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
        if (!cancelled) setRows(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        if (!cancelled) {
          setError(e?.response?.data?.detail || 'Не удалось загрузить способы доставки');
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
    <div className="mx-auto max-w-4xl px-4 py-8 pb-12">
      <PageSeoHelmet seo={seo} />
      <PageHeader
        title="Доставка"
        subtitle="Условия доставки интернет-магазина «Свой Гараж». Информация совпадает с оформлением заказа и настройками в Яндекс Товарах."
      />

      {loading && <p className="text-sm text-ink-muted">Загрузка…</p>}
      {error && (
        <div className="mb-4 rounded-sg border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-5">
          <ModeCard
            icon={<PickupIcon />}
            title="Самовывоз"
            description="Самовывоз из магазина — забор заказа в пункте выдачи магазина"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-success-700">
              Адрес самовывоза
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink">{pickupAddress}</p>
            {pickupMin && (
              <p className="mt-2 text-sm text-ink-muted">Минимальная сумма заказа: {pickupMin}</p>
            )}
          </ModeCard>

          <ModeCard
            icon={<DeliveryFastIcon />}
            title="Доставка"
            description="ПВЗ в выбранном регионе"
          >
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-sm font-medium text-ink-soft">Регионы</p>
                <div className="flex flex-wrap gap-2">
                  {CHECKOUT_DELIVERY_REGIONS.map((name) => (
                    <InfoChip key={name}>{name}</InfoChip>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-ink-soft">
                  Способы доставки ({YANDEX_PVZ_DELIVERY_TYPE_LABEL})
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {CHECKOUT_PVZ_METHODS.map((method) => (
                    <InfoChip key={method.key}>{method.carrierName}</InfoChip>
                  ))}
                </div>
                <p className="mt-2 text-xs text-ink-muted">
                  В оформлении заказа: {CHECKOUT_PVZ_METHODS.map((m) => m.label).join(', ')}
                </p>
              </div>

              <p className="text-sm text-ink-muted">
                При оформлении укажите адрес (город, улица, дом) — можно выбрать из подсказок или
                ввести вручную.
              </p>
            </div>
          </ModeCard>

          <Card as="section" padding="md">
            <h2 className="text-lg font-semibold text-ink">Доставка по регионам</h2>
            <p className="mb-4 mt-1 text-sm text-ink-muted">
              Полный перечень для проверки в Яндекс Товарах: тип «{YANDEX_PVZ_DELIVERY_TYPE_LABEL}»,
              службы «СДЭК», «Почта России», «Яндекс Доставка».
            </p>
            <YandexDeliveryMatrixTable rows={rows} />
          </Card>
        </div>
      )}
      <YandexWebmasterCounter />
    </div>
  );
}
