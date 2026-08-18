import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { apiRequest } from '../../utils/apiClient';
import { fetchOrganization } from '../../redux/slices/OrganizationSlice';
import { formatServerDate } from '../../utils/serverDate';
import {
  formatShopPartQty,
  shopLineSum,
  shopPartDisplayName,
  shopPartPricingOptions,
} from '../../utils/repairOrderShopPartUtils';
import { Button, EmptyState, Modal, Skeleton } from '../../components/UI';
import AutoserviceDocumentClientEditor from '../../components/Autoservice/AutoserviceDocumentClientEditor';
import AutoservicePrintPreview from '../../components/Autoservice/AutoservicePrintPreview';
import { downloadPrintSheetPdf } from '../../utils/downloadPrintPdf';
import {
  UPD_UNIT_META,
  formatRublesInWords,
  formatSurnameInitials,
  formatUpdMoney,
  innKpp,
  roundMoney,
  splitVatInclusive,
} from '../../utils/updDocument';
import {
  clientRequisitesChanged,
  clientToBuyerFields,
  emptyClientRequisites,
  isGuestClient,
  resolveClientForDocuments,
  saveAutoserviceClientRequisites,
} from '../../utils/autoserviceClientRequisites';

const EMPTY_FORM = {
  invoiceNumber: '',
  invoiceDate: '',
  sellerName: '',
  sellerAddress: '',
  sellerInn: '',
  sellerKpp: '',
  sellerPhone: '',
  bankName: '',
  bik: '',
  checkingAccount: '',
  corrAccount: '',
  buyerName: '',
  buyerAddress: '',
  buyerInn: '',
  buyerKpp: '',
  purpose: '',
  directorName: '',
  accountantName: '',
};

const REQUIRED_FIELDS = [
  ['invoiceNumber', 'Счёт №'],
  ['invoiceDate', 'Дата счёта'],
  ['sellerName', 'Поставщик'],
  ['sellerAddress', 'Адрес поставщика'],
  ['sellerInn', 'ИНН поставщика'],
  ['bankName', 'Банк получателя'],
  ['bik', 'БИК'],
  ['checkingAccount', 'Расчётный счёт'],
  ['buyerName', 'Покупатель'],
  ['buyerAddress', 'Адрес покупателя'],
  ['buyerInn', 'ИНН покупателя'],
];
const REQUIRED_FIELD_KEYS = new Set(REQUIRED_FIELDS.map(([key]) => key));

const MODAL_FIELDS = [
  { key: 'invoiceNumber', label: 'Счёт №' },
  { key: 'invoiceDate', label: 'Дата счёта' },
  { key: 'sellerName', label: 'Поставщик' },
  { key: 'sellerAddress', label: 'Адрес поставщика' },
  { key: 'sellerInn', label: 'ИНН поставщика' },
  { key: 'sellerKpp', label: 'КПП поставщика' },
  { key: 'sellerPhone', label: 'Телефон поставщика' },
  { key: 'bankName', label: 'Банк получателя' },
  { key: 'bik', label: 'БИК' },
  { key: 'checkingAccount', label: 'Расчётный счёт' },
  { key: 'corrAccount', label: 'Корр. счёт' },
  { key: 'purpose', label: 'Основание' },
  { key: 'directorName', label: 'Руководитель (фамилия и инициалы)' },
  { key: 'accountantName', label: 'Бухгалтер (фамилия и инициалы)' },
];

const BANK_KEYS = ['bankName', 'bik', 'checkingAccount', 'corrAccount'];

function bankStorageKey(orgId) {
  return `autoservice-invoice-bank:${orgId || 'org'}`;
}

function loadSavedBank(orgId) {
  try {
    const raw = localStorage.getItem(bankStorageKey(orgId));
    const data = raw ? JSON.parse(raw) : null;
    if (!data || typeof data !== 'object') return {};
    return BANK_KEYS.reduce((acc, key) => {
      acc[key] = String(data[key] || '');
      return acc;
    }, {});
  } catch {
    return {};
  }
}

function saveBank(orgId, form) {
  try {
    const payload = BANK_KEYS.reduce((acc, key) => {
      acc[key] = String(form[key] || '').trim();
      return acc;
    }, {});
    localStorage.setItem(bankStorageKey(orgId), JSON.stringify(payload));
  } catch {
    /* ignore quota / private mode */
  }
}

function lineSum(qty, unitPrice) {
  const q = Number(qty) || 0;
  const p = Number(unitPrice) || 0;
  return Math.round(q * p * 100) / 100;
}

function Cell({ children, className = '', align = 'left', ...props }) {
  const alignClass =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return (
    <td
      className={`border border-black px-1 py-0.5 align-middle ${alignClass} ${className}`}
      {...props}
    >
      {children ?? '\u00a0'}
    </td>
  );
}

function FieldEdit({ name, form, autoForm, onChange, className = '', ...rest }) {
  const value = form[name] ?? '';
  const auto = autoForm[name] ?? '';
  const isManual = String(value).trim() !== String(auto).trim();
  return (
    <input
      className={`upd-edit ${isManual ? 'is-manual' : ''} ${className}`}
      value={value}
      onChange={(e) => onChange(name, e.target.value)}
      {...rest}
    />
  );
}

function buildAutoForm(order, org, client) {
  const sellerName = org?.legal_name || org?.name || '';
  const sellerAddress = org?.legal_address || org?.address || '';
  const shortDate = formatServerDate(order.created_at || order.scheduled_at);
  const buyer = clientToBuyerFields(client || order?.client);
  return {
    ...EMPTY_FORM,
    invoiceNumber: String(order.order_number || ''),
    invoiceDate: shortDate === '—' ? '' : shortDate,
    sellerName,
    sellerAddress,
    sellerInn: String(org?.inn || '').trim(),
    sellerKpp: String(org?.kpp || '').trim(),
    sellerPhone: String(org?.phone || '').trim(),
    buyerName: buyer.buyerName,
    buyerAddress: buyer.buyerAddress,
    buyerInn: buyer.buyerInn,
    buyerKpp: buyer.buyerKpp,
    purpose: `Заказ-наряд № ${order.order_number} от ${shortDate}`,
    directorName: formatSurnameInitials(org?.director_name),
    accountantName: formatSurnameInitials(org?.accountant_name),
    ...loadSavedBank(org?.id),
  };
}

export default function RepairOrderInvoicePrintPage() {
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
        const orderData = await apiRequest(`/autoservice/repair-orders/${orderId}`);
        if (cancelled) return;
        const resolved = await resolveClientForDocuments(orderData?.client);
        if (cancelled) return;
        setOrder(orderData);
        setClient(resolved || orderData?.client || null);
        setClientForm(emptyClientRequisites(resolved || orderData?.client));
      } catch (e) {
        if (!cancelled) {
          setOrder(null);
          setError(e?.message || 'Не удалось загрузить счёт');
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

  const lines = useMemo(() => {
    if (!order) return [];
    const rows = [];
    (order.works || []).forEach((w) => {
      const withVat = roundMoney(w.line_sum ?? lineSum(w.qty, w.unit_price));
      const qty = Number(w.qty) || 0;
      rows.push({
        title: w.title || 'Работа',
        unit: UPD_UNIT_META.service.label,
        qty,
        qtyLabel: qty || '',
        unitPrice: qty ? roundMoney(withVat / qty) : withVat,
        withVat,
      });
    });
    (order.shop_parts || []).forEach((p) => {
      const withVat = roundMoney(
        p.line_sum ??
          shopLineSum(p.qty, p.unit_price, p.markup_percent, shopPartPricingOptions(p)),
      );
      const qty = Number(p.qty) || 0;
      const unitKey = p.unit && UPD_UNIT_META[p.unit] ? p.unit : 'pcs';
      rows.push({
        title: p.display_name || shopPartDisplayName(p),
        unit: UPD_UNIT_META[unitKey].label,
        qty,
        qtyLabel: formatShopPartQty(p.qty, p.unit || 'pcs'),
        unitPrice: qty ? roundMoney(withVat / qty) : withVat,
        withVat,
      });
    });
    return rows;
  }, [order]);

  const totals = useMemo(() => {
    const withVat = lines.reduce((sum, row) => roundMoney(sum + Number(row.withVat || 0)), 0);
    const split = splitVatInclusive(withVat);
    return { ...split, count: lines.length };
  }, [lines]);

  const missingRequired = REQUIRED_FIELDS.filter(
    ([key]) => !String(form[key] || '').trim() || String(form[key]).trim() === '--',
  );
  const canPrint = missingRequired.length === 0 && lines.length > 0;

  const applyClientToSheet = (clientLike) => {
    const buyer = clientToBuyerFields(clientLike);
    setForm((prev) => ({ ...prev, ...buyer }));
    setAutoForm((prev) => ({ ...prev, ...buyer }));
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
        saveBank(orgId, form);
      } catch (err) {
        setClientError(err?.message || 'Не удалось сохранить клиента');
        setClientSaving(false);
        return;
      }
      setClientSaving(false);
    } else {
      saveBank(orgId, form);
    }
    setEditOpen(false);
  };

  const setField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setPrintHint('');
  };

  const handlePrint = () => {
    if (!canPrint) {
      const reasons = missingRequired.map(([, label]) => label);
      if (lines.length === 0) reasons.push('Нет строк работ или материалов');
      setPrintHint(`Заполните: ${reasons.join(', ')}`);
      setEditOpen(true);
      return;
    }
    window.print();
    saveBank(orgId, form);
  };

  const handleDownloadPdf = async () => {
    if (!canPrint) {
      const reasons = missingRequired.map(([, label]) => label);
      if (lines.length === 0) reasons.push('Нет строк работ или материалов');
      setPrintHint(`Заполните: ${reasons.join(', ')}`);
      setEditOpen(true);
      return;
    }
    setPdfBusy(true);
    setPrintHint('');
    try {
      await downloadPrintSheetPdf({
        element: sheetRef.current,
        filename: `Счёт на оплату №${order.order_number}`,
        orientation: 'portrait',
      });
      saveBank(orgId, form);
    } catch (e) {
      setPrintHint(e?.message || 'Не удалось сохранить PDF');
    } finally {
      setPdfBusy(false);
    }
  };

  const editControl = (name, extraClass = '') => (
    <FieldEdit name={name} form={form} autoForm={autoForm} onChange={setField} className={extraClass} />
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-[210mm] space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <EmptyState
          illustration="error"
          title="Не удалось открыть счёт"
          description={error || 'Документ не найден'}
        />
        <div className="mt-4 flex justify-center">
          <Button as={Link} to="/autoservice/orders" variant="secondary">
            К заказ-нарядам
          </Button>
        </div>
      </div>
    );
  }

  const sellerInnKpp = innKpp(form.sellerInn, form.sellerKpp);
  const buyerInnKpp = innKpp(form.buyerInn, form.buyerKpp);

  return (
    <div className="repair-order-print-page min-h-screen bg-gray-100 text-black print:min-h-0 print:bg-white">
      <div className="repair-order-print-toolbar sticky top-0 z-10 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[210mm] flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-ink">Счёт на оплату №{order.order_number}</p>
          <div className="flex flex-wrap items-center gap-2">
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
        className="invoice-schet-sheet repair-order-print-sheet my-4 text-[11px] leading-tight text-black shadow-sm print:my-0 print:shadow-none"
      >
        <table className="invoice-bank w-full border-collapse text-[10px] leading-tight">
          <colgroup>
            <col style={{ width: '28%' }} />
            <col style={{ width: '28%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '34%' }} />
          </colgroup>
          <tbody>
            <tr>
              <td colSpan={2} rowSpan={2} className="border border-black px-1 py-0.5 align-top">
                <p>Банк получателя</p>
                <div className="mt-3 min-h-[1.6rem] font-medium">
                  {editControl('bankName')}
                </div>
              </td>
              <td className="border border-black px-1 py-0.5 align-top">БИК</td>
              <td className="border border-black px-1 py-0.5 align-top">
                {editControl('bik')}
              </td>
            </tr>
            <tr>
              <td className="border border-black px-1 py-0.5 align-top">Сч. №</td>
              <td className="border border-black px-1 py-0.5 align-top">
                {editControl('corrAccount')}
              </td>
            </tr>
            <tr>
              <td className="border border-black px-1 py-0.5 align-top">
                ИНН {editControl('sellerInn', 'upd-edit-inline min-w-[5.5rem]')}
              </td>
              <td className="border border-black px-1 py-0.5 align-top">
                КПП {editControl('sellerKpp', 'upd-edit-inline min-w-[4.5rem]')}
              </td>
              <td rowSpan={2} className="border border-black px-1 py-0.5 align-top">
                Сч. №
              </td>
              <td rowSpan={2} className="border border-black px-1 py-0.5 align-top">
                {editControl('checkingAccount')}
              </td>
            </tr>
            <tr>
              <td colSpan={2} className="border border-black px-1 py-0.5 align-top">
                <p>Получатель</p>
                <div className="mt-1 min-h-[1.4rem] font-medium">
                  {editControl('sellerName')}
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <h1 className="mt-5 text-center text-[18px] font-bold leading-tight">
          Счет № {editControl('invoiceNumber', 'upd-edit-inline min-w-[3.2rem] font-bold')} от{' '}
          {editControl('invoiceDate', 'upd-edit-inline min-w-[6.5rem] font-bold')} г.
        </h1>

        <p className="mt-4 flex items-end gap-1">
          <span className="shrink-0 font-bold">Поставщик:</span>
          <span className="min-w-0 flex-1 border-b border-black pb-px">
            {form.sellerName}
            {sellerInnKpp ? `, ИНН/КПП ${sellerInnKpp}` : ''}
            {form.sellerAddress ? `, ${form.sellerAddress}` : ''}
            {form.sellerPhone ? `, тел. ${form.sellerPhone}` : ''}
          </span>
        </p>
        <p className="mt-2 flex items-end gap-1">
          <span className="shrink-0 font-bold">Покупатель:</span>
          <span className="min-w-0 flex-1 border-b border-black pb-px">
            {form.buyerName}
            {buyerInnKpp ? `, ИНН/КПП ${buyerInnKpp}` : ''}
            {form.buyerAddress ? `, ${form.buyerAddress}` : ''}
          </span>
        </p>

        <table className="mt-4 w-full border-collapse text-[10px]">
          <thead>
            <tr>
              <th className="w-8 border border-black px-1 py-0.5 text-center font-normal">№</th>
              <th className="border border-black px-1 py-0.5 text-center font-normal">
                Наименование работ, услуг
              </th>
              <th className="w-[3.6rem] border border-black px-1 py-0.5 text-center font-normal">Кол-во</th>
              <th className="w-10 border border-black px-1 py-0.5 text-center font-normal">Ед.</th>
              <th className="w-[4.8rem] border border-black px-1 py-0.5 text-center font-normal">Цена</th>
              <th className="w-[5.2rem] border border-black px-1 py-0.5 text-center font-normal">Сумма</th>
            </tr>
          </thead>
          <tbody>
            {(lines.length ? lines : [{ title: '', qtyLabel: '', unit: '', unitPrice: '', withVat: '' }]).map(
              (row, index) => (
                <tr key={`${row.title || 'empty'}-${index}`}>
                  <Cell align="center">{index + 1}</Cell>
                  <Cell>{row.title}</Cell>
                  <Cell align="center">{row.qtyLabel}</Cell>
                  <Cell align="center">{row.unit}</Cell>
                  <Cell align="right">{row.withVat === '' ? '' : formatUpdMoney(row.unitPrice)}</Cell>
                  <Cell align="right">{row.withVat === '' ? '' : formatUpdMoney(row.withVat)}</Cell>
                </tr>
              ),
            )}
          </tbody>
        </table>

        <div className="mt-2 ml-auto w-[13.5rem] space-y-0.5 text-[11px]">
          <p className="flex justify-between gap-4">
            <span>Итого:</span>
            <span>{formatUpdMoney(totals.withVat)}</span>
          </p>
          <p className="flex justify-between gap-4">
            <span>В том числе НДС:</span>
            <span>{formatUpdMoney(totals.vat)}</span>
          </p>
          <p className="flex justify-between gap-4 font-bold">
            <span>Всего к оплате:</span>
            <span>{formatUpdMoney(totals.withVat)}</span>
          </p>
        </div>

        <p className="mt-4">
          Всего наименований {totals.count}, на сумму {formatUpdMoney(totals.withVat)} руб.
        </p>
        <p className="mt-1 border-b border-black pb-0.5 font-bold">
          {formatRublesInWords(totals.withVat)}
        </p>

        <div className="mt-8 grid grid-cols-2 gap-x-10 text-[11px]">
          <p className="flex items-end gap-2">
            <span className="shrink-0 font-bold">Руководитель</span>
            <span className="inline-block min-w-[4.5rem] flex-1 border-b border-black">&nbsp;</span>
            <span className="min-w-[7rem] flex-1">{editControl('directorName')}</span>
          </p>
          <p className="flex items-end gap-2">
            <span className="shrink-0 font-bold">Бухгалтер</span>
            <span className="inline-block min-w-[4.5rem] flex-1 border-b border-black">&nbsp;</span>
            <span className="min-w-[7rem] flex-1">{editControl('accountantName')}</span>
          </p>
        </div>
      </article>
      </AutoservicePrintPreview>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Реквизиты счёта"
        size="lg"
        wrapperClassName="z-[140]"
      >
        <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          <AutoserviceDocumentClientEditor
            client={client}
            form={clientForm}
            onChange={handleClientFormChange}
            disabled={clientSaving}
            idPrefix="invoice-client"
          />
          {clientError ? <p className="text-sm text-red-600">{clientError}</p> : null}
          {MODAL_FIELDS.map((field) => (
            <label key={field.key} className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-gray-600">
                {field.label}
                {REQUIRED_FIELD_KEYS.has(field.key) ? <span className="ml-0.5 text-red-500">*</span> : null}
              </span>
              <input
                className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
                value={form[field.key] ?? ''}
                onChange={(e) => setField(field.key, e.target.value)}
                placeholder={String(form[field.key] || '').trim() ? '' : 'Не заполнено'}
              />
            </label>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            size="sm"
            loading={clientSaving}
            onClick={handleConfirmEdit}
          >
            Подтвердить
          </Button>
        </div>
      </Modal>
      <style>{`
        @page { size: A4 portrait; margin: 10mm; }
        .invoice-bank td { height: 22px; }
        .invoice-bank tr:first-child td:first-child { height: 44px; }
      `}</style>
    </div>
  );
}
