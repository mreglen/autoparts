import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { apiRequest } from '../../utils/apiClient';
import { fetchOrganization } from '../../redux/slices/OrganizationSlice';
import { parseServerDate, formatServerDate } from '../../utils/serverDate';
import {
  formatShopPartQty,
  shopLineSum,
  shopPartDisplayName,
  shopPartPricingOptions,
} from '../../utils/repairOrderShopPartUtils';
import { Button, EmptyState, Modal, Skeleton } from '../../components/UI';
import AutoserviceDocumentClientEditor from '../../components/Autoservice/AutoserviceDocumentClientEditor';
import AutoservicePrintPreview from '../../components/Autoservice/AutoservicePrintPreview';
import { downloadPrintSheetPdf, printDocumentSheet } from '../../utils/downloadPrintPdf';
import {
  UPD_UNIT_META,
  UPD_VAT_RATE,
  formatUpdLongDate,
  formatUpdMoney,
  formatUpdQuotedDate,
  innKpp,
  roundMoney,
  splitVatInclusive,
} from '../../utils/updDocument';
import {
  clientRequisitesChanged,
  clientToBuyerFields,
  emptyClientRequisites,
  isGuestClient,
  mergeLegacyBuyerIntoClient,
  resolveClientForDocuments,
  saveAutoserviceClientRequisites,
} from '../../utils/autoserviceClientRequisites';

const EMPTY_FORM = {
  invoiceNumber: '',
  invoiceDate: '',
  correctionNumber: '--',
  correctionDate: '--',
  sellerName: '',
  sellerAddress: '',
  sellerInnKpp: '',
  buyerName: '',
  buyerAddress: '',
  buyerInnKpp: '',
  consignor: '--',
  consignee: '--',
  currency: 'Российский рубль, 643',
  govContract: '--',
  paymentNumber: '',
  paymentDate: '',
  shipmentDoc: '',
  advanceInvoice: '',
  grounds: '',
  transport: '--',
  directorName: '',
  accountantName: '',
  ipName: '',
  ogrn: '',
  handedPosition: '',
  handedName: '',
  shipDate: '',
  handedOther: '',
  handedEntity: '',
  receivedPosition: '',
  receivedName: '',
  receiveDate: '',
  receivedOther: '',
  receivedEntity: '',
};

const REQUIRED_FIELDS = [
  ['invoiceNumber', 'Счет-фактура № (1)'],
  ['invoiceDate', 'Дата счета-фактуры (1)'],
  ['sellerName', 'Продавец (2)'],
  ['sellerAddress', 'Адрес продавца (2а)'],
  ['sellerInnKpp', 'ИНН/КПП продавца (2б)'],
  ['buyerName', 'Покупатель (6)'],
  ['buyerAddress', 'Адрес покупателя (6а)'],
  ['buyerInnKpp', 'ИНН/КПП покупателя (6б)'],
];
const REQUIRED_FIELD_KEYS = new Set(REQUIRED_FIELDS.map(([key]) => key));

const MODAL_FIELDS = [
  { num: '(1)', key: 'invoiceNumber', label: 'Счет-фактура №' },
  { num: '(1)', key: 'invoiceDate', label: 'Дата счета-фактуры' },
  { num: '(1а)', key: 'correctionNumber', label: 'Исправление №' },
  { num: '(1а)', key: 'correctionDate', label: 'Дата исправления' },
  { num: '(2)', key: 'sellerName', label: 'Продавец' },
  { num: '(2а)', key: 'sellerAddress', label: 'Адрес продавца' },
  { num: '(2б)', key: 'sellerInnKpp', label: 'ИНН/КПП продавца' },
  { num: '(3)', key: 'consignor', label: 'Грузоотправитель и его адрес' },
  { num: '(4)', key: 'consignee', label: 'Грузополучатель и его адрес' },
  { num: '(7)', key: 'currency', label: 'Валюта: наименование, код' },
  { num: '(8)', key: 'govContract', label: 'Идентификатор госконтракта' },
  { num: '(5)', key: 'paymentNumber', label: 'К платежно-расчетному документу №' },
  { num: '(5)', key: 'paymentDate', label: 'Дата платежно-расчетного документа' },
  { num: '(5а)', key: 'shipmentDoc', label: 'Документ об отгрузке' },
  { num: '(5б)', key: 'advanceInvoice', label: 'К счету-фактуре (аванс)' },
  { num: '[8]', key: 'grounds', label: 'Основание передачи' },
  { num: '[9]', key: 'transport', label: 'Данные о транспортировке и грузе' },
  { num: '', key: 'directorName', label: 'Руководитель (ф.и.о.)' },
  { num: '', key: 'accountantName', label: 'Главный бухгалтер (ф.и.о.)' },
  { num: '', key: 'ipName', label: 'Индивидуальный предприниматель (ф.и.о.)' },
  { num: '', key: 'ogrn', label: 'ОГРН / ОГРНИП' },
  { num: '[10]', key: 'handedPosition', label: 'Сдал, должность' },
  { num: '[10]', key: 'handedName', label: 'Сдал, ф.и.о.' },
  { num: '[11]', key: 'shipDate', label: 'Дата отгрузки, передачи (сдачи)' },
  { num: '[12]', key: 'handedOther', label: 'Иные сведения об отгрузке' },
  { num: '[14]', key: 'handedEntity', label: 'Составитель документа (продавец)' },
  { num: '[15]', key: 'receivedPosition', label: 'Принял, должность' },
  { num: '[15]', key: 'receivedName', label: 'Принял, ф.и.о.' },
  { num: '[16]', key: 'receiveDate', label: 'Дата получения (приемки)' },
  { num: '[17]', key: 'receivedOther', label: 'Иные сведения о получении' },
  { num: '[19]', key: 'receivedEntity', label: 'Составитель документа (покупатель)' },
];

function lineSum(qty, unitPrice) {
  const q = Number(qty) || 0;
  const p = Number(unitPrice) || 0;
  return Math.round(q * p * 100) / 100;
}

function Td({ children, className = '', align = 'left', ...props }) {
  const alignClass =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return (
    <td
      className={`border border-black px-0.5 py-0.5 align-middle ${alignClass} ${className}`}
      {...props}
    >
      {children ?? '\u00a0'}
    </td>
  );
}

function Th({ children, className = '', rowSpan, colSpan }) {
  return (
    <th
      rowSpan={rowSpan}
      colSpan={colSpan}
      className={`border border-black px-0.5 py-0.5 text-center font-semibold align-middle ${className}`}
    >
      {children}
    </th>
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

function FieldRow({ leftLabel, leftValue, leftNum, rightLabel, rightValue, rightNum }) {
  return (
    <div className="upd-fr">
      <span className="upd-fl">{leftLabel}</span>
      <span className="upd-uv">{leftValue || '\u00a0'}</span>
      <span className="upd-fn">{leftNum}</span>
      <span className="upd-fl">{rightLabel}</span>
      <span className="upd-uv">{rightValue || '\u00a0'}</span>
      <span className="upd-fn">{rightNum}</span>
    </div>
  );
}

function FieldWide({ label, children, num }) {
  return (
    <div className="upd-fw">
      <span className="upd-fl">{label}</span>
      <span className="upd-uv">{children || '\u00a0'}</span>
      <span className="upd-fn">{num}</span>
    </div>
  );
}

function SignPair({ nameNode }) {
  return (
    <div>
      <p className="flex items-end gap-1">
        <span className="inline-block min-w-[5.2rem] border-b border-black">&nbsp;</span>
        <span>/</span>
        <span className="min-w-[7.5rem] flex-1">{nameNode}</span>
      </p>
      <p className="flex gap-1">
        <span className="upd-hint inline-block min-w-[5.2rem] text-center">(подпись)</span>
        <span className="w-1" />
        <span className="upd-hint inline-block min-w-[7.5rem] text-center">(ф.и.о.)</span>
      </p>
    </div>
  );
}

function TripleSign({ positionNode, nameNode }) {
  return (
    <div>
      <p className="mt-0.5 flex items-end gap-1">
        <span className="min-w-[4.2rem] flex-1">{positionNode}</span>
        <span>/</span>
        <span className="inline-block min-w-[4.2rem] border-b border-black">&nbsp;</span>
        <span>/</span>
        <span className="min-w-[6.5rem] flex-1">{nameNode}</span>
      </p>
      <p className="flex gap-1">
        <span className="upd-hint inline-block min-w-[4.2rem] text-center">(должность)</span>
        <span className="upd-hint inline-block min-w-[4.2rem] text-center">(подпись)</span>
        <span className="upd-hint inline-block min-w-[6.5rem] text-center">(ф.и.о.)</span>
      </p>
    </div>
  );
}

function TransferSide({
  handedLabel,
  dateLabel,
  otherLabel,
  otherHint,
  responsibleLabel,
  entityLabel,
  positionNode,
  nameNode,
  dateNode,
  otherNode,
  entityNode,
  markStart,
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        <div className="min-w-0 flex-1">
          <p>{handedLabel}</p>
          <TripleSign positionNode={positionNode} nameNode={nameNode} />
        </div>
        <span className="upd-fn">[{markStart}]</span>
      </div>
      <div className="flex items-end gap-1">
        <p className="min-w-0 flex-1">
          {dateLabel}
          {' '}
          <span className="inline-block min-w-[9rem] align-bottom">{dateNode}</span>
        </p>
        <span className="upd-fn">[{markStart + 1}]</span>
      </div>
      <div className="flex gap-1">
        <p className="min-w-0 flex-1">
          {otherLabel}
          <span className="upd-uv mt-0.5">{otherNode}</span>
          <span className="upd-hint mt-0.5 block">{otherHint}</span>
        </p>
        <span className="upd-fn">[{markStart + 2}]</span>
      </div>
      <div className="flex gap-1">
        <div className="min-w-0 flex-1">
          <p>{responsibleLabel}</p>
          <TripleSign positionNode={positionNode} nameNode={nameNode} />
        </div>
        <span className="upd-fn">[{markStart + 3}]</span>
      </div>
      <div className="flex gap-1">
        <p className="min-w-0 flex-1">
          {entityLabel}
          <span className="upd-uv mt-0.5">{entityNode}</span>
          <span className="upd-hint mt-0.5 block">
            (может не заполняться при проставлении печати в М.П., может быть указан ИНН / КПП)
          </span>
        </p>
        <span className="upd-fn">[{markStart + 4}]</span>
      </div>
      <p>М.П.</p>
    </div>
  );
}

function buyerSheetFields(clientLike) {
  const buyer = clientToBuyerFields(clientLike);
  const buyerInnKppValue = innKpp(buyer.buyerInn, buyer.buyerKpp);
  return {
    buyerName: buyer.buyerName,
    buyerAddress: buyer.buyerAddress,
    buyerInnKpp: buyerInnKppValue,
    receivedEntity: `${buyer.buyerName}${buyerInnKppValue ? `, ИНН ${buyerInnKppValue}` : ''}`,
  };
}

function buildAutoForm(order, org, client) {
  const sellerName = org?.legal_name || org?.name || '';
  const sellerAddress = org?.legal_address || org?.address || '';
  const sellerInnKpp = innKpp(org?.inn, org?.kpp);
  const sellerIsIp = /ип|индивидуальн/i.test(sellerName);
  const directorName = org?.director_name || '';
  const accountantName = org?.accountant_name || '';
  const ogrnText = String(org?.ogrn || '').trim();
  const docDate = parseServerDate(order.created_at || order.scheduled_at) || new Date();
  const shortDate = formatServerDate(order.created_at || order.scheduled_at);
  const buyerFields = buyerSheetFields(client || order?.client);
  return {
    ...EMPTY_FORM,
    invoiceNumber: String(order.order_number || ''),
    invoiceDate: formatUpdLongDate(docDate),
    sellerName,
    sellerAddress,
    sellerInnKpp,
    ...buyerFields,
    shipmentDoc: `Универсальный передаточный документ, № ${order.order_number} от ${shortDate}`,
    grounds: `Заказ-наряд № ${order.order_number} от ${shortDate}`,
    directorName: sellerIsIp ? '' : directorName,
    accountantName: sellerIsIp ? '' : accountantName,
    ipName: sellerIsIp ? directorName : '',
    ogrn: ogrnText,
    handedPosition: sellerIsIp ? 'ИП' : '',
    handedName: directorName,
    shipDate: formatUpdQuotedDate(docDate),
    handedEntity: `${sellerName}${sellerInnKpp ? `, ИНН/КПП ${sellerInnKpp}` : ''}`,
    receiveDate: formatUpdQuotedDate(docDate),
  };
}

export default function RepairOrderUpdPrintPage() {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const buyerId = searchParams.get('buyerId');
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
    document.documentElement.classList.add('upd-print-root');
    return () => {
      document.documentElement.classList.remove('upd-print-root');
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!orderId) return;
      setLoading(true);
      setError('');
      try {
        const [orderData, pickedBuyer] = await Promise.all([
          apiRequest(`/autoservice/repair-orders/${orderId}`),
          buyerId ? apiRequest(`/autoservice/document-buyers/${buyerId}`).catch(() => null) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        let nextClient = orderData?.client || null;
        if (pickedBuyer) nextClient = mergeLegacyBuyerIntoClient(nextClient, pickedBuyer);
        const resolved = await resolveClientForDocuments(nextClient);
        if (cancelled) return;
        setOrder(orderData);
        setClient(resolved || nextClient);
        setClientForm(emptyClientRequisites(resolved || nextClient));
      } catch (e) {
        if (!cancelled) {
          setOrder(null);
          setError(e?.message || 'Не удалось загрузить УПД');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, buyerId]);

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
      const split = splitVatInclusive(withVat);
      const qty = Number(w.qty) || 0;
      const unitPrice = qty ? Math.round((split.without / qty) * 100) / 100 : split.without;
      rows.push({
        code: w.catalog_work_id || w.id || '',
        title: w.title || 'Работа',
        unit: UPD_UNIT_META.service,
        qty,
        unitPrice,
        ...split,
      });
    });
    (order.shop_parts || []).forEach((p) => {
      const withVat = roundMoney(
        p.line_sum ??
          shopLineSum(p.qty, p.unit_price, p.markup_percent, shopPartPricingOptions(p)),
      );
      const split = splitVatInclusive(withVat);
      const qty = Number(p.qty) || 0;
      const unitKey = p.unit && UPD_UNIT_META[p.unit] ? p.unit : 'pcs';
      rows.push({
        code: p.partnumber || p.rossko_partnumber || p.id || '',
        title: p.display_name || shopPartDisplayName(p),
        unit: UPD_UNIT_META[unitKey],
        qty,
        qtyLabel: formatShopPartQty(p.qty, p.unit || 'pcs'),
        unitPrice: qty ? Math.round((split.without / qty) * 100) / 100 : split.without,
        ...split,
      });
    });
    return rows;
  }, [order]);

  const totals = useMemo(
    () =>
      lines.reduce(
        (acc, row) => ({
          without: roundMoney(acc.without + Number(row.without || 0)),
          vat: roundMoney(acc.vat + Number(row.vat || 0)),
          withVat: roundMoney(acc.withVat + Number(row.withVat || 0)),
        }),
        { without: 0, vat: 0, withVat: 0 },
      ),
    [lines],
  );

  const missingRequired = REQUIRED_FIELDS.filter(([key]) => !String(form[key] || '').trim() || String(form[key]).trim() === '--');
  const canPrint = missingRequired.length === 0 && lines.length > 0;

  const applyClientToSheet = (clientLike) => {
    const buyerFields = buyerSheetFields(clientLike);
    setForm((prev) => ({ ...prev, ...buyerFields }));
    setAutoForm((prev) => ({ ...prev, ...buyerFields }));
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
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'sellerName' || name === 'sellerInnKpp') {
        const sellerName = name === 'sellerName' ? value : next.sellerName;
        const sellerInnKpp = name === 'sellerInnKpp' ? value : next.sellerInnKpp;
        if (String(prev.handedEntity).trim() === String(autoForm.handedEntity).trim()) {
          next.handedEntity = `${sellerName}${sellerInnKpp ? `, ИНН/КПП ${sellerInnKpp}` : ''}`;
        }
      }
      if (name === 'buyerName' || name === 'buyerInnKpp') {
        const buyerName = name === 'buyerName' ? value : next.buyerName;
        const buyerInnKpp = name === 'buyerInnKpp' ? value : next.buyerInnKpp;
        if (String(prev.receivedEntity).trim() === String(autoForm.receivedEntity).trim()) {
          next.receivedEntity = `${buyerName}${buyerInnKpp ? `, ИНН ${buyerInnKpp}` : ''}`;
        }
      }
      return next;
    });
    setPrintHint('');
  };

  const handlePrint = async () => {
    if (!canPrint) {
      const reasons = missingRequired.map(([, label]) => label);
      if (lines.length === 0) reasons.push('Нет строк работ или материалов');
      setPrintHint(`Заполните: ${reasons.join(', ')}`);
      setEditOpen(true);
      return;
    }
    setPrintHint('');
    try {
      await printDocumentSheet(sheetRef.current, { orientation: 'landscape' });
    } catch (e) {
      setPrintHint(e?.message || 'Не удалось открыть печать');
    }
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
        filename: `УПД №${order.order_number}`,
        orientation: 'landscape',
      });
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
      <div className="mx-auto max-w-[297mm] space-y-4 p-6">
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
          title="Не удалось открыть УПД"
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

  return (
    <div className="upd-print-page min-h-screen bg-gray-100 text-black print:min-h-0 print:bg-white">
      <div className="upd-print-toolbar sticky top-0 z-10 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[297mm] flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-ink">УПД №{order.order_number}</p>
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
          <p className="mx-auto mt-2 max-w-[297mm] text-xs text-red-600">
            {printHint || 'Печать недоступна: заполните обязательные поля или нажмите «Редактировать».'}
          </p>
        ) : null}
      </div>

      <AutoservicePrintPreview>
      <article
        ref={sheetRef}
        data-print-sheet="true"
        className="upd-print-sheet my-4 text-black shadow-sm print:my-0 print:shadow-none"
      >
        <div className="upd-l-body">
        <div className="upd-shell">
          <aside className="upd-rail">
            <h1 className="upd-title">
              Универсальный передаточный
              <br />
              документ
            </h1>
            <div className="upd-status-wrap">
              <div className="upd-status-row">
                <span>Статус:</span>
                <span className="upd-status-box">1</span>
              </div>
              <p className="mt-2">
                1 – счет-фактура и передаточный документ (акт)
                <br />
                2 – передаточный документ (акт)
              </p>
            </div>
          </aside>
          <div className="upd-main">
            <div className="upd-head-main">
              <div className="upd-invoice">
                <div className="flex items-end gap-2">
                  <p className="min-w-0 flex-1">
                    Счет-фактура № {editControl('invoiceNumber', 'upd-edit-inline min-w-[2.6rem] font-semibold')}
                    {' '}от {editControl('invoiceDate', 'upd-edit-inline min-w-[7.5rem] font-semibold')}
                  </p>
                  <span className="upd-fn">(1)</span>
                </div>
                <div className="mt-1 flex items-end gap-2">
                  <p className="min-w-0 flex-1">
                    Исправление № {editControl('correctionNumber', 'upd-edit-inline min-w-[2.6rem]')}
                    {' '}от {editControl('correctionDate', 'upd-edit-inline min-w-[7.5rem]')}
                  </p>
                  <span className="upd-fn">(1а)</span>
                </div>
              </div>
              <p className="upd-cite">
                Приложение № 1 к постановлению Правительства Российской Федерации от 26 декабря 2011 г. № 1137
                <br />
                (в редакции постановления Правительства Российской Федерации от 23 января 2026 г. № 26)
              </p>
            </div>
            <div className="mt-1">
              <FieldRow
                leftLabel="Продавец:"
                leftValue={editControl('sellerName')}
                leftNum="(2)"
                rightLabel="Покупатель:"
                rightValue={editControl('buyerName')}
                rightNum="(6)"
              />
              <FieldRow
                leftLabel="Адрес:"
                leftValue={editControl('sellerAddress')}
                leftNum="(2а)"
                rightLabel="Адрес:"
                rightValue={editControl('buyerAddress')}
                rightNum="(6а)"
              />
              <FieldRow
                leftLabel="ИНН/КПП продавца:"
                leftValue={editControl('sellerInnKpp')}
                leftNum="(2б)"
                rightLabel="ИНН/КПП покупателя:"
                rightValue={editControl('buyerInnKpp')}
                rightNum="(6б)"
              />
              <FieldRow
                leftLabel="Грузоотправитель и его адрес:"
                leftValue={editControl('consignor')}
                leftNum="(3)"
                rightLabel="Валюта: наименование, код"
                rightValue={editControl('currency')}
                rightNum="(7)"
              />
              <FieldRow
                leftLabel="Грузополучатель и его адрес:"
                leftValue={editControl('consignee')}
                leftNum="(4)"
                rightLabel="Идентификатор государственного контракта, договора (соглашения) (при наличии):"
                rightValue={editControl('govContract')}
                rightNum="(8)"
              />
              <FieldWide label="К платежно-расчетному документу №" num="(5)">
                {editControl('paymentNumber', 'upd-edit-inline min-w-[4rem]')} от {editControl('paymentDate', 'upd-edit-inline min-w-[4rem]')}
              </FieldWide>
              <FieldWide label="Документ об отгрузке" num="(5а)">
                {editControl('shipmentDoc')}
              </FieldWide>
              <div className="mt-1">
                <p className="leading-tight">
                  К счету-фактуре (счетам-фактурам), выставленному (выставленным) при получении оплаты, частичной оплаты или иных платежей в счет предстоящих поставок товаров (выполнения работ, оказания услуг), передачи имущественных прав
                </p>
                <div className="mt-0.5 flex items-end gap-1">
                  <p className="min-w-0 flex-1">
                    {editControl('advanceInvoice')}
                  </p>
                  <span className="upd-fn">(5б)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <table className="w-full border-collapse">
          <colgroup>
            <col className="upd-col-a" />
          </colgroup>
          <thead>
            <tr>
              <Th rowSpan={2} className="upd-col-a">Код товара/ работ, услуг</Th>
              <Th rowSpan={2} className="w-[2.6%]">№ п/п</Th>
              <Th rowSpan={2}>Наименование товара (описание выполненных работ, оказанных услуг), имущественного права</Th>
              <Th rowSpan={2} className="w-[4.5%]">Код вида товара</Th>
              <Th colSpan={2}>Единица измерения</Th>
              <Th rowSpan={2} className="w-[4.5%]">Количество (объем)</Th>
              <Th rowSpan={2} className="w-[6.5%]">Цена (тариф) за единицу измерения</Th>
              <Th rowSpan={2} className="w-[8%]">Стоимость товаров (работ, услуг), имущественных прав без налога - всего</Th>
              <Th rowSpan={2} className="w-[5%]">В том числе сумма акциза</Th>
              <Th rowSpan={2} className="w-[4.5%]">Налоговая ставка</Th>
              <Th rowSpan={2} className="w-[6.5%]">Сумма налога, предъявляемая покупателю</Th>
              <Th rowSpan={2} className="w-[8%]">Стоимость товаров (работ, услуг), имущественных прав с налогом - всего</Th>
              <Th colSpan={2}>Страна происхождения товара</Th>
              <Th rowSpan={2} className="w-[7%]">Регистрационный номер декларации на товары или регистрационный номер партии товара, подлежащего прослеживаемости</Th>
            </tr>
            <tr>
              <Th className="w-[3%]">код</Th>
              <Th className="w-[4%]">условное обозначение (национальное)</Th>
              <Th className="w-[3%]">цифровой код</Th>
              <Th className="w-[4%]">краткое наименование</Th>
            </tr>
            <tr>
              <Th>А</Th>
              <Th>1</Th>
              <Th>1а</Th>
              <Th>1б</Th>
              <Th>2</Th>
              <Th>2а</Th>
              <Th>3</Th>
              <Th>4</Th>
              <Th>5</Th>
              <Th>6</Th>
              <Th>7</Th>
              <Th>8</Th>
              <Th>9</Th>
              <Th>10</Th>
              <Th>10а</Th>
              <Th>11</Th>
            </tr>
          </thead>
          <tbody>
            {(lines.length ? lines : [{ empty: true }]).map((row, index) => (
              <tr key={row.empty ? 'empty' : `${row.title}-${index}`}>
                <Td align="center">{row.empty ? '' : row.code}</Td>
                <Td align="center">{index + 1}</Td>
                <Td>{row.empty ? '' : row.title}</Td>
                <Td align="center">--</Td>
                <Td align="center">{row.empty ? '--' : row.unit.code}</Td>
                <Td align="center">{row.empty ? '--' : row.unit.label}</Td>
                <Td align="center">{row.empty ? '--' : (row.qtyLabel ?? row.qty)}</Td>
                <Td align="right">{row.empty ? '--' : formatUpdMoney(row.unitPrice)}</Td>
                <Td align="right">{row.empty ? '--' : formatUpdMoney(row.without)}</Td>
                <Td align="center">без акциза</Td>
                <Td align="center">{UPD_VAT_RATE}%</Td>
                <Td align="right">{row.empty ? '--' : formatUpdMoney(row.vat)}</Td>
                <Td align="right">{row.empty ? '--' : formatUpdMoney(row.withVat)}</Td>
                <Td align="center">--</Td>
                <Td align="center">--</Td>
                <Td align="center">--</Td>
              </tr>
            ))}
            <tr>
              <td className="border border-black px-1 py-0.5" />
              <td colSpan={7} className="border border-black px-1 py-0.5 text-right font-semibold">
                Всего к оплате (9)
              </td>
              <Td align="right" className="font-bold">{formatUpdMoney(totals.without)}</Td>
              <Td align="center">Х</Td>
              <Td align="center">Х</Td>
              <Td align="right" className="font-bold">{formatUpdMoney(totals.vat)}</Td>
              <Td align="right" className="font-bold">{formatUpdMoney(totals.withVat)}</Td>
              <Td align="center">Х</Td>
              <Td align="center">Х</Td>
              <Td align="center">Х</Td>
            </tr>
          </tbody>
        </table>

        <div className="upd-shell">
          <aside className="upd-rail">
            <p className="upd-sheets">
              Документ составлен на
              <br />
              1 листе
            </p>
          </aside>
          <div className="upd-main grid grid-cols-2 items-start gap-x-4 pt-1">
            <div>
              <p>Руководитель организации или иное уполномоченное лицо</p>
              <SignPair nameNode={editControl('directorName')} />
              <p className="mt-2">Индивидуальный предприниматель или иное уполномоченное лицо</p>
              <SignPair nameNode={editControl('ipName')} />
              <p className="upd-hint mt-0.5">
                {form.ogrn
                  ? <>ОГРНИП {editControl('ogrn')}</>
                  : '(основной государственный регистрационный номер индивидуального предпринимателя и дата присвоения такого номера)'}
              </p>
            </div>
            <div>
              <p>Главный бухгалтер или иное уполномоченное лицо</p>
              <SignPair nameNode={editControl('accountantName')} />
            </div>
          </div>
        </div>
        </div>

        <div className="upd-foot">
          <div className="upd-foot-top">
            <div className="flex gap-1">
              <div className="min-w-0 flex-1">
                <p>Основание передачи (сдачи) / получения (приемки)</p>
                <span className="upd-uv">{editControl('grounds')}</span>
                <span className="upd-hint mt-0.5 block">(договор; доверенность и др.)</span>
              </div>
              <span className="upd-fn">[8]</span>
            </div>
            <div className="mt-1.5 flex gap-1">
              <div className="min-w-0 flex-1">
                <p>Данные о транспортировке и грузе</p>
                <span className="upd-uv">{editControl('transport')}</span>
                <span className="upd-hint mt-0.5 block">
                  (транспортная накладная, поручение экспедитору, экспедиторская / складская расписка и др. / масса нетто/ брутто груза, если не приведены ссылки на транспортные документы, содержащие эти сведения)
                </span>
              </div>
              <span className="upd-fn">[9]</span>
            </div>
          </div>

          <div className="upd-transfer">
          <TransferSide
            handedLabel="Товар (груз) передал / услуги, результаты работ, права сдал"
            dateLabel="Дата отгрузки, передачи (сдачи)"
            otherLabel="Иные сведения об отгрузке, передаче"
            otherHint="(ссылки на неотъемлемые приложения, сопутствующие документы, иные документы и т.п.)"
            responsibleLabel="Ответственный за правильность оформления факта хозяйственной жизни"
            entityLabel="Наименование экономического субъекта – составителя документа (в т.ч. комиссионера / агента)"
            positionNode={editControl('handedPosition')}
            nameNode={editControl('handedName')}
            dateNode={editControl('shipDate', 'upd-edit-inline')}
            otherNode={editControl('handedOther')}
            entityNode={editControl('handedEntity')}
            markStart={10}
          />
          <TransferSide
            handedLabel="Товар (груз) получил / услуги, результаты работ, права принял"
            dateLabel="Дата получения (приемки)"
            otherLabel="Иные сведения о получении, приемке"
            otherHint="(информация о наличии/отсутствии претензии; ссылки на неотъемлемые приложения, и другие документы и т.п.)"
            responsibleLabel="Ответственный за правильность оформления факта хозяйственной жизни"
            entityLabel="Наименование экономического субъекта – составителя документа"
            positionNode={editControl('receivedPosition')}
            nameNode={editControl('receivedName')}
            dateNode={editControl('receiveDate', 'upd-edit-inline')}
            otherNode={editControl('receivedOther')}
            entityNode={editControl('receivedEntity')}
            markStart={15}
          />
          </div>
        </div>
      </article>
      </AutoservicePrintPreview>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Реквизиты УПД"
        size="lg"
        wrapperClassName="z-[140]"
      >
        <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          <AutoserviceDocumentClientEditor
            client={client}
            form={clientForm}
            onChange={handleClientFormChange}
            disabled={clientSaving}
            idPrefix="upd-client"
          />
          {clientError ? <p className="text-sm text-red-600">{clientError}</p> : null}
          {MODAL_FIELDS.map((field) => (
            <label key={`${field.num}-${field.key}`} className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-gray-600">
                {field.num ? <span className="mr-1 text-gray-400">{field.num}</span> : null}
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
          <Button type="button" variant="secondary" size="sm" loading={clientSaving} onClick={handleConfirmEdit}>
            Готово
          </Button>
        </div>
      </Modal>
      <style>{`
        @page { size: A4 landscape; margin: 6mm; }
      `}</style>
    </div>
  );
}
