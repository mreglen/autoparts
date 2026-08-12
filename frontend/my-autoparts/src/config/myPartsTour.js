export const TOUR_LAYOUT_DELAY_MS = 180;

export function waitForTourLayout(delayMs = TOUR_LAYOUT_DELAY_MS) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, delayMs);
  });
}

export const MY_PARTS_TOUR_TARGETS = {
  HEADER: '[data-tour="my-parts-header"]',
  ADD: '[data-tour="my-parts-add"]',
  TABS: '[data-tour="my-parts-tabs"]',
  SEARCH: '#my-parts-search',
  FILTERS: '[data-tour="my-parts-filters"]',
  TOOLBAR: '[data-tour="my-parts-toolbar"]',
  ROW: '[data-tour="my-parts-row"]',
  ROW_ACTIONS: '[data-tour="my-parts-row-actions"]',
  QR: '[data-tour="my-parts-qr"]',
};

export const MY_PARTS_TOUR_STEP_IDS = {
  HEADER: 'header',
  ADD: 'add',
  TABS_IN_STOCK: 'tabs-in-stock',
  TABS_MODERATION: 'tabs-moderation',
  TABS_DRAFTS: 'tabs-drafts',
  SEARCH: 'search',
  FILTERS: 'filters',
  TOOLBAR: 'toolbar',
  ROW: 'row',
  QR: 'qr',
};

async function prepareInStockView({
  onSwitchTab,
  onCloseFilters,
  onSetRowActionsOpen,
}) {
  onSwitchTab?.('in-stock');
  onCloseFilters?.();
  onSetRowActionsOpen?.(false);
  await waitForTourLayout();
}

/**
 * @param {{
 *   showQr?: boolean,
 *   hasParts?: boolean,
 *   onSwitchTab?: (tab: string) => void,
 *   onOpenFilters?: () => void,
 *   onCloseFilters?: () => void,
 *   onSetRowActionsOpen?: (open: boolean) => void,
 * }} options
 */
export function buildMyPartsSteps({
  showQr = false,
  hasParts = true,
  onSwitchTab,
  onOpenFilters,
  onCloseFilters,
  onSetRowActionsOpen,
} = {}) {
  const steps = [
    {
      id: MY_PARTS_TOUR_STEP_IDS.HEADER,
      target: MY_PARTS_TOUR_TARGETS.HEADER,
      title: 'Ваш склад запчастей',
      body: 'Мои запчасти — центр управления складом. Здесь отображаются сумма, количество и число позиций.',
      placement: 'bottom',
      beforeEnter: () => prepareInStockView({
        onSwitchTab,
        onCloseFilters,
        onSetRowActionsOpen,
      }),
    },
    {
      id: MY_PARTS_TOUR_STEP_IDS.ADD,
      target: MY_PARTS_TOUR_TARGETS.ADD,
      title: 'Добавить запчасть',
      body: 'Создайте карточку товара: фото, цена, склад, привязка к автомобилю.',
      placement: 'bottom',
      beforeEnter: () => prepareInStockView({
        onSwitchTab,
        onCloseFilters,
        onSetRowActionsOpen,
      }),
    },
    {
      id: MY_PARTS_TOUR_STEP_IDS.TABS_IN_STOCK,
      target: MY_PARTS_TOUR_TARGETS.TABS,
      title: 'Вкладка «В наличии»',
      body: 'Опубликованные товары, которые уже прошли модерацию и доступны для продажи.',
      placement: 'bottom',
      beforeEnter: () => prepareInStockView({
        onSwitchTab,
        onCloseFilters,
        onSetRowActionsOpen,
      }),
    },
    {
      id: MY_PARTS_TOUR_STEP_IDS.TABS_MODERATION,
      target: MY_PARTS_TOUR_TARGETS.TABS,
      title: 'Вкладка «На модерации»',
      body: 'Запчасти, которые отправлены на проверку и ещё не опубликованы на сайте.',
      placement: 'bottom',
      beforeEnter: async () => {
        onSwitchTab?.('pending');
        onCloseFilters?.();
        onSetRowActionsOpen?.(false);
        await waitForTourLayout();
      },
    },
    {
      id: MY_PARTS_TOUR_STEP_IDS.TABS_DRAFTS,
      target: MY_PARTS_TOUR_TARGETS.TABS,
      title: 'Вкладка «Черновики»',
      body: 'Незавершённые формы добавления. Черновик сохраняется автоматически — можно продолжить позже.',
      placement: 'bottom',
      beforeEnter: async () => {
        onSwitchTab?.('drafts');
        onCloseFilters?.();
        onSetRowActionsOpen?.(false);
        await waitForTourLayout();
      },
    },
    {
      id: MY_PARTS_TOUR_STEP_IDS.SEARCH,
      target: MY_PARTS_TOUR_TARGETS.SEARCH,
      title: 'Поиск',
      body: 'Ищите по названию, артикулу и внутреннему коду на складе.',
      placement: 'bottom',
      beforeEnter: () => prepareInStockView({
        onSwitchTab,
        onCloseFilters,
        onSetRowActionsOpen,
      }),
    },
    {
      id: MY_PARTS_TOUR_STEP_IDS.FILTERS,
      target: MY_PARTS_TOUR_TARGETS.FILTERS,
      title: 'Фильтры',
      body: 'Фильтруйте по складу, ячейке, позиции и ответственному сотруднику.',
      placement: 'bottom',
      beforeEnter: async () => {
        onSwitchTab?.('in-stock');
        onSetRowActionsOpen?.(false);
        onOpenFilters?.();
        await waitForTourLayout();
      },
      afterLeave: async () => {
        onCloseFilters?.();
      },
    },
    {
      id: MY_PARTS_TOUR_STEP_IDS.TOOLBAR,
      target: MY_PARTS_TOUR_TARGETS.TOOLBAR,
      title: 'Панель действий',
      body: 'Массовый выбор, сортировка и групповые действия — например, экспорт на Avito.',
      placement: 'top',
      beforeEnter: () => prepareInStockView({
        onSwitchTab,
        onCloseFilters,
        onSetRowActionsOpen,
      }),
    },
    {
      id: MY_PARTS_TOUR_STEP_IDS.ROW,
      target: MY_PARTS_TOUR_TARGETS.ROW,
      title: hasParts ? 'Строка запчасти' : 'Список запчастей',
      body: hasParts
        ? 'Меню «Действия» открыто: продажа, списание, печать этикетки и экспорт на площадки.'
        : 'Здесь будут ваши запчасти. В меню строки: продать, списать, печать, экспорт.',
      placement: 'top',
      customFooter: 'row',
      beforeEnter: async () => {
        onSwitchTab?.('in-stock');
        onCloseFilters?.();
        if (hasParts) {
          onSetRowActionsOpen?.(true);
        } else {
          onSetRowActionsOpen?.(false);
        }
        await waitForTourLayout(hasParts ? 220 : TOUR_LAYOUT_DELAY_MS);
      },
      afterLeave: async () => {
        onSetRowActionsOpen?.(false);
      },
    },
  ];

  if (showQr) {
    steps.push({
      id: MY_PARTS_TOUR_STEP_IDS.QR,
      target: MY_PARTS_TOUR_TARGETS.QR,
      title: 'QR-сканирование',
      body: 'Быстрый переход к сканированию QR-кодов на складе.',
      placement: 'bottom',
      beforeEnter: () => prepareInStockView({
        onSwitchTab,
        onCloseFilters,
        onSetRowActionsOpen,
      }),
    });
  }

  return steps;
}
