import React from 'react';

export default function RosskoOrdersTab() {
  return (
    <div className="text-center py-16 px-6">
      <div className="bg-gray-100 rounded-full w-20 h-20 md:w-24 md:h-24 mx-auto mb-6 flex items-center justify-center">
        <svg className="h-10 w-10 md:h-12 md:w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <h2 className="text-xl md:text-2xl font-medium text-gray-900 mb-2">Заказы Росско</h2>
      <p className="text-gray-500 text-base">Функционал заказов Росско находится в разработке</p>
    </div>
  );
}
