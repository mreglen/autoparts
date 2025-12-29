import React from 'react';

export default function ReturnsTab() {
  return (
    <div className="text-center py-16">
      <div className="bg-gray-100 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
        <svg className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
        </svg>
      </div>
      <h2 className="text-2xl font-medium text-gray-900 mb-2">Возвраты</h2>
      <p className="text-gray-500">Функционал возвратов находится в разработке</p>
    </div>
  );
}
