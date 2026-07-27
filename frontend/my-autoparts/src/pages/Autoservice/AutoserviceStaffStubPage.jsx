import React from 'react';

const TITLES = {
  inspections: 'Записи на тех осмотр',
  clients: 'Клиенты',
  orders: 'Записи',
  settings: 'Настройки автосервиса',
};

export default function AutoserviceStaffStubPage({ section = 'orders' }) {
  const title = TITLES[section] || 'Автосервис';

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      <p className="mt-4 text-gray-600">Раздел в разработке.</p>
    </div>
  );
}
