import React from 'react';

export default function PurchasesReturnsTab() {
  return (
    <div className="text-center py-16 px-6">
      <div className="bg-gray-100 rounded-full w-20 h-20 md:w-24 md:h-24 mx-auto mb-6 flex items-center justify-center">
        <svg className="h-10 w-10 md:h-12 md:w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
        </svg>
      </div>
      <h2 className="text-xl md:text-2xl font-medium text-gray-900 mb-2">Возвраты покупок</h2>
      <p className="text-gray-500 text-base">Функционал возвратов находится в разработке</p>
    </div>
  );
}
