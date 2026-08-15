import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { apiRequest } from '../../utils/apiClient';
import { fetchOrganization } from '../../redux/slices/OrganizationSlice';
import { formatServerDate } from '../../utils/serverDate';
import {
  formatShopPartQty,
  formatShopPartUnit,
  priceWithMarkup,
  shopLineSum,
  shopPartDisplayName,
  shopPartPricingOptions,
} from '../../utils/repairOrderShopPartUtils';
import { Button, EmptyState, Skeleton } from '../../components/UI';

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

function dash(value) {
  const text = value == null ? '' : String(value).trim();
  return text || '';
}

function workExecutorName(work) {
  if ((work.executors || []).length) {
    return (work.executors || [])
      .map((ex) => ex.employee?.name)
      .filter(Boolean)
      .join(', ');
  }
  return work.executor?.name || '';
}

function PrintTable({ columns, children, className = '' }) {
  return (
    <table className={`w-full border-collapse text-[11px] leading-snug text-black ${className}`}>
      <thead>
        <tr>
          {columns.map((col) => (
            <th
              key={col.key}
              className={`border border-black px-1.5 py-1 text-left font-semibold ${col.className || ''}`}
            >
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

function Cell({ children, className = '', align = 'left', ...props }) {
  const alignClass =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return (
    <td
      className={`border border-black px-1.5 py-1 align-top ${alignClass} ${className}`}
      {...props}
    >
      {children}
    </td>
  );
}

export default function RepairOrderPrintPage() {
  const { orderId } = useParams();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const org = useSelector((state) => state.organization.data);
  const orgId = user?.organization_id;

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (orgId) {
      dispatch(fetchOrganization(orgId));
    }
  }, [dispatch, orgId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!orderId) return;
      setLoading(true);
      setError('');
      try {
        const data = await apiRequest(`/autoservice/repair-orders/${orderId}`);
        if (!cancelled) setOrder(data);
      } catch (e) {
        if (!cancelled) {
          setOrder(null);
          setError(e?.message || 'Не удалось загрузить заказ-наряд');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const totals = useMemo(() => {
    if (!order) return { worksTotal: 0, shopTotal: 0, grand: 0 };
    const works = order.works || [];
    const shop = order.shop_parts || [];
    const worksTotal =
      order.works_total ?? works.reduce((s, w) => s + lineSum(w.qty, w.unit_price), 0);
    const shopTotal =
      order.shop_parts_total ??
      shop.reduce(
        (s, p) =>
          s +
          (Number(p.line_sum) ||
            shopLineSum(p.qty, p.unit_price, p.markup_percent, shopPartPricingOptions(p))),
        0,
      );
    const grand = order.grand_total ?? worksTotal + shopTotal;
    return { worksTotal, shopTotal, grand };
  }, [order]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-[210mm] space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <EmptyState
          illustration="error"
          title="Не удалось открыть документ"
          description={error || 'Заказ-наряд не найден'}
        />
        <div className="mt-4 flex justify-center">
          <Button as={Link} to="/autoservice/orders" variant="secondary">
            К заказ-нарядам
          </Button>
        </div>
      </div>
    );
  }

  const vehicle = order.vehicle || {};
  const works = order.works || [];
  const shopParts = order.shop_parts || [];
  const clientParts = order.client_parts || [];
  const receivedDate = formatServerDate(order.created_at || order.scheduled_at);
  const completedDate =
    order.status === 'completed' || order.status === 'done'
      ? formatServerDate(order.updated_at || order.scheduled_end_at)
      : formatServerDate(order.scheduled_end_at);
  const defectComment = [order.client_comment, order.staff_comment]
    .map((v) => (v || '').trim())
    .filter(Boolean)
    .join('\n');

  const workColumns = [
    { key: 'n', label: '№', className: 'w-8' },
    { key: 'code', label: 'Код', className: 'w-12' },
    { key: 'title', label: 'Наименование работ' },
    { key: 'qty', label: 'Количество', className: 'w-16' },
    { key: 'price', label: 'Цена, руб', className: 'w-20' },
    { key: 'sum', label: 'Сумма, руб', className: 'w-20' },
    { key: 'ex', label: 'Исполнитель', className: 'w-28' },
    { key: 'sign', label: 'Подпись', className: 'w-20' },
  ];

  const materialColumns = [
    { key: 'n', label: '№', className: 'w-8' },
    { key: 'code', label: 'Код', className: 'w-12' },
    { key: 'title', label: 'Наименование материала' },
    { key: 'qty', label: 'Количество', className: 'w-20' },
    { key: 'price', label: 'Цена, руб', className: 'w-20' },
    { key: 'sum', label: 'Сумма, руб', className: 'w-20' },
  ];

  return (
    <div className="bg-white text-black">
      <div className="repair-order-print-toolbar sticky top-0 z-10 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[210mm] flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">Заказ-наряд №{order.order_number}</p>
            <p className="text-xs text-ink-muted">Макет ещё в разработке</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button as={Link} to="/autoservice/orders" variant="secondary" size="sm">
              Закрыть
            </Button>
            <Button type="button" size="sm" onClick={handlePrint}>
              Печать
            </Button>
          </div>
        </div>
      </div>

      <article className="repair-order-print-sheet mx-auto max-w-[210mm] px-6 py-6">
        <header className="grid grid-cols-2 gap-6 border-b border-black pb-3">
          <div className="space-y-1 text-[12px]">
            <h1 className="mb-2 text-[16px] font-bold leading-tight">
              Заказ-наряд {order.order_number}
            </h1>
            <p>
              <span className="font-semibold">Дата приема заказа</span> {receivedDate}
            </p>
            <p>
              <span className="font-semibold">Дата выполнения заказа</span>{' '}
              {completedDate === '—' ? '' : completedDate}
            </p>
            <p>
              <span className="font-semibold">№ гарантийного талона</span>
            </p>
            <p>
              <span className="font-semibold">Заказ принял</span> {dash(order.accepted_by?.name)}
            </p>
          </div>
          <div className="space-y-1 text-[12px]">
            <p>
              <span className="font-semibold">Исполнитель</span> {dash(org?.name) || 'Автосервис'}
            </p>
            <p>{dash(org?.address)}</p>
            <p>
              <span className="font-semibold">ИНН</span>
            </p>
            <p>
              <span className="font-semibold">Контактный телефон</span> {dash(org?.phone)}
            </p>
          </div>
        </header>

        <section className="border-b border-black py-3 text-[12px]">
          <p className="mb-1 font-bold">Заказчик</p>
          <p>{dash(order.client?.name)}</p>
          <p>Тел. {dash(order.client?.phone)}</p>
        </section>

        <section className="py-3">
          <table className="w-full border-collapse text-[11px]">
            <tbody>
              <tr>
                <Cell>
                  <span className="font-semibold">Марка</span> {dash(vehicle.make)}
                </Cell>
                <Cell>
                  <span className="font-semibold">Гос. номер</span> {dash(vehicle.plate)}
                </Cell>
                <Cell rowSpan={3} className="w-[34%]">
                  <span className="font-semibold">VIN</span> {dash(vehicle.vin)}
                  <div className="mt-3 min-h-[4.5rem] whitespace-pre-wrap">
                    <span className="font-semibold">Описание дефектов / комментарий:</span>
                    {defectComment ? (
                      <span className="mt-1 block">{defectComment}</span>
                    ) : null}
                  </div>
                </Cell>
              </tr>
              <tr>
                <Cell>
                  <span className="font-semibold">Модель</span> {dash(vehicle.model)}
                </Cell>
                <Cell>
                  <span className="font-semibold">Номер кузова</span>
                </Cell>
              </tr>
              <tr>
                <Cell>
                  <span className="font-semibold">Год выпуска</span> {dash(vehicle.year)}
                </Cell>
                <Cell>
                  <span className="font-semibold">Номер двигателя</span>
                </Cell>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="pt-1">
          <h2 className="mb-1 text-[13px] font-bold">Работы</h2>
          <PrintTable columns={workColumns}>
            {works.length === 0 ? (
              <tr>
                <Cell className="text-center text-[11px]" colSpan={8}>
                  —
                </Cell>
              </tr>
            ) : (
              works.map((w, index) => (
                <tr key={w.id || `${w.position}-${w.title}`}>
                  <Cell align="center">{index + 1}</Cell>
                  <Cell align="center">{w.catalog_work_id || w.id || ''}</Cell>
                  <Cell>{w.title}</Cell>
                  <Cell align="center">{w.qty}</Cell>
                  <Cell align="right">{formatMoney(w.unit_price)}</Cell>
                  <Cell align="right">
                    {formatMoney(w.line_sum ?? lineSum(w.qty, w.unit_price))}
                  </Cell>
                  <Cell>{workExecutorName(w)}</Cell>
                  <Cell />
                </tr>
              ))
            )}
            <tr>
              <td
                colSpan={5}
                className="border border-black px-1.5 py-1 text-right text-[11px] font-semibold"
              >
                Стоимость работ, руб
              </td>
              <td className="border border-black px-1.5 py-1 text-right text-[11px] font-bold">
                {formatMoney(totals.worksTotal)}
              </td>
              <td className="border border-black" colSpan={2} />
            </tr>
          </PrintTable>
        </section>

        <section className="pt-4">
          <h2 className="mb-1 text-[13px] font-bold">Материалы исполнителя</h2>
          <PrintTable columns={materialColumns}>
            {shopParts.length === 0 ? (
              <tr>
                <Cell className="text-center" colSpan={6}>
                  —
                </Cell>
              </tr>
            ) : (
              shopParts.map((p, index) => {
                const name = p.display_name || shopPartDisplayName(p);
                const qtyLabel = `${formatShopPartQty(p.qty, p.unit || 'pcs')} ${formatShopPartUnit(p.unit || 'pcs')}`;
                const clientPrice =
                  p.price_with_markup ??
                  priceWithMarkup(p.unit_price, p.markup_percent, shopPartPricingOptions(p));
                const sum =
                  p.line_sum ??
                  shopLineSum(p.qty, p.unit_price, p.markup_percent, shopPartPricingOptions(p));
                const code = p.partnumber || p.rossko_partnumber || p.id || '';
                return (
                  <tr key={p.id || `${p.position}-${p.title}`}>
                    <Cell align="center">{index + 1}</Cell>
                    <Cell align="center">{code}</Cell>
                    <Cell>{name}</Cell>
                    <Cell align="center">{qtyLabel}</Cell>
                    <Cell align="right">{formatMoney(clientPrice)}</Cell>
                    <Cell align="right">{formatMoney(sum)}</Cell>
                  </tr>
                );
              })
            )}
            <tr>
              <td
                colSpan={4}
                className="border border-black px-1.5 py-1 text-right text-[11px] font-semibold"
              >
                Стоимость материалов, руб
              </td>
              <td
                colSpan={2}
                className="border border-black px-1.5 py-1 text-right text-[11px] font-bold"
              >
                {formatMoney(totals.shopTotal)}
              </td>
            </tr>
          </PrintTable>
        </section>

        <p className="mt-3 text-right text-[13px] font-bold">
          Итого, за работы и материалы, руб {formatMoney(totals.grand)}
        </p>

        <section className="pt-4">
          <h2 className="mb-1 text-[13px] font-bold">Материалы заказчика</h2>
          <table className="w-full max-w-md border-collapse text-[11px]">
            <thead>
              <tr>
                <th className="border border-black px-1.5 py-1 text-left font-semibold">
                  Наименование материала
                </th>
                <th className="border border-black px-1.5 py-1 text-left font-semibold w-24">
                  Количество
                </th>
              </tr>
            </thead>
            <tbody>
              {clientParts.length === 0 ? (
                <tr>
                  <td className="border border-black px-1.5 py-1" colSpan={2}>
                    —
                  </td>
                </tr>
              ) : (
                clientParts.map((p) => (
                  <tr key={p.id || `${p.position}-${p.title}`}>
                    <td className="border border-black px-1.5 py-1">{p.title}</td>
                    <td className="border border-black px-1.5 py-1 text-center">
                      {p.qty} {formatShopPartUnit(p.unit || 'pcs')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <footer className="mt-8 space-y-5 border-t border-black pt-4 text-[12px]">
          <p>
            Заказ и замененные дефектные детали (остатки материалов) получил. Изделие проверено в
            моем присутствии.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <p>
              Дата <span className="inline-block min-w-[6rem] border-b border-black">&nbsp;</span>
            </p>
            <p>
              Подпись заказчика{' '}
              <span className="inline-block min-w-[5rem] border-b border-black">&nbsp;</span> /{' '}
              <span className="inline-block min-w-[5rem] border-b border-black">&nbsp;</span>
            </p>
            <p>
              Подпись исполнителя{' '}
              <span className="inline-block min-w-[5rem] border-b border-black">&nbsp;</span> /{' '}
              <span className="inline-block min-w-[5rem] border-b border-black">&nbsp;</span>
            </p>
          </div>
        </footer>
      </article>

      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body { background: white !important; }
          .repair-order-print-toolbar { display: none !important; }
          .repair-order-print-sheet { max-width: none !important; padding: 0 !important; }
        }
      `}</style>
    </div>
  );
}
