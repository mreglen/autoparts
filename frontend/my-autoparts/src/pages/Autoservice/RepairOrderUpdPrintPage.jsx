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
  return text || '--';
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

function Line({ children, className = '' }) {
  return (
    <span className={`inline-block min-h-[1.1em] min-w-[4rem] border-b border-black px-0.5 ${className}`}>
      {children || '\u00a0'}
    </span>
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

function SignPair({ name }) {
  return (
    <div>
      <p className="flex items-end gap-1">
        <Line className="min-w-[5.2rem]" />
        <span>/</span>
        <Line className="min-w-[7.5rem] text-center">{name}</Line>
      </p>
      <p className="flex gap-1">
        <span className="upd-hint inline-block min-w-[5.2rem] text-center">(подпись)</span>
        <span className="w-1" />
        <span className="upd-hint inline-block min-w-[7.5rem] text-center">(ф.и.о.)</span>
      </p>
    </div>
  );
}

function TripleSign({ position, name }) {
  return (
    <div>
      <p className="mt-0.5 flex items-end gap-1">
        <Line className="min-w-[4.2rem] text-center">{position}</Line>
        <span>/</span>
        <Line className="min-w-[4.2rem]" />
        <span>/</span>
        <Line className="min-w-[6.5rem] text-center">{name}</Line>
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
  position,
  name,
  dateText,
  entity,
  markStart,
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        <div className="min-w-0 flex-1">
          <p>{handedLabel}</p>
          <TripleSign position={position} name={name} />
        </div>
        <span className="upd-fn">[{markStart}]</span>
      </div>
      <div className="flex items-end gap-1">
        <p className="min-w-0 flex-1">
          {dateLabel}
          {' '}
          <Line className="min-w-[9rem]">{dateText}</Line>
        </p>
        <span className="upd-fn">[{markStart + 1}]</span>
      </div>
      <div className="flex gap-1">
        <p className="min-w-0 flex-1">
          {otherLabel}
          <span className="upd-uv mt-0.5"> </span>
          <span className="upd-hint mt-0.5 block">{otherHint}</span>
        </p>
        <span className="upd-fn">[{markStart + 2}]</span>
      </div>
      <div className="flex gap-1">
        <div className="min-w-0 flex-1">
          <p>{responsibleLabel}</p>
          <TripleSign position={position} name={name} />
        </div>
        <span className="upd-fn">[{markStart + 3}]</span>
      </div>
      <div className="flex gap-1">
        <p className="min-w-0 flex-1">
          {entityLabel}
          <span className="upd-uv mt-0.5">{entity}</span>
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
  const sellerIsIp = /ип|индивидуальн/i.test(sellerName);
  const directorName = org?.director_name || '';
  const accountantName = org?.accountant_name || '';
  const ogrnText = String(org?.ogrn || '').trim();
  const docDate = parseServerDate(order.created_at || order.scheduled_at) || new Date();
  const shortDate = formatServerDate(order.created_at || order.scheduled_at);
  const grounds = `Заказ-наряд № ${order.order_number} от ${shortDate}`;
  const shipmentTitle = `Универсальный передаточный документ, № ${order.order_number} от ${shortDate}`;
  const buyerInnKpp = innKpp(buyer.inn, buyer.kpp);

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

      <article className="upd-print-sheet my-4 text-black shadow-sm print:my-0 print:shadow-none">
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
                    Счет-фактура № <Line className="min-w-[2.6rem] font-semibold">{order.order_number}</Line>
                    {' '}от <Line className="min-w-[7.5rem] font-semibold">{formatUpdLongDate(docDate)}</Line>
                  </p>
                  <span className="upd-fn">(1)</span>
                </div>
                <div className="mt-1 flex items-end gap-2">
                  <p className="min-w-0 flex-1">
                    Исправление № <Line className="min-w-[2.6rem]">--</Line>
                    {' '}от <Line className="min-w-[7.5rem]">--</Line>
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
                leftValue={sellerName}
                leftNum="(2)"
                rightLabel="Покупатель:"
                rightValue={buyer.name}
                rightNum="(6)"
              />
              <FieldRow
                leftLabel="Адрес:"
                leftValue={dash(sellerAddress)}
                leftNum="(2а)"
                rightLabel="Адрес:"
                rightValue={dash(buyer.address)}
                rightNum="(6а)"
              />
              <FieldRow
                leftLabel="ИНН/КПП продавца:"
                leftValue={dash(sellerInnKpp)}
                leftNum="(2б)"
                rightLabel="ИНН/КПП покупателя:"
                rightValue={dash(buyerInnKpp)}
                rightNum="(6б)"
              />
              <FieldRow
                leftLabel="Грузоотправитель и его адрес:"
                leftValue="--"
                leftNum="(3)"
                rightLabel="Валюта: наименование, код"
                rightValue="Российский рубль, 643"
                rightNum="(7)"
              />
              <FieldRow
                leftLabel="Грузополучатель и его адрес:"
                leftValue="--"
                leftNum="(4)"
                rightLabel="Идентификатор государственного контракта, договора (соглашения) (при наличии):"
                rightValue="--"
                rightNum="(8)"
              />
              <FieldWide label="К платежно-расчетному документу №" num="(5)">
                <Line className="min-w-[4rem]" /> от <Line className="min-w-[4rem]" />
              </FieldWide>
              <FieldWide label="Документ об отгрузке" num="(5а)">
                {shipmentTitle}
              </FieldWide>
              <div className="mt-1">
                <p className="leading-tight">
                  К счету-фактуре (счетам-фактурам), выставленному (выставленным) при получении оплаты, частичной оплаты или иных платежей в счет предстоящих поставок товаров (выполнения работ, оказания услуг), передачи имущественных прав
                </p>
                <div className="mt-0.5 flex items-end gap-1">
                  <p className="min-w-0 flex-1">
                    № <Line className="min-w-[3rem]" /> от <Line className="min-w-[3rem]" />, исправление № <Line className="min-w-[3rem]" /> от <Line className="min-w-[3rem]" />
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
              <SignPair name={sellerIsIp ? '' : directorName} />
              <p className="mt-2">Индивидуальный предприниматель или иное уполномоченное лицо</p>
              <SignPair name={sellerIsIp ? directorName : ''} />
              <p className="upd-hint mt-0.5">
                {ogrnText
                  ? `ОГРНИП ${ogrnText}`
                  : '(основной государственный регистрационный номер индивидуального предпринимателя и дата присвоения такого номера)'}
              </p>
            </div>
            <div>
              <p>Главный бухгалтер или иное уполномоченное лицо</p>
              <SignPair name={sellerIsIp ? '' : accountantName} />
            </div>
          </div>
        </div>
        </div>

        <div className="upd-foot">
          <div className="upd-foot-top">
            <div className="flex gap-1">
              <div className="min-w-0 flex-1">
                <p>Основание передачи (сдачи) / получения (приемки)</p>
                <span className="upd-uv">{grounds}</span>
                <span className="upd-hint mt-0.5 block">(договор; доверенность и др.)</span>
              </div>
              <span className="upd-fn">[8]</span>
            </div>
            <div className="mt-1.5 flex gap-1">
              <div className="min-w-0 flex-1">
                <p>Данные о транспортировке и грузе</p>
                <span className="upd-uv">--</span>
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
            position={sellerIsIp ? 'ИП' : ''}
            name={directorName}
            dateText={formatUpdQuotedDate(docDate)}
            entity={`${sellerName}${sellerInnKpp ? `, ИНН/КПП ${sellerInnKpp}` : ''}`}
            markStart={10}
          />
          <TransferSide
            handedLabel="Товар (груз) получил / услуги, результаты работ, права принял"
            dateLabel="Дата получения (приемки)"
            otherLabel="Иные сведения о получении, приемке"
            otherHint="(информация о наличии/отсутствии претензии; ссылки на неотъемлемые приложения, и другие документы и т.п.)"
            responsibleLabel="Ответственный за правильность оформления факта хозяйственной жизни"
            entityLabel="Наименование экономического субъекта – составителя документа"
            position=""
            name=""
            dateText={formatUpdQuotedDate(docDate)}
            entity={`${buyer.name}${buyerInnKpp ? `, ИНН ${buyerInnKpp}` : ''}`}
            markStart={15}
          />
          </div>
        </div>
      </article>
      <style>{`
        @page { size: A4 landscape; margin: 6mm; }
      `}</style>
    </div>
  );
}
