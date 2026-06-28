import React from 'react';

const TRUST_ITEMS = [
  { label: 'Доставка по России', icon: '🚚' },
  { label: 'Безопасная сделка', icon: '🛡️' },
  { label: 'Осмотр перед покупкой', icon: '🔍' },
  { label: 'Возврат по договорённости', icon: '↩️' },
];

export default function PartDetailTrustRow() {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {TRUST_ITEMS.map((item) => (
        <span
          key={item.label}
          className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700"
        >
          <span aria-hidden="true">{item.icon}</span>
          {item.label}
        </span>
      ))}
    </div>
  );
}
