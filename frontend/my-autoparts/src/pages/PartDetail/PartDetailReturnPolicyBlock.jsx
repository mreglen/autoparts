import React from 'react';
import { Card } from '../../components/UI';

export default function PartDetailReturnPolicyBlock({ isNew = false }) {
  return (
    <Card as="section" padding="sm" className="border-warning-100 sm:p-5">
      <h2 className="text-base font-semibold text-ink">Гарантия и возврат</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        {isNew
          ? 'Условия гарантии, сроки и комплектацию новой детали уточняйте у продавца до оплаты. Возврат возможен по договорённости с продавцом и в рамках правил платформы.'
          : 'Б/у запчасть продаётся в текущем состоянии. Возврат и обмен — только по договорённости с продавцом до установки. Сохраняйте упаковку и документы до проверки детали.'}
      </p>
      <p className="mt-2 text-xs text-ink-muted">
        «Свой Гараж» — маркетплейс: условия возврата определяет продавец, если иное не указано в заказе.
      </p>
    </Card>
  );
}
