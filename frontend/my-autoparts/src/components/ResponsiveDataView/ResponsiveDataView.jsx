import React from 'react';

/**
 * Desktop table (or dense list) + mobile card list without duplicating data fetching.
 */
export default function ResponsiveDataView({
  isEmpty,
  emptyText = 'Нет данных',
  renderDesktop,
  renderMobile,
}) {
  if (isEmpty) {
    return <p className="py-6 text-center text-sm text-gray-500">{emptyText}</p>;
  }
  return (
    <>
      <div className="hidden md:block">{renderDesktop?.()}</div>
      <div className="md:hidden space-y-3">{renderMobile?.()}</div>
    </>
  );
}
