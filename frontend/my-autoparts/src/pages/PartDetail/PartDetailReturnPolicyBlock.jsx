import React from 'react';

export default function PartDetailReturnPolicyBlock({ isNew = false }) {
  return (
    <section className="border-t border-line pt-6">
      <h2 className="text-base font-semibold text-ink">Гарантия и возврат</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        {isNew
          ? 'Условия гарантии, сроки и комплектацию новой детали уточняйте у продавца до оплаты. Возврат — по договорённости и правилам платформы.'
          : 'Б/у запчасть продаётся в текущем состоянии. Возврат и обмен — только по договорённости с продавцом до установки.'}
      </p>
    </section>
  );
}
