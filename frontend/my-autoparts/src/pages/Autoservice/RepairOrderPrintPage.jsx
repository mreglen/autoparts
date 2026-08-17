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
  return text;
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

function padItems(items, minCount) {
  const rows = [...(items || [])];
  while (rows.length < minCount) rows.push(null);
  return rows;
}

function Field({ label, children }) {
  return (
    <p className="leading-tight">
      <span className="font-semibold">{label}</span>
      {children ? <> {children}</> : null}
    </p>
  );
}

function PrintTable({ columns, children }) {
  return (
    <table className="w-full border-collapse text-[10px] leading-tight text-black">
      <thead>
        <tr>
          {columns.map((col) => (
            <th
              key={col.key}
              className={`border border-black px-1 py-0.5 text-left font-semibold ${col.className || ''}`}
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
      className={`h-5 border border-black px-1 py-0.5 align-middle ${alignClass} ${className}`}
      {...props}
    >
      {children || '\u00a0'}
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
    if (orgId) dispatch(fetchOrganization(orgId));
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

  const workRows = padItems(works, 4);
  const shopRows = padItems(shopParts, 2);
  const clientRows = padItems(clientParts, 2);

  const workColumns = [
    { key: 'n', label: '№', className: 'w-7' },
    { key: 'code', label: 'Код', className: 'w-12' },
    { key: 'title', label: 'Наименование работ' },
    { key: 'qty', label: 'Количество', className: 'w-[4.5rem]' },
    { key: 'price', label: 'Цена, руб', className: 'w-[4.5rem]' },
    { key: 'sum', label: 'Сумма, руб', className: 'w-[4.5rem]' },
    { key: 'ex', label: 'Исполнитель', className: 'w-28' },
    { key: 'sign', label: 'Подпись', className: 'w-16' },
  ];

  const materialColumns = [
    { key: 'n', label: '№', className: 'w-7' },
    { key: 'code', label: 'Код', className: 'w-12' },
    { key: 'title', label: 'Наименование материала' },
    { key: 'qty', label: 'Количество', className: 'w-[4.5rem]' },
    { key: 'price', label: 'Цена, руб', className: 'w-[4.5rem]' },
    { key: 'sum', label: 'Сумма, руб', className: 'w-[4.5rem]' },
    { key: 'ex', label: 'Исполнитель', className: 'w-28' },
    { key: 'sign', label: 'Подпись', className: 'w-16' },
  ];

  return (
    <div className="min-h-screen bg-gray-100 text-black print:min-h-0 print:bg-white">
      <div className="repair-order-print-toolbar sticky top-0 z-10 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[210mm] flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-ink">Заказ-наряд №{order.order_number}</p>
          <div className="flex flex-wrap gap-2">
            <Button as={Link} to="/autoservice/orders" variant="secondary" size="sm">
              Закрыть
            </Button>
            <Button type="button" size="sm" onClick={() => window.print()}>
              Печать
            </Button>
          </div>
        </div>
      </div>

      <article className="repair-order-print-sheet mx-auto my-4 w-[210mm] bg-white px-[10mm] py-[8mm] shadow-sm print:my-0 print:w-auto print:px-0 print:py-0 print:shadow-none">
        <header className="grid grid-cols-2 gap-x-8 gap-y-1 text-[11px]">
          <div className="space-y-0.5">
            <h1 className="mb-1 text-[15px] font-bold leading-none">
              Заказ-наряд №{order.order_number}
            </h1>
            <Field label="Дата приема заказа">{receivedDate}</Field>
            <Field label="Дата выполнения заказа">
              {completedDate === '—' ? '' : completedDate}
            </Field>
            <Field label="№ гарантийного талона" />
            <Field label="Заказ принял">{dash(order.accepted_by?.name)}</Field>
          </div>
          <div className="space-y-0.5">
            <Field label="Исполнитель" />
            <p className="font-medium leading-tight">{dash(org?.name) || 'Автосервис'}</p>
            <Field label="Адрес">{dash(org?.address)}</Field>
            <Field label="ИНН">{dash(org?.inn)}</Field>
            <Field label="Контактный телефон">{dash(org?.phone)}</Field>
          </div>
        </header>

        <section className="mt-2 border-t border-black pt-1.5 text-[11px]">
          <p className="font-bold leading-tight">Заказчик</p>
          <Field label="ФИО">{dash(order.client?.name)}</Field>
          <Field label="Телефон">{dash(order.client?.phone)}</Field>
        </section>

        <table className="mt-2 w-full border-collapse text-[11px] leading-tight">
          <tbody>
            <tr>
              <Cell className="w-[33%]">
                <span className="font-semibold">Марка</span> {dash(vehicle.make)}
              </Cell>
              <Cell className="w-[27%]">
                <span className="font-semibold">Гос. номер</span> {dash(vehicle.plate)}
              </Cell>
              <Cell rowSpan={3} className="align-top">
                <p>
                  <span className="font-semibold">VIN</span> {dash(vehicle.vin)}
                </p>
                <p className="mt-2 font-semibold">Описание дефектов / комментарий</p>
                <p className="mt-0.5 min-h-[2.6rem] whitespace-pre-wrap">{defectComment}</p>
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

        <section className="mt-2">
          <h2 className="mb-0.5 text-[12px] font-bold">Работы</h2>
          <PrintTable columns={workColumns}>
            {workRows.map((w, index) => (
              <tr key={w?.id || `work-empty-${index}`}>
                <Cell align="center">{index + 1}</Cell>
                <Cell align="center">{w ? w.catalog_work_id || w.id || '' : ''}</Cell>
                <Cell>{w?.title || ''}</Cell>
                <Cell align="center">{w?.qty ?? ''}</Cell>
                <Cell align="right">{w ? formatMoney(w.unit_price) : ''}</Cell>
                <Cell align="right">
                  {w ? formatMoney(w.line_sum ?? lineSum(w.qty, w.unit_price)) : ''}
                </Cell>
                <Cell>{w ? workExecutorName(w) : ''}</Cell>
                <Cell />
              </tr>
            ))}
            <tr>
              <td
                colSpan={5}
                className="border border-black px-1 py-0.5 text-right text-[10px] font-semibold"
              >
                Стоимость работ, руб
              </td>
              <td className="border border-black px-1 py-0.5 text-right text-[10px] font-bold">
                {formatMoney(totals.worksTotal)}
              </td>
              <td className="border border-black" colSpan={2} />
            </tr>
          </PrintTable>
        </section>

        <section className="mt-2">
          <h2 className="mb-0.5 text-[12px] font-bold">Материалы исполнителя</h2>
          <PrintTable columns={materialColumns}>
            {shopRows.map((p, index) => {
              if (!p) {
                return (
                  <tr key={`shop-empty-${index}`}>
                    <Cell align="center">{index + 1}</Cell>
                    <Cell />
                    <Cell />
                    <Cell />
                    <Cell />
                    <Cell />
                    <Cell />
                    <Cell />
                  </tr>
                );
              }
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
                  <Cell />
                  <Cell />
                </tr>
              );
            })}
            <tr>
              <td
                colSpan={5}
                className="border border-black px-1 py-0.5 text-right text-[10px] font-semibold"
              >
                Стоимость материалов, руб
              </td>
              <td className="border border-black px-1 py-0.5 text-right text-[10px] font-bold">
                {formatMoney(totals.shopTotal)}
              </td>
              <td className="border border-black" colSpan={2} />
            </tr>
          </PrintTable>
        </section>

        <p className="mt-1.5 text-right text-[12px] font-bold">
          Итого, за работы и материалы, руб {formatMoney(totals.grand)}
        </p>

        <section className="mt-2">
          <h2 className="mb-0.5 text-[12px] font-bold">Материалы заказчика</h2>
          <table className="w-full max-w-[70%] border-collapse text-[10px] leading-tight">
            <thead>
              <tr>
                <th className="border border-black px-1 py-0.5 text-left font-semibold">
                  Наименование материала
                </th>
                <th className="w-28 border border-black px-1 py-0.5 text-left font-semibold">
                  Количество
                </th>
              </tr>
            </thead>
            <tbody>
              {clientRows.map((p, index) => (
                <tr key={p?.id || `client-empty-${index}`}>
                  <Cell>{p?.title || ''}</Cell>
                  <Cell align="center">
                    {p ? `${p.qty} ${formatShopPartUnit(p.unit || 'pcs')}` : ''}
                  </Cell>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <footer className="mt-3 space-y-2 text-[11px] leading-tight">
          <p>
            Заказ и замененные дефектные детали (остатки материалов) получил. Изделие проверено в
            моем присутствии.
          </p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2">
            <p>
              Дата <span className="inline-block min-w-[7rem] border-b border-black">&nbsp;</span>
            </p>
            <p>
              Подпись заказчика{' '}
              <span className="inline-block min-w-[4.5rem] border-b border-black">&nbsp;</span>
              /
              <span className="inline-block min-w-[8rem] border-b border-black">&nbsp;</span>
            </p>
            <p className="col-span-2">
              Подпись исполнителя{' '}
              <span className="inline-block min-w-[4.5rem] border-b border-black">&nbsp;</span>
              /
              <span className="inline-block min-w-[8rem] border-b border-black">&nbsp;</span>
            </p>
          </div>
        </footer>
      </article>

      <style>{`
        @page { size: A4 portrait; margin: 8mm; }
        @media print {
          html, body { background: white !important; height: auto !important; }
          .repair-order-print-toolbar { display: none !important; }
          .repair-order-print-sheet {
            width: auto !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}
