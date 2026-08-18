import { useEffect, useMemo, useRef, useState } from 'react';
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
import { Button, EmptyState, Modal, Skeleton } from '../../components/UI';
import AutoserviceDocumentClientEditor from '../../components/Autoservice/AutoserviceDocumentClientEditor';
import AutoservicePrintPreview from '../../components/Autoservice/AutoservicePrintPreview';
import { downloadPrintSheetPdf } from '../../utils/downloadPrintPdf';
import {
  clientRequisitesChanged,
  clientToOrderCustomer,
  emptyClientRequisites,
  isGuestClient,
  resolveClientForDocuments,
  saveAutoserviceClientRequisites,
} from '../../utils/autoserviceClientRequisites';

const EMPTY_FORM = {
  orderNumber: '',
  receivedDate: '',
  completedDate: '',
  warrantyNumber: '',
  acceptedBy: '',
  contractorName: '',
  contractorAddress: '',
  contractorInn: '',
  contractorPhone: '',
  clientName: '',
  clientPhone: '',
  vehicleMake: '',
  vehicleModel: '',
  vehiclePlate: '',
  vehicleVin: '',
  vehicleYear: '',
  vehicleBodyNumber: '',
  vehicleEngineNumber: '',
  defectComment: '',
  signDate: '',
  clientSignName: '',
  contractorSignName: '',
};

const REQUIRED_FIELDS = [
  ['orderNumber', 'Номер заказ-наряда'],
  ['receivedDate', 'Дата приема заказа'],
  ['contractorName', 'Исполнитель'],
  ['clientName', 'Заказчик'],
];
const REQUIRED_FIELD_KEYS = new Set(REQUIRED_FIELDS.map(([key]) => key));

const MODAL_FIELDS = [
  { key: 'orderNumber', label: 'Номер заказ-наряда' },
  { key: 'receivedDate', label: 'Дата приема заказа' },
  { key: 'completedDate', label: 'Дата выполнения заказа' },
  { key: 'warrantyNumber', label: '№ гарантийного талона' },
  { key: 'acceptedBy', label: 'Заказ принял' },
  { key: 'contractorName', label: 'Исполнитель' },
  { key: 'contractorAddress', label: 'Адрес исполнителя' },
  { key: 'contractorInn', label: 'ИНН исполнителя' },
  { key: 'contractorPhone', label: 'Телефон исполнителя' },
  { key: 'vehicleMake', label: 'Марка' },
  { key: 'vehicleModel', label: 'Модель' },
  { key: 'vehicleYear', label: 'Год выпуска' },
  { key: 'vehiclePlate', label: 'Гос. номер' },
  { key: 'vehicleVin', label: 'VIN' },
  { key: 'vehicleBodyNumber', label: 'Номер кузова' },
  { key: 'vehicleEngineNumber', label: 'Номер двигателя' },
  { key: 'defectComment', label: 'Описание дефектов / комментарий', multiline: true },
  { key: 'signDate', label: 'Дата подписи' },
  { key: 'clientSignName', label: 'Подпись заказчика (ф.и.о.)' },
  { key: 'contractorSignName', label: 'Подпись исполнителя (ф.и.о.)' },
];

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

function workExecutorName(work) {
  if ((work.executors || []).length) {
    return (work.executors || [])
      .map((ex) => ex.employee?.name)
      .filter(Boolean)
      .join(', ');
  }
  return work.executor?.name || '';
}

function rowsOrEmpty(items) {
  return items.length > 0 ? items : [null];
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

function TableTotalRow({ label, value }) {
  return (
    <tr>
      <td colSpan={3} className="border-0 p-0" />
      <td
        colSpan={2}
        className="border-0 px-1 py-0.5 text-right align-middle text-[10px] font-semibold"
      >
        {label}
      </td>
      <td className="h-5 border border-black px-1 py-0.5 text-right align-middle text-[10px] font-bold">
        {value}
      </td>
      <td colSpan={2} className="border-0 p-0" />
    </tr>
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

function FieldEdit({ name, form, autoForm, onChange, className = '', multiline = false, ...rest }) {
  const value = form[name] ?? '';
  const auto = autoForm[name] ?? '';
  const isManual = String(value).trim() !== String(auto).trim();
  const cls = `upd-edit ${isManual ? 'is-manual' : ''} ${className}`;
  if (multiline) {
    return (
      <textarea
        className={`${cls} min-h-[2.6rem] w-full resize-none`}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        {...rest}
      />
    );
  }
  return (
    <input
      className={cls}
      value={value}
      onChange={(e) => onChange(name, e.target.value)}
      {...rest}
    />
  );
}

function emptyDate(value) {
  return !value || value === '—';
}

function buildAutoForm(order, org, client) {
  const vehicle = order?.vehicle || {};
  const completedDate =
    order.status === 'completed' || order.status === 'done'
      ? formatServerDate(order.updated_at || order.scheduled_end_at)
      : formatServerDate(order.scheduled_end_at);
  const defectComment = [order.client_comment, order.staff_comment]
    .map((v) => (v || '').trim())
    .filter(Boolean)
    .join('\n');
  const customer = clientToOrderCustomer(client || order?.client);
  return {
    ...EMPTY_FORM,
    orderNumber: String(order.order_number || ''),
    receivedDate: formatServerDate(order.created_at || order.scheduled_at),
    completedDate: emptyDate(completedDate) ? '' : completedDate,
    acceptedBy: order.accepted_by?.name || '',
    contractorName: org?.legal_name || org?.name || '',
    contractorAddress: org?.legal_address || org?.address || '',
    contractorInn: org?.inn || '',
    contractorPhone: org?.phone || '',
    clientName: customer.clientName,
    clientPhone: customer.clientPhone,
    vehicleMake: vehicle.make || '',
    vehicleModel: vehicle.model || '',
    vehiclePlate: vehicle.plate || '',
    vehicleVin: vehicle.vin || '',
    vehicleYear: vehicle.year != null ? String(vehicle.year) : '',
    defectComment,
    clientSignName: client?.name || order.client?.name || '',
    contractorSignName: order.accepted_by?.name || org?.director_name || '',
  };
}

export default function RepairOrderPrintPage() {
  const { orderId } = useParams();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const org = useSelector((state) => state.organization.data);
  const orgId = user?.organization_id;
  const seeded = useRef(false);
  const sheetRef = useRef(null);

  const [order, setOrder] = useState(null);
  const [client, setClient] = useState(null);
  const [clientForm, setClientForm] = useState(emptyClientRequisites());
  const [clientSaving, setClientSaving] = useState(false);
  const [clientError, setClientError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [autoForm, setAutoForm] = useState(EMPTY_FORM);
  const [editOpen, setEditOpen] = useState(false);
  const [printHint, setPrintHint] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    if (orgId) dispatch(fetchOrganization(orgId));
  }, [dispatch, orgId]);

  useEffect(() => {
    document.documentElement.classList.add('repair-order-print-root');
    return () => {
      document.documentElement.classList.remove('repair-order-print-root');
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!orderId) return;
      setLoading(true);
      setError('');
      try {
        const data = await apiRequest(`/autoservice/repair-orders/${orderId}`);
        if (cancelled) return;
        const resolved = await resolveClientForDocuments(data?.client);
        if (cancelled) return;
        setOrder(data);
        setClient(resolved || data?.client || null);
        setClientForm(emptyClientRequisites(resolved || data?.client));
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

  useEffect(() => {
    if (!order || seeded.current) return;
    if (orgId && !org) return;
    const next = buildAutoForm(order, org, client);
    setAutoForm(next);
    setForm(next);
    seeded.current = true;
  }, [order, org, orgId, client]);

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

  const missingRequired = REQUIRED_FIELDS.filter(([key]) => !String(form[key] || '').trim());
  const canPrint = missingRequired.length === 0;

  const applyClientToSheet = (clientLike) => {
    const customer = clientToOrderCustomer(clientLike);
    setForm((prev) => ({ ...prev, ...customer }));
    setAutoForm((prev) => ({ ...prev, ...customer }));
  };

  const handleClientFormChange = (next) => {
    setClientForm(next);
    setClientError('');
    applyClientToSheet({ ...(client || {}), ...next });
  };

  const handleConfirmEdit = async () => {
    if (client?.id && clientRequisitesChanged(clientForm, emptyClientRequisites(client))) {
      setClientSaving(true);
      setClientError('');
      try {
        const updated = await saveAutoserviceClientRequisites(client.id, clientForm, {
          isGuest: isGuestClient(client),
        });
        setClient(updated);
        setClientForm(emptyClientRequisites(updated));
        applyClientToSheet(updated);
      } catch (err) {
        setClientError(err?.message || 'Не удалось сохранить клиента');
        setClientSaving(false);
        return;
      }
      setClientSaving(false);
    }
    setEditOpen(false);
  };

  const setField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setPrintHint('');
  };

  const handlePrint = () => {
    if (!canPrint) {
      setPrintHint(`Заполните: ${missingRequired.map(([, label]) => label).join(', ')}`);
      setEditOpen(true);
      return;
    }
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!canPrint) {
      setPrintHint(`Заполните: ${missingRequired.map(([, label]) => label).join(', ')}`);
      setEditOpen(true);
      return;
    }
    setPdfBusy(true);
    setPrintHint('');
    try {
      await downloadPrintSheetPdf({
        element: sheetRef.current,
        filename: `Заказ-наряд №${order.order_number}`,
        orientation: 'portrait',
      });
    } catch (e) {
      setPrintHint(e?.message || 'Не удалось сохранить PDF');
    } finally {
      setPdfBusy(false);
    }
  };

  const editControl = (name, extraClass = '', extra = {}) => (
    <FieldEdit
      name={name}
      form={form}
      autoForm={autoForm}
      onChange={setField}
      className={extraClass}
      {...extra}
    />
  );

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

  const works = order.works || [];
  const shopParts = order.shop_parts || [];
  const clientParts = order.client_parts || [];
  const workRows = rowsOrEmpty(works);
  const shopRows = rowsOrEmpty(shopParts);
  const clientRows = rowsOrEmpty(clientParts);

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
    <div className="repair-order-print-page min-h-screen bg-gray-100 text-black print:min-h-0 print:bg-white">
      <div className="repair-order-print-toolbar sticky top-0 z-10 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[210mm] flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-ink">Заказ-наряд №{order.order_number}</p>
          <div className="flex flex-wrap gap-2">
            <Button as={Link} to="/autoservice/orders" variant="secondary" size="sm">
              Закрыть
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setEditOpen(true)}>
              Редактировать
            </Button>
            <Button type="button" size="sm" disabled={!canPrint} onClick={handlePrint}>
              Печать
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!canPrint || pdfBusy}
              loading={pdfBusy}
              onClick={handleDownloadPdf}
            >
              Скачать PDF
            </Button>
          </div>
        </div>
        {!canPrint || printHint ? (
          <p className="mx-auto mt-2 max-w-[210mm] text-xs text-red-600">
            {printHint || 'Печать недоступна: заполните обязательные поля или нажмите «Редактировать».'}
          </p>
        ) : null}
      </div>

      <AutoservicePrintPreview>
      <article
        ref={sheetRef}
        data-print-sheet="true"
        className="repair-order-print-sheet my-4 shadow-sm print:my-0 print:shadow-none"
      >
        <header className="grid grid-cols-2 gap-x-8 gap-y-1 text-[11px]">
          <div className="space-y-0.5">
            <h1 className="mb-1 text-[15px] font-bold leading-none">
              Заказ-наряд №{editControl('orderNumber', 'upd-edit-inline min-w-[3rem] font-bold')}
            </h1>
            <Field label="Дата приема заказа">
              {editControl('receivedDate', 'upd-edit-inline min-w-[6rem]')}
            </Field>
            <Field label="Дата выполнения заказа">
              {editControl('completedDate', 'upd-edit-inline min-w-[6rem]')}
            </Field>
            <Field label="№ гарантийного талона">
              {editControl('warrantyNumber', 'upd-edit-inline min-w-[6rem]')}
            </Field>
            <Field label="Заказ принял">
              {editControl('acceptedBy', 'upd-edit-inline min-w-[8rem]')}
            </Field>
          </div>
          <div className="space-y-0.5">
            <Field label="Исполнитель" />
            <p className="font-medium leading-tight">
              {editControl('contractorName', 'upd-edit-inline min-w-[10rem] font-medium')}
            </p>
            <Field label="Адрес">
              {editControl('contractorAddress', 'upd-edit-inline min-w-[10rem]')}
            </Field>
            <Field label="ИНН">
              {editControl('contractorInn', 'upd-edit-inline min-w-[6rem]')}
            </Field>
            <Field label="Контактный телефон">
              {editControl('contractorPhone', 'upd-edit-inline min-w-[7rem]')}
            </Field>
          </div>
        </header>

        <section className="mt-2 border-t border-black pt-1.5 text-[11px]">
          <p className="font-bold leading-tight">Заказчик</p>
          <Field label="ФИО">{editControl('clientName', 'upd-edit-inline min-w-[10rem]')}</Field>
          <Field label="Телефон">{editControl('clientPhone', 'upd-edit-inline min-w-[8rem]')}</Field>
        </section>

        <table className="mt-2 w-full border-collapse text-[11px] leading-tight">
          <tbody>
            <tr>
              <Cell className="w-[33%]">
                <span className="font-semibold">Марка</span>{' '}
                {editControl('vehicleMake', 'upd-edit-inline min-w-[5rem]')}
              </Cell>
              <Cell className="w-[27%]">
                <span className="font-semibold">Гос. номер</span>{' '}
                {editControl('vehiclePlate', 'upd-edit-inline min-w-[5rem]')}
              </Cell>
              <Cell>
                <span className="font-semibold">VIN</span>{' '}
                {editControl('vehicleVin', 'upd-edit-inline min-w-[8rem]')}
              </Cell>
            </tr>
            <tr>
              <Cell>
                <span className="font-semibold">Модель</span>{' '}
                {editControl('vehicleModel', 'upd-edit-inline min-w-[5rem]')}
              </Cell>
              <Cell>
                <span className="font-semibold">Номер кузова</span>{' '}
                {editControl('vehicleBodyNumber', 'upd-edit-inline min-w-[5rem]')}
              </Cell>
              <Cell rowSpan={2} className="align-top">
                <p className="font-semibold">Описание дефектов / комментарий</p>
                {editControl('defectComment', 'mt-0.5', { multiline: true })}
              </Cell>
            </tr>
            <tr>
              <Cell>
                <span className="font-semibold">Год выпуска</span>{' '}
                {editControl('vehicleYear', 'upd-edit-inline min-w-[4rem]')}
              </Cell>
              <Cell>
                <span className="font-semibold">Номер двигателя</span>{' '}
                {editControl('vehicleEngineNumber', 'upd-edit-inline min-w-[5rem]')}
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
            <TableTotalRow label="Стоимость работ, руб" value={formatMoney(totals.worksTotal)} />
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
            <TableTotalRow label="Стоимость материалов, руб" value={formatMoney(totals.shopTotal)} />
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
          <div className="grid grid-cols-2 items-start gap-x-8">
            <p>
              Дата {editControl('signDate', 'upd-edit-inline min-w-[7rem]')}
            </p>
            <div className="space-y-2 text-right">
              <p className="flex items-end justify-end gap-1">
                Подпись заказчика
                <span className="inline-block min-w-[4.5rem] border-b border-black">&nbsp;</span>
                /
                {editControl('clientSignName', 'upd-edit-inline min-w-[8rem]')}
              </p>
              <p className="flex items-end justify-end gap-1">
                Подпись исполнителя
                <span className="inline-block min-w-[4.5rem] border-b border-black">&nbsp;</span>
                /
                {editControl('contractorSignName', 'upd-edit-inline min-w-[8rem]')}
              </p>
            </div>
          </div>
        </footer>
      </article>
      </AutoservicePrintPreview>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Реквизиты заказ-наряда"
        size="lg"
        wrapperClassName="z-[140]"
      >
        <p className="mb-3 text-sm text-gray-500">
          Серым уже подставлено из заказа и организации. Реквизиты клиента сохраняются в его карточку.
        </p>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          <AutoserviceDocumentClientEditor
            client={client}
            form={clientForm}
            onChange={handleClientFormChange}
            disabled={clientSaving}
            idPrefix="order-client"
          />
          {clientError ? <p className="text-sm text-red-600">{clientError}</p> : null}
          {MODAL_FIELDS.map((field) => {
            const filled = Boolean(String(form[field.key] || '').trim());
            return (
              <label key={field.key} className="block text-sm">
                <span className="mb-1 flex items-center gap-2 text-xs font-medium text-gray-600">
                  <span>
                    {field.label}
                    {REQUIRED_FIELD_KEYS.has(field.key) ? (
                      <span className="ml-0.5 text-red-500">*</span>
                    ) : null}
                  </span>
                  <span className={filled ? 'font-normal text-emerald-600' : 'font-normal text-amber-600'}>
                    {filled ? 'подставлено' : 'можно заполнить'}
                  </span>
                </span>
                {field.multiline ? (
                  <textarea
                    className="block min-h-[4.5rem] w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
                    value={form[field.key] ?? ''}
                    onChange={(e) => setField(field.key, e.target.value)}
                    placeholder={filled ? '' : 'Не заполнено'}
                  />
                ) : (
                  <input
                    className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
                    value={form[field.key] ?? ''}
                    onChange={(e) => setField(field.key, e.target.value)}
                    placeholder={filled ? '' : 'Не заполнено'}
                  />
                )}
              </label>
            );
          })}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" size="sm" loading={clientSaving} onClick={handleConfirmEdit}>
            Подтвердить
          </Button>
        </div>
      </Modal>
      <style>{`
        @page { size: A4 portrait; margin: 10mm; }
      `}</style>
    </div>
  );
}
