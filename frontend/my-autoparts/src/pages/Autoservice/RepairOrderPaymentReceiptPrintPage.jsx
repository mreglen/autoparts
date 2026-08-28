import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { apiRequest } from '../../utils/apiClient';
import { fetchOrganization } from '../../redux/slices/OrganizationSlice';
import { formatServerDate } from '../../utils/serverDate';
import { Button, EmptyState, Skeleton } from '../../components/UI';
import AutoservicePrintPreview from '../../components/Autoservice/AutoservicePrintPreview';
import { downloadPrintSheetPdf, printDocumentSheet } from '../../utils/downloadPrintPdf';
import {
  formatRublesInWords,
  formatSurnameInitials,
  formatUpdMoney,
  innKpp,
  roundMoney,
  splitVatInclusive,
} from '../../utils/updDocument';
import {
  clientToBuyerFields,
  resolveClientForDocuments,
} from '../../utils/autoserviceClientRequisites';
import {
  AUTOSERVICE_PAYMENT_METHOD_LABELS,
  parsePaymentReceiptQuery,
  resolvePaymentReceiptTitle,
} from '../../utils/autoservicePaymentReceipt';
import { repairOrderNumberLabel } from '../../utils/autoserviceOrderDisplay';

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

export default function RepairOrderPaymentReceiptPrintPage() {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const org = useSelector((state) => state.organization.data);
  const orgId = user?.organization_id;
  const sheetRef = useRef(null);

  const selectedPaymentIds = useMemo(
    () => parsePaymentReceiptQuery(searchParams.toString()),
    [searchParams],
  );

  const [order, setOrder] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
        const [orderData, paymentsData] = await Promise.all([
          apiRequest(`/autoservice/repair-orders/${orderId}`),
          apiRequest(`/autoservice/repair-orders/${orderId}/payments`),
        ]);
        if (cancelled) return;
        await resolveClientForDocuments(orderData?.client);
        if (cancelled) return;
        setOrder(orderData);
        setPayments(paymentsData?.items || []);
      } catch (e) {
        if (!cancelled) {
          setOrder(null);
          setPayments([]);
          setError(e?.message || 'Не удалось загрузить чек');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const selectedPayments = useMemo(() => {
    if (!selectedPaymentIds.length) return payments;
    const idSet = new Set(selectedPaymentIds);
    return payments.filter((row) => idSet.has(row.id));
  }, [payments, selectedPaymentIds]);

  const lines = useMemo(() => {
    if (!order) return [];
    const orderLabel = repairOrderNumberLabel(order);
    return selectedPayments.map((payment) => {
      const amount = roundMoney(payment.amount);
      return {
        id: payment.id,
        title: `Оплата по заказ-наряду № ${orderLabel}`,
        dateLabel: formatServerDate(payment.created_at),
        methodLabel: AUTOSERVICE_PAYMENT_METHOD_LABELS[payment.method] || payment.method,
        amount,
        method: payment.method,
        receiptNumber: payment.sequential_number,
      };
    });
  }, [order, selectedPayments]);

  const totals = useMemo(() => {
    const withVat = lines.reduce((sum, row) => roundMoney(sum + Number(row.amount || 0)), 0);
    const split = splitVatInclusive(withVat);
    return { ...split, count: lines.length };
  }, [lines]);

  const sellerName = org?.legal_name || org?.name || '';
  const sellerAddress = org?.legal_address || org?.address || '';
  const sellerInnKpp = innKpp(org?.inn, org?.kpp);
  const buyer = clientToBuyerFields(order?.client);
  const buyerInnKpp = innKpp(buyer.buyerInn, buyer.buyerKpp);
  const receiptTitle = resolvePaymentReceiptTitle(lines.map((row) => row.method));
  const receiptDate = lines.length
    ? lines[lines.length - 1].dateLabel
    : formatServerDate(order?.updated_at || order?.created_at);
  const receiptNumbers = lines.map((row) => row.receiptNumber).filter(Boolean);
  const receiptNumberLabel = receiptNumbers.length
    ? receiptNumbers.join(', ')
    : repairOrderNumberLabel(order);
  const showBankBlock = lines.some((row) => row.method === 'bank');
  const canPrint = Boolean(order && lines.length > 0 && sellerName && buyer.buyerName);

  const handlePrint = () => {
    if (!canPrint) return;
    printDocumentSheet(sheetRef.current);
  };

  const handleDownloadPdf = async () => {
    if (!canPrint || !sheetRef.current) return;
    setPdfBusy(true);
    try {
      await downloadPrintSheetPdf(sheetRef.current, {
        filename: `${receiptTitle} ${order?.order_number || orderId}.pdf`,
      });
    } finally {
      setPdfBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-6">
        <Skeleton className="mx-auto h-[297mm] max-w-[210mm] rounded-lg" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 p-6">
        <EmptyState title={error || 'Заказ-наряд не найден'}>
          <Button as={Link} to="/autoservice/orders" variant="secondary" size="sm">
            К списку заказов
          </Button>
        </EmptyState>
      </div>
    );
  }

  if (!lines.length) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 p-6">
        <EmptyState title="Не выбраны операции оплаты для печати чека">
          <Button as={Link} to="/autoservice/orders" variant="secondary" size="sm">
            К списку заказов
          </Button>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="repair-order-print-page min-h-screen bg-gray-100 text-black print:min-h-0 print:bg-white">
      <div className="repair-order-print-toolbar sticky top-0 z-10 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[210mm] flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-ink">
            {receiptTitle} · заказ-наряд {repairOrderNumberLabel(order)}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button as={Link} to="/autoservice/orders" variant="secondary" size="sm">
              Закрыть
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
        {!canPrint ? (
          <p className="mx-auto mt-2 max-w-[210mm] text-xs text-red-600">
            Печать недоступна: заполните реквизиты организации и клиента.
          </p>
        ) : null}
      </div>

      <AutoservicePrintPreview>
        <article
          ref={sheetRef}
          data-print-sheet="true"
          className="invoice-schet-sheet repair-order-print-sheet my-4 text-[11px] leading-tight text-black shadow-sm print:my-0 print:shadow-none"
        >
          {showBankBlock ? (
            <table className="invoice-bank w-full border-collapse text-[10px] leading-tight">
              <colgroup>
                <col style={{ width: '28%' }} />
                <col style={{ width: '28%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '34%' }} />
              </colgroup>
              <tbody>
                <tr>
                  <td colSpan={4} className="border border-black px-1 py-0.5 align-top">
                    <p className="font-medium">Получатель</p>
                    <p className="mt-1">{sellerName}</p>
                    {sellerInnKpp ? <p>ИНН/КПП {sellerInnKpp}</p> : null}
                    {sellerAddress ? <p>{sellerAddress}</p> : null}
                  </td>
                </tr>
              </tbody>
            </table>
          ) : null}

          <h1 className={`text-center text-[18px] font-bold leading-tight ${showBankBlock ? 'mt-5' : 'mt-2'}`}>
            {receiptTitle} № {receiptNumberLabel} от {receiptDate === '—' ? '' : receiptDate} г.
          </h1>

          <p className="mt-4 flex items-end gap-1">
            <span className="shrink-0 font-bold">Поставщик:</span>
            <span className="min-w-0 flex-1 border-b border-black pb-px">
              {sellerName}
              {sellerInnKpp ? `, ИНН/КПП ${sellerInnKpp}` : ''}
              {sellerAddress ? `, ${sellerAddress}` : ''}
            </span>
          </p>
          <p className="mt-2 flex items-end gap-1">
            <span className="shrink-0 font-bold">Покупатель:</span>
            <span className="min-w-0 flex-1 border-b border-black pb-px">
              {buyer.buyerName}
              {buyerInnKpp ? `, ИНН/КПП ${buyerInnKpp}` : ''}
              {buyer.buyerAddress ? `, ${buyer.buyerAddress}` : ''}
            </span>
          </p>

          <table className="mt-4 w-full border-collapse text-[10px]">
            <thead>
              <tr>
                <th className="w-8 border border-black px-1 py-0.5 text-center font-normal">№</th>
                <th className="border border-black px-1 py-0.5 text-center font-normal">Наименование</th>
                <th className="w-[5.5rem] border border-black px-1 py-0.5 text-center font-normal">Дата</th>
                <th className="w-[6.5rem] border border-black px-1 py-0.5 text-center font-normal">Способ</th>
                <th className="w-[5.2rem] border border-black px-1 py-0.5 text-center font-normal">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((row, index) => (
                <tr key={row.id}>
                  <Cell align="center">{index + 1}</Cell>
                  <Cell>{row.title}</Cell>
                  <Cell align="center">{row.dateLabel === '—' ? '' : row.dateLabel}</Cell>
                  <Cell align="center">{row.methodLabel}</Cell>
                  <Cell align="right">{formatUpdMoney(row.amount)}</Cell>
                </tr>
              ))}
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
              <span>Всего оплачено:</span>
              <span>{formatUpdMoney(totals.withVat)}</span>
            </p>
          </div>

          <p className="mt-4">
            Всего операций {totals.count}, на сумму {formatUpdMoney(totals.withVat)} руб.
          </p>
          <p className="mt-1 border-b border-black pb-0.5 font-bold">
            {formatRublesInWords(totals.withVat)}
          </p>

          <div className="mt-8 grid grid-cols-2 gap-x-10 text-[11px]">
            <p className="flex items-end gap-2">
              <span className="shrink-0 font-bold">Руководитель</span>
              <span className="inline-block min-w-[4.5rem] flex-1 border-b border-black">&nbsp;</span>
              <span className="min-w-[7rem] flex-1">{formatSurnameInitials(org?.director_name)}</span>
            </p>
            <p className="flex items-end gap-2">
              <span className="shrink-0 font-bold">Бухгалтер</span>
              <span className="inline-block min-w-[4.5rem] flex-1 border-b border-black">&nbsp;</span>
              <span className="min-w-[7rem] flex-1">{formatSurnameInitials(org?.accountant_name)}</span>
            </p>
          </div>
        </article>
      </AutoservicePrintPreview>

      <style>{`
        @page { size: A4 portrait; margin: 10mm; }
        .invoice-bank td { height: 22px; }
      `}</style>
    </div>
  );
}
