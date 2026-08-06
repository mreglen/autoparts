/**
 * Copy / tone of voice helpers for «Свой Гараж».
 * Prefer concrete actions and facts over abstract marketing language.
 */
export const COPY = {
  searchPlaceholder: 'Артикул, бренд или название детали',
  searchCta: 'Найти',
  catalogNew: 'Новые запчасти',
  catalogUsed: 'Б/у запчасти',
  emptySearchTitle: 'Ничего не нашли',
  emptySearchHint: 'Проверьте артикул или попробуйте другое название',
  emptyOrdersTitle: 'Заказов пока нет',
  emptyOrdersHint: 'Когда появятся новые заказы, они отобразятся здесь',
  emptyGarageTitle: 'В гараже пусто',
  emptyGarageHint: 'Добавьте автомобиль, чтобы записываться на ремонт быстрее',
  emptyCartTitle: 'Корзина пустая',
  emptyCartHint: 'Добавьте детали из каталога новых или б/у',
  trustLine: 'Каталог, чат с продавцом и заказ в одном месте',
  sellerCta: 'Открыть кабинет продавца',
  buyerCta: 'Смотреть каталог',
};

export function formatPartsCount(count) {
  const n = Number(count) || 0;
  const mod10 = n % 10;
  const mod100 = n % 100;
  let word = 'деталей';
  if (mod10 === 1 && mod100 !== 11) word = 'деталь';
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) word = 'детали';
  return `${n.toLocaleString('ru-RU')} ${word}`;
}
