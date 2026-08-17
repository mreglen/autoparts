import { useEffect, useMemo, useState } from 'react';
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
import { Button, EmptyState, Skeleton } from '../../components/UI';
import {
  UPD_UNIT_META,
  UPD_VAT_RATE,
  formatUpdLongDate,
  formatUpdMoney,
  formatUpdQuotedDate,
  innKpp,
  splitVatInclusive,
} from '../../utils/updDocument';

function dash(value) {
  const text = value == null ? '' : String(value).trim();
  return text || '—';
}

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

export default function RepairOrderUpdPrintPage() {
  const { orderId } = useParams();
  const [searchParams] = useSearchParams();
  const buyerId = searchParams.get('buyerId');
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const org = useSelector((state) => state.organization.data);
  const orgId = user?.organization_id;

  const [order, setOrder] = useState(null);
  const [buyer, setBuyer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
        const requests = [apiRequest(`/autoservice/repair-orders/${orderId}`)];
        if (buyerId) {
          requests.push(apiRequest(`/autoservice/document-buyers/${buyerId}`));
        } else {
          requests.push(Promise.resolve(null));
        }
        const [orderData, buyerData] = await Promise.all(requests);
        if (cancelled) return;
        setOrder(orderData);
        setBuyer(buyerData);
        if (!buyerData) {
          setError('Выберите покупателя для УПД');
        }
      } catch (e) {
        if (!cancelled) {
          setOrder(null);
          setBuyer(null);
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

  const lines = useMemo(() => {
    if (!order) return [];
    const rows = [];
    (order.works || []).forEach((w) => {
      const withVat = w.line_sum ?? lineSum(w.qty, w.unit_price);
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
      const withVat =
        p.line_sum ??
        shopLineSum(p.qty, p.unit_price, p.markup_percent, shopPartPricingOptions(p));
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
          without: Math.round((acc.without + row.without) * 100) / 100,
          vat: Math.round((acc.vat + row.vat) * 100) / 100,
          withVat: Math.round((acc.withVat + row.withVat) * 100) / 100,
        }),
        { without: 0, vat: 0, withVat: 0 },
      ),
    [lines],
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-[297mm] space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error || !order || !buyer) {
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

  const sellerName = org?.legal_name || org?.name || 'Автосервис';
  const sellerAddress = org?.legal_address || org?.address || '';
  const sellerInnKpp = innKpp(org?.inn, org?.kpp);
  const docDate = parseServerDate(order.created_at || order.scheduled_at) || new Date();
  const shortDate = formatServerDate(order.created_at || order.scheduled_at);
  const grounds = `Заказ-наряд № ${order.order_number} от ${shortDate}`;
  const shipmentTitle = `Универсальный передаточный документ, № ${order.order_number} от ${shortDate}`;

  return (
    <div className="upd-print-page min-h-screen bg-gray-100 text-black print:min-h-0 print:bg-white">
      <div className="upd-print-toolbar sticky top-0 z-10 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[297mm] flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-ink">УПД №{order.order_number}</p>
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

      <article className="upd-print-sheet my-4 shadow-sm print:my-0 print:shadow-none">
        <p className="mb-1 text-right text-[9px] leading-tight text-black">
          Приложение № 1 к постановлению Правительства Российской Федерации от 26 декабря 2011 г. № 1137
          <br />
          (в редакции постановления Правительства Российской Федерации от 23 января 2026 г. № 26)
        </p>

        <div className="grid grid-cols-[1fr_auto] items-start gap-3">
          <h1 className="text-[15px] font-bold leading-tight">
            Универсальный передаточный
            <br />
            документ
          </h1>
          <div className="text-right text-[10px]">
            <p>
              <span className="font-semibold">Статус:</span> 1
            </p>
            <p className="mt-0.5 max-w-[14rem] text-[8px] leading-tight text-black">
              1 – счет-фактура и передаточный документ (акт)
              <br />
              2 – передаточный документ (акт)
            </p>
          </div>
        </div>

        <p className="mt-1 text-[11px]">
          Счет-фактура № <span className="font-semibold">{order.order_number}</span> от{' '}
          <span className="font-semibold">{formatUpdLongDate(docDate)}</span>
          <span className="ml-4">Исправление № —</span>
        </p>

        <table className="mt-2 w-full border-collapse text-[10px] leading-tight">
          <tbody>
            <tr>
              <Td className="w-[12%] font-semibold">Продавец:</Td>
              <Td className="w-[38%]">{sellerName}</Td>
              <Td className="w-[12%] font-semibold">Покупатель:</Td>
              <Td>{buyer.name}</Td>
            </tr>
            <tr>
              <Td className="font-semibold">Адрес:</Td>
              <Td>{dash(sellerAddress)}</Td>
              <Td className="font-semibold">Адрес:</Td>
              <Td>{dash(buyer.address)}</Td>
            </tr>
            <tr>
              <Td className="font-semibold">ИНН/КПП продавца:</Td>
              <Td>{dash(sellerInnKpp)}</Td>
              <Td className="font-semibold">ИНН/КПП покупателя:</Td>
              <Td>{dash(innKpp(buyer.inn, buyer.kpp))}</Td>
            </tr>
            <tr>
              <Td className="font-semibold">Грузоотправитель и его адрес:</Td>
              <Td>—</Td>
              <Td className="font-semibold">Грузополучатель и его адрес:</Td>
              <Td>—</Td>
            </tr>
            <tr>
              <Td className="font-semibold">К платежно-расчетному документу №</Td>
              <Td>от</Td>
              <Td className="font-semibold">Валюта: наименование, код</Td>
              <Td>Российский рубль, 643</Td>
            </tr>
            <tr>
              <Td className="font-semibold">Документ об отгрузке</Td>
              <Td colSpan={3}>{shipmentTitle}</Td>
            </tr>
          </tbody>
        </table>

        <table className="mt-2 w-full border-collapse text-[8px] leading-tight">
          <thead>
            <tr>
              <Th rowSpan={2}>№</Th>
              <Th rowSpan={2}>Код товара / работ, услуг</Th>
              <Th rowSpan={2}>Наименование товара (описание выполненных работ, оказанных услуг)</Th>
              <Th colSpan={2}>Единица измерения</Th>
              <Th rowSpan={2}>Количество (объем)</Th>
              <Th rowSpan={2}>Цена (тариф) за единицу измерения</Th>
              <Th rowSpan={2}>Стоимость без налога</Th>
              <Th rowSpan={2}>В том числе сумма акциза</Th>
              <Th rowSpan={2}>Налоговая ставка</Th>
              <Th rowSpan={2}>Сумма налога</Th>
              <Th rowSpan={2}>Стоимость с налогом</Th>
            </tr>
            <tr>
              <Th>код</Th>
              <Th>условное обозначение</Th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <Td align="center">1</Td>
                <Td />
                <Td />
                <Td />
                <Td />
                <Td />
                <Td />
                <Td />
                <Td align="center">без акциза</Td>
                <Td align="center">{UPD_VAT_RATE}%</Td>
                <Td />
                <Td />
              </tr>
            ) : (
              lines.map((row, index) => (
                <tr key={`${row.title}-${index}`}>
                  <Td align="center">{index + 1}</Td>
                  <Td align="center">{row.code}</Td>
                  <Td>{row.title}</Td>
                  <Td align="center">{row.unit.code}</Td>
                  <Td align="center">{row.unit.label}</Td>
                  <Td align="center">{row.qtyLabel ?? row.qty}</Td>
                  <Td align="right">{formatUpdMoney(row.unitPrice)}</Td>
                  <Td align="right">{formatUpdMoney(row.without)}</Td>
                  <Td align="center">без акциза</Td>
                  <Td align="center">{UPD_VAT_RATE}%</Td>
                  <Td align="right">{formatUpdMoney(row.vat)}</Td>
                  <Td align="right">{formatUpdMoney(row.withVat)}</Td>
                </tr>
              ))
            )}
            <tr>
              <td colSpan={7} className="border border-black px-1 py-0.5 text-right font-semibold">
                Всего к оплате (9)
              </td>
              <Td align="right" className="font-bold">
                {formatUpdMoney(totals.without)}
              </Td>
              <Td align="center">X</Td>
              <Td align="center">X</Td>
              <Td align="right" className="font-bold">
                {formatUpdMoney(totals.vat)}
              </Td>
              <Td align="right" className="font-bold">
                {formatUpdMoney(totals.withVat)}
              </Td>
            </tr>
          </tbody>
        </table>

        <p className="mt-1 text-[10px]">Документ составлен на 1 листе</p>

        <div className="mt-2 grid grid-cols-2 gap-6 text-[10px] leading-tight">
          <div className="space-y-1">
            <p className="font-semibold">Руководитель организации или иное уполномоченное лицо</p>
            <p>
              <span className="inline-block min-w-[6rem] border-b border-black">&nbsp;</span>
              {' / '}
              <span className="inline-block min-w-[8rem] border-b border-black text-center">
                {org?.director_name || '\u00a0'}
              </span>
            </p>
            <p className="text-[8px]">
              <span className="inline-block min-w-[6rem] text-center">(подпись)</span>
              <span className="inline-block min-w-[8rem] text-center">(ф.и.о.)</span>
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold">Главный бухгалтер или иное уполномоченное лицо</p>
            <p>
              <span className="inline-block min-w-[6rem] border-b border-black">&nbsp;</span>
              {' / '}
              <span className="inline-block min-w-[8rem] border-b border-black text-center">
                {org?.accountant_name || '\u00a0'}
              </span>
            </p>
            <p className="text-[8px]">
              <span className="inline-block min-w-[6rem] text-center">(подпись)</span>
              <span className="inline-block min-w-[8rem] text-center">(ф.и.о.)</span>
            </p>
          </div>
        </div>

        <table className="mt-3 w-full border-collapse text-[10px] leading-tight">
          <tbody>
            <tr>
              <Td className="w-[28%] font-semibold">Основание передачи (сдачи) / получения (приемки)</Td>
              <Td colSpan={3}>{grounds}</Td>
            </tr>
            <tr>
              <Td className="font-semibold">Данные о транспортировке и грузе</Td>
              <Td colSpan={3}>—</Td>
            </tr>
            <tr>
              <Td className="font-semibold">Товар (груз) передал / услуги, результаты работ, права сдал</Td>
              <Td>
                <span className="inline-block min-w-[5rem] border-b border-black">&nbsp;</span>
                {' / '}
                {org?.director_name || ''}
              </Td>
              <Td className="font-semibold">Товар (груз) получил / услуги, результаты работ, права принял</Td>
              <Td>
                <span className="inline-block min-w-[5rem] border-b border-black">&nbsp;</span>
                {' / '}
                {buyer.name}
              </Td>
            </tr>
            <tr>
              <Td className="font-semibold">Дата отгрузки, передачи (сдачи)</Td>
              <Td>{formatUpdQuotedDate(docDate)}</Td>
              <Td className="font-semibold">Дата получения (приемки)</Td>
              <Td>{formatUpdQuotedDate(docDate)}</Td>
            </tr>
            <tr>
              <Td className="font-semibold">Наименование экономического субъекта – составителя документа</Td>
              <Td>
                {sellerName}
                {sellerInnKpp ? `, ИНН/КПП ${sellerInnKpp}` : ''}
              </Td>
              <Td className="font-semibold">Наименование экономического субъекта – составителя документа</Td>
              <Td>
                {buyer.name}
                {innKpp(buyer.inn, buyer.kpp) ? `, ИНН ${innKpp(buyer.inn, buyer.kpp)}` : ''}
              </Td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2 text-[10px]">М.П.</p>
      </article>
      <style>{`
        @page { size: A4 landscape; margin: 8mm; }
      `}</style>
    </div>
  );
}
