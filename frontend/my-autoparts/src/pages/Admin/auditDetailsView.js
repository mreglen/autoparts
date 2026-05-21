const FIELD_LABELS = {
  product_id: 'ID товара',
  stock_in_id: 'ID поступления',
  stock_out_id: 'ID расхода',
  order_id: 'ID заказа',
  organization_id: 'ID организации',
  employee_id: 'ID сотрудника',
  employee_email: 'Email сотрудника',
  pending_product_id: 'ID черновика',
  quantity: 'Количество',
  exported_count: 'Экспортировано',
  product_ids: 'ID товаров',
  previous_status: 'Предыдущий статус',
  new_status: 'Новый статус',
  fulfilled_count: 'Проведено позиций',
  processed_count: 'Обработано',
  created_count: 'Создано',
  synced: 'Синхронизировано',
  updated: 'Обновлено',
  enabled: 'Включено',
  is_enabled: 'Включено',
  updated_fields: 'Изменённые поля',
  public_code: 'Публичный ID',
  is_buyer: 'Покупатель',
  is_seller: 'Продавец',
  phone: 'Телефон',
  name: 'Название',
  address: 'Адрес',
  storage_location_id: 'ID склада',
  printer_id: 'ID принтера',
  label_width_mm: 'Ширина этикетки (мм)',
  label_height_mm: 'Высота этикетки (мм)',
  internal_code: 'Внутренний код',
  items: 'Позиции',
};

function labelForKey(key) {
  return FIELD_LABELS[key] || key.replace(/_/g, ' ');
}

function formatPrimitive(value) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function AuditDetailsStructured({ data, depth = 0 }) {
  if (data === null || data === undefined) {
    return <p className="text-gray-500">—</p>;
  }
  if (typeof data !== 'object') {
    return <p className="text-gray-800 break-words">{formatPrimitive(data)}</p>;
  }
  if (Array.isArray(data)) {
    if (data.length === 0) return <p className="text-gray-500">Пустой список</p>;
    return (
      <ul className={`space-y-2 ${depth > 0 ? 'ml-2 border-l border-gray-200 pl-3' : ''}`}>
        {data.map((item, idx) => (
          <li key={idx} className="rounded-lg bg-gray-50 p-3">
            <span className="text-xs font-medium text-gray-500">#{idx + 1}</span>
            <div className="mt-1">
              <AuditDetailsStructured data={item} depth={depth + 1} />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  const entries = Object.entries(data);
  if (entries.length === 0) return <p className="text-gray-500">—</p>;

  const simple = entries.every(([, v]) => v === null || typeof v !== 'object');
  if (simple && depth === 0) {
    return (
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {entries.map(([key, val]) => (
          <div key={key}>
            <dt className="text-xs text-gray-500">{labelForKey(key)}</dt>
            <dd className="mt-0.5 text-sm font-medium text-gray-900 break-words">
              {formatPrimitive(val)}
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <div className={`space-y-3 ${depth > 0 ? 'rounded-lg border border-gray-100 bg-gray-50/80 p-3' : ''}`}>
      {entries.map(([key, val]) => (
        <div key={key}>
          <p className="text-xs font-medium text-gray-500">{labelForKey(key)}</p>
          <div className="mt-1">
            {val !== null && typeof val === 'object' ? (
              <AuditDetailsStructured data={val} depth={depth + 1} />
            ) : (
              <p className="text-sm text-gray-900 break-words">{formatPrimitive(val)}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
