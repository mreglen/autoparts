import {
  formatStockOutDate,
  formatStockOutMoney,
  getStockOutChannelMeta,
  getStockOutOperationMeta,
  isStockOutSale,
} from '../../utils/stockOutUi';

function situationFromPart(part) {
  const qty = Number(part?.quantity || 0);
  const reserved = Number(part?.reserved_qty || 0);
  const movements = Array.isArray(part?.stock_outs) ? part.stock_outs : [];
  const last = movements[0];

  if (qty <= 0 && last) {
    const sold = isStockOutSale(last);
    return {
      tone: sold ? 'sold' : 'writeoff',
      title: sold ? 'Продана' : 'Списана',
      hint: sold
        ? 'Остаток 0 — последняя операция продажа.'
        : 'Остаток 0 — последняя операция списание.',
    };
  }
  if (qty <= 0) {
    return {
      tone: 'empty',
      title: 'Нет в наличии',
      hint: 'Остаток 0. История операций ниже, если она есть.',
    };
  }
  if (reserved > 0) {
    return {
      tone: 'reserved',
      title: 'В резерве',
      hint: `Зарезервировано ${reserved} шт. Доступно к продаже: ${Math.max(0, qty - reserved)} шт.`,
    };
  }
  if (movements.length) {
    return {
      tone: 'history',
      title: 'История операций',
      hint: null,
    };
  }
  return null;
}

const TONE_CLASS = {
  sold: 'border-emerald-200 bg-emerald-50',
  writeoff: 'border-rose-200 bg-rose-50',
  empty: 'border-amber-200 bg-amber-50',
  reserved: 'border-sky-200 bg-sky-50',
  history: 'border-gray-200 bg-white',
};

const TITLE_CLASS = {
  sold: 'text-emerald-900',
  writeoff: 'text-rose-900',
  empty: 'text-amber-900',
  reserved: 'text-sky-900',
  history: 'text-gray-900',
};

export default function SellerPartCardSituation({ part }) {
  const movements = Array.isArray(part?.stock_outs) ? part.stock_outs : [];
  const situation = situationFromPart(part);
  if (!situation) return null;

  return (
    <section className={`rounded-2xl border p-4 ${TONE_CLASS[situation.tone]}`}>
      <h2 className={`text-sm font-semibold ${TITLE_CLASS[situation.tone]}`}>
        {situation.title}
      </h2>
      {situation.hint ? (
        <p className="mt-1 text-sm text-gray-700">{situation.hint}</p>
      ) : null}

      {movements.length ? (
        <ul className="mt-3 space-y-2">
          {movements.map((item) => {
            const operation = getStockOutOperationMeta(item);
            const channel = getStockOutChannelMeta(item);
            const sold = isStockOutSale(item);
            return (
              <li
                key={item.id}
                className="rounded-xl border border-white/80 bg-white/80 px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${operation.className}`}>
                    {operation.label}
                  </span>
                  {channel ? (
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${channel.className}`}>
                      {channel.label}
                    </span>
                  ) : null}
                  <span className="text-xs text-gray-500">
                    {formatStockOutDate(item.movement_date)}
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-gray-900">
                  {item.quantity} шт.
                  {sold && item.sale_price != null ? (
                    <span className="text-gray-600">
                      {' · '}
                      {formatStockOutMoney(item.sale_price)}
                    </span>
                  ) : null}
                </p>
                {item.reason ? (
                  <p className="mt-0.5 text-sm text-gray-700">
                    <span className="text-gray-500">Причина: </span>
                    {item.reason}
                  </p>
                ) : null}
                {item.avito_order_id ? (
                  <p className="mt-0.5 text-xs text-gray-500">
                    Заказ Avito: {item.avito_order_id}
                  </p>
                ) : null}
                {item.user_name ? (
                  <p className="mt-0.5 text-xs text-gray-500">{item.user_name}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
