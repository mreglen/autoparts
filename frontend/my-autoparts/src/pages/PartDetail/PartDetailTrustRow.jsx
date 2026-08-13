import React from 'react';

const TRUST_ITEMS = [
  'Доставка по России',
  'Безопасная сделка',
  'Осмотр перед покупкой',
  'Возврат по договорённости',
];

export default function PartDetailTrustRow() {
  return (
    <p className="text-sm text-ink-muted">
      {TRUST_ITEMS.join(' · ')}
    </p>
  );
}
