import { DEFAULT_CITY, formatCityInPrepositional } from './organizationCity';

function formatPricePhrase(price) {
  if (price == null || price === '') return '';
  const amount = Number(price);
  if (!Number.isFinite(amount) || amount <= 0) return '';
  return Number.isInteger(amount) ? `${amount} ₽` : `${amount.toFixed(2)} ₽`;
}

export function buildProductFaqItems({
  brand,
  article,
  partTypeName,
  isNew = false,
  city,
  fitmentText,
  inStock = true,
  quantity,
  price,
  stockSummary,
} = {}) {
  const brandText = String(brand || '').trim();
  const articleText = String(article || '').trim();
  const label = [brandText, articleText].filter(Boolean).join(' ') || 'эта запчасть';
  const partType = String(partTypeName || '').trim() || 'автозапчасть';
  const cityPrep = formatCityInPrepositional(city || DEFAULT_CITY);
  const condition = isNew ? 'новая' : 'б/у';
  const fitment = String(fitmentText || '').trim().replace(/\.$/, '');
  const pricePhrase = formatPricePhrase(price);
  const stockText = String(stockSummary || '').trim().replace(/\.$/, '');
  let qty = null;
  if (quantity != null && quantity !== '') {
    const parsed = Number(quantity);
    if (Number.isFinite(parsed)) qty = Math.max(0, Math.trunc(parsed));
  }

  const items = [];

  if (fitment) {
    items.push({
      question: `На какие автомобили подходит ${label}?`,
      answer:
        `По справочным данным ${label} (${partType.toLowerCase()}) может подойти для: ${fitment}. `
        + `Перед покупкой сверьте артикул ${articleText || label} и уточните совместимость у продавца.`,
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

  let stockAnswer;
  if (inStock) {
    const qtyPart = qty && qty > 1 ? ` (${qty} шт.)` : '';
    const pricePart = pricePhrase ? ` Актуальная цена на карточке — ${pricePhrase}.` : '';
    const stockPart = stockText ? ` ${stockText}.` : '';
    stockAnswer = (
      `Да, ${label} сейчас в наличии${qtyPart} в ${cityPrep}.${pricePart}${stockPart} `
      + 'Количество и сроки доставки уточняйте на карточке перед заказом.'
    );
  } else if (isNew) {
    stockAnswer = (
      `Сейчас новых предложений ${label} на складах нет. Посмотрите б/у варианты `
      + `${label} в каталоге «Свой Гараж» или аналоги на этой странице.`
    );
  } else {
    stockAnswer = (
      `Это предложение сейчас недоступно. Посмотрите другие варианты ${label} `
      + 'в каталоге б/у запчастей «Свой Гараж».'
    );
  }

  items.push({
    question: `Есть ли ${label} в наличии?`,
    answer: stockAnswer,
  });

  items.push({
    question: `Как оформить доставку и оплату для ${label}?`,
    answer:
      `Добавьте ${label} в корзину на svoygarage.ru или свяжитесь с продавцом. `
      + `Доставка по России, самовывоз в ${cityPrep} — условия согласуются при заказе. `
      + 'Подробнее — на странице «Доставка».',
  });

  if (isNew) {
    items.push({
      question: `Какое состояние у новой запчасти ${label}?`,
      answer:
        `Это новая ${partType.toLowerCase()} ${label} со склада поставщика. `
        + 'Состояние упаковки и комплектацию уточняйте у продавца перед покупкой.',
    });
  } else {
    items.push({
      question: `Какое состояние у б/у запчасти ${label}?`,
      answer:
        `Это ${condition} ${partType.toLowerCase()} ${label}. Рекомендуем осмотреть деталь `
        + 'лично или запросить дополнительные фото и видео у продавца перед оплатой.',
    });
  }

  const priceHint = pricePhrase && inStock ? ` по цене ${pricePhrase}` : '';
  items.push({
    question: `Как купить ${label} на «Свой Гараж»?`,
    answer:
      `Откройте карточку ${label}${priceHint}, добавьте товар в корзину или нажмите «Написать» / `
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
  quantity,
  price,
  stockSummary,
} = {}) {
  const items = buildProductFaqItems({
    brand,
    article,
    partTypeName,
    isNew,
    city,
    fitmentText,
    inStock,
    quantity,
    price,
    stockSummary,
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
