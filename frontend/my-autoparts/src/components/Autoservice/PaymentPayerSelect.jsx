import React from 'react';

export default function PaymentPayerSelect({
  row,
  payers,
  saving = false,
  onSave,
  className = '',
}) {
  const payerId = row?.payer_id == null ? '' : String(row.payer_id);
  const currentName = String(row?.payer_name || '').trim();
  const hasCurrentOption = payerId
    ? (payers || []).some((payer) => String(payer.id) === payerId)
    : false;

  return (
    <select
      value={hasCurrentOption ? payerId : ''}
      disabled={saving}
      onChange={(event) => {
        const value = event.target.value;
        onSave(row.id, value ? Number(value) : null);
      }}
      onClick={(event) => event.stopPropagation()}
      className={`h-9 min-w-[11rem] max-w-full rounded-full border border-transparent bg-gray-100 px-3 text-sm text-gray-900 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-0 disabled:cursor-wait disabled:opacity-60 ${className}`}
      aria-label={`Плательщик платежа № ${row?.sequential_number}`}
    >
      <option value="">
        {payerId && !hasCurrentOption
          ? currentName || 'Удалённый плательщик'
          : !currentName || currentName === row?.client_name
            ? `Клиент: ${row?.client_name || '—'}`
            : currentName}
      </option>
      {(payers || []).map((payer) => (
        <option key={payer.id} value={String(payer.id)}>
          {payer.name}
        </option>
      ))}
    </select>
  );
}
