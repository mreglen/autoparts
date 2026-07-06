import React from 'react';

export default function PartDetailReturnPolicyBlock({ isNew = false }) {
  return (
    <section className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4 sm:p-5">
      <h2 className="text-base font-semibold text-gray-900">Гарантия и возврат</h2>
      <p className="mt-2 text-sm leading-relaxed text-gray-700">
        {isNew
          ? 'Условия гарантии, сроки и комплектацию новой детали уточняйте у продавца до оплаты. Возврат возможен по договорённости с продавцом и в рамках правил платформы.'
          : 'Б/у запчасть продаётся в текущем состоянии. Возврат и обмен — только по договорённости с продавцом до установки. Сохраняйте упаковку и документы до проверки детали.'}
      </p>
      <p className="mt-2 text-xs text-gray-500">
        «Свой Гараж» — маркетплейс: условия возврата определяет продавец, если иное не указано в заказе.
      </p>
    </section>
  );
}
