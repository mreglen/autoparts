import React from 'react';
import RosskoOrdersTab from './RosskoOrdersTab';

export default function RosskoOrdersPage() {
  return (
    <div className="mt-4 sm:mt-5 px-4 sm:px-0">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Росско</h1>
        <p className="mt-2 text-gray-600 text-base sm:text-base">Управление заказами из системы Росско</p>
      </div>

      <RosskoOrdersTab />
    </div>
  );
}
