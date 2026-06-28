import { DEFAULT_CITY, formatCityInPrepositional } from './organizationCity';

export function buildProductFaqItems({
  brand,
  article,
  partTypeName,
  isNew = false,
  city,
  fitmentText,
  inStock = true,
} = {}) {
  const brandText = String(brand || '').trim();
  const articleText = String(article || '').trim();
  const label = [brandText, articleText].filter(Boolean).join(' ') || 'эта запчасть';
  const partType = String(partTypeName || '').trim() || 'автозапчасть';
  const cityPrep = formatCityInPrepositional(city || DEFAULT_CITY);
  const condition = isNew ? 'новая' : 'б/у';
  const fitment = String(fitmentText || '').trim().replace(/\.$/, '');

  const items = [];

  if (fitment) {
    items.push({
      question: `На какие автомобили подходит ${label}?`,
      answer:
        `По справочным данным ${label} (${partType.toLowerCase()}) может подойти для: ${fitment}. `
        + `Перед покупкой уточните совместимость у продавца — это ${condition} деталь, осмотр рекомендуется.`,
    });
  } else {
    items.push({
      question: `Как проверить, подойдёт ли ${label} на мой автомобиль?`,
      answer:
        `Сверьте артикул ${articleText || label} с каталогом производителя или VIN. `
        + `На «Свой Гараж» можно написать продавцу в чат и уточнить совместимость `
        + `перед заказом ${condition} ${partType.toLowerCase()}.`,
    });
  }

  items.push({
    question: `Есть ли ${label} в наличии?`,
    answer: inStock
      ? `Да, ${label} сейчас в наличии в ${cityPrep}. Количество и актуальность уточняйте на карточке или у продавца.`
      : `Это предложение может быть недоступно. Посмотрите другие варианты ${label} в каталоге б/у запчастей «Свой Гараж».`,
  });

  items.push({
    question: 'Как оформить доставку и оплату?',
    answer:
      `Добавьте товар в корзину на svoygarage.ru или свяжитесь с продавцом. `
      + `Доставка по России, самовывоз в ${cityPrep} — условия согласуются с продавцом. `
      + 'Подробнее — на странице «Доставка».',
  });

  if (isNew) {
    items.push({
      question: `Какое состояние у новой запчасти ${label}?`,
      answer:
        `Это новая ${partType.toLowerCase()} ${label}. Состояние упаковки и комплектацию `
        + 'уточняйте у продавца перед покупкой.',
    });
  } else {
    items.push({
      question: `Какое состояние у б/у запчасти ${label}?`,
      answer:
        `Это ${condition} ${partType.toLowerCase()} ${label}. Рекомендуем осмотреть деталь `
        + 'лично или запросить дополнительные фото и видео у продавца перед оплатой.',
    });
  }

  items.push({
    question: 'Как купить запчасть на «Свой Гараж»?',
    answer:
      `Откройте карточку ${label}, добавьте товар в корзину или нажмите «Написать» / `
      + '«Позвонить» продавцу. Оформление заказа и оплата проходят через маркетплейс '
      + 'или напрямую с продавцом — как указано на карточке.',
  });

  return items;
}

export function buildProductFaqJsonLd({
  canonicalUrl,
  brand,
  article,
  partTypeName,
  isNew = false,
  city,
  fitmentText,
  inStock = true,
} = {}) {
  const items = buildProductFaqItems({
    brand,
    article,
    partTypeName,
    isNew,
    city,
    fitmentText,
    inStock,
  });
  return {
    '@type': 'FAQPage',
    '@id': `${canonicalUrl}#faq`,
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}
