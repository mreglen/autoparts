import React from 'react';

export default function BuyerProfileBlock() {
  return (
    <section className="rounded-2xl border border-gray-100 bg-gray-50 p-6 sm:p-8">
      <h2 className="text-lg font-semibold text-gray-900">Покупатель на «Свой Гараж»</h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600">
        Участник маркетплейса. Связаться можно через встроенные сообщения — кнопка «Написать» в шапке профиля.
      </p>
    </section>
  );
}
