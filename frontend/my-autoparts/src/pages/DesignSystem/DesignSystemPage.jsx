import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  ConfirmDialog,
  DataTable,
  EmptyState,
  FieldHint,
  FieldLabel,
  Input,
  Modal,
  PageHeader,
  SectionHeader,
  Select,
  SkeletonCard,
  StatusBadge,
  Textarea,
  UnderlineTabs,
} from '../../components/UI';

const COLOR_SWATCHES = [
  { name: 'brand', value: '#4f46e5', className: 'bg-brand-600' },
  { name: 'brand-50', value: '#eef2ff', className: 'bg-brand-50 ring-1 ring-line' },
  { name: 'ink', value: '#0f172a', className: 'bg-ink' },
  { name: 'ink-muted', value: '#64748b', className: 'bg-ink-muted' },
  { name: 'surface', value: '#ffffff', className: 'bg-surface ring-1 ring-line' },
  { name: 'surface-subtle', value: '#f1f5f9', className: 'bg-surface-subtle ring-1 ring-line' },
  { name: 'line', value: '#e2e8f0', className: 'bg-line ring-1 ring-line-strong' },
  { name: 'success', value: '#059669', className: 'bg-success' },
  { name: 'warning', value: '#d97706', className: 'bg-warning' },
  { name: 'danger', value: '#dc2626', className: 'bg-danger' },
  { name: 'accent', value: '#ea580c', className: 'bg-accent' },
  { name: 'sky solid', value: '#0ea5e9', className: 'bg-sky-500' },
];

const PRINCIPLES = [
  {
    title: 'Одна линейка',
    text: 'Слева и справа контент выровнен по одной вертикали. Без лишнего px поверх отступов layout.',
  },
  {
    title: 'Плоские списки',
    text: 'Строки и карточки списков без обводки и тени сливаются с фоном страницы. Разделители — только если нужны.',
  },
  {
    title: 'Pill-контроли',
    text: 'Поиск и фильтры — rounded-full / rounded-xl на bg-gray-100, без серой обводки у внутренних белых чипов.',
  },
  {
    title: 'Одно действие на блок',
    text: 'Шапка: заголовок + одна CTA. Вкладки отдельной строкой. Массовые действия — компактно в серой панели.',
  },
];

function DemoTabs() {
  const [tab, setTab] = useState('stock');
  const tabs = [
    { id: 'stock', label: 'В наличии', shortLabel: 'В наличии', count: 13 },
    { id: 'pending', label: 'На модерации', shortLabel: 'Модерация', count: 0 },
    { id: 'drafts', label: 'Черновики', shortLabel: 'Черновики', count: 2 },
  ];

  return (
    <UnderlineTabs
      ariaLabel="Пример вкладок"
      tabs={tabs}
      value={tab}
      onChange={setTab}
    />
  );
}

function DemoListRow({ title, meta, price }) {
  return (
    <div className="flex gap-3 py-3">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100">
        <label className="absolute left-1 top-1 z-10 flex cursor-pointer items-center justify-center">
          <input type="checkbox" className="my-parts-photo-checkbox" readOnly />
        </label>
        <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">фото</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-1">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-900">{title}</p>
            <p className="mt-0.5 truncate text-xs text-gray-500">{meta}</p>
          </div>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
            aria-label="Действия"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <circle cx="12" cy="5" r="1.75" />
              <circle cx="12" cy="12" r="1.75" />
              <circle cx="12" cy="19" r="1.75" />
            </svg>
          </button>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-base font-bold tabular-nums text-gray-900">{price}</span>
          <span className="text-xs tabular-nums text-gray-500">1 шт.</span>
        </div>
      </div>
    </div>
  );
}

export default function DesignSystemPage() {
  const { isReady, user } = useAuthReady();
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  if (!isReady) return <AuthLoadingScreen />;
  if (!user?.is_admin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="w-full min-w-0 space-y-10">
      <PageHeader
        title="Дизайн-система"
        subtitle="Актуальные паттерны кабинета: my-parts, планировщик, заказ-наряды"
      />

      <section className="space-y-4">
        <SectionHeader title="Принципы" subtitle="Как собирать экраны кабинета" />
        <div className="grid gap-3 sm:grid-cols-2">
          {PRINCIPLES.map((item) => (
            <div key={item.title} className="rounded-xl bg-gray-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-900">{item.title}</h3>
              <p className="mt-1 text-sm text-gray-600">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader title="Цвета" subtitle="Токены из tailwind.config.js" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {COLOR_SWATCHES.map((swatch) => (
            <div key={swatch.name} className="min-w-0">
              <div className={`h-14 rounded-xl ${swatch.className}`} />
              <p className="mt-1.5 truncate text-sm font-medium text-gray-900">{swatch.name}</p>
              <p className="truncate text-xs tabular-nums text-gray-500">{swatch.value}</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-gray-500">
          Радиусы: <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">rounded-xl</code> для панелей и чипов,
          {' '}<code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">rounded-full</code> для поиска и pill-кнопок,
          {' '}<code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">rounded-lg</code> для CTA и меню.
        </p>
      </section>

      <section className="space-y-4">
        <SectionHeader title="Кнопки" />
        <div className="flex flex-wrap gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="soft">Soft</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="accent">Accent</Button>
          <Button variant="danger">Danger</Button>
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            CTA кабинета
          </button>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
            aria-label="Действия"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <circle cx="12" cy="5" r="1.75" />
              <circle cx="12" cy="12" r="1.75" />
              <circle cx="12" cy="19" r="1.75" />
            </svg>
          </button>
        </div>
        <p className="text-sm text-gray-500">
          На мобильных в списках — только три точки без текста «Действия».
        </p>
      </section>

      <section className="space-y-4">
        <SectionHeader title="Вкладки" subtitle="UnderlineTabs — полоска плавно скользит к активной" />
        <DemoTabs />
        <p className="text-sm text-gray-500">
          Компонент <code className="rounded bg-gray-100 px-1 text-xs">UnderlineTabs</code> из UI-kit.
          Одна чёрная полоска анимируется через <code className="rounded bg-gray-100 px-1 text-xs">transform</code> и{' '}
          <code className="rounded bg-gray-100 px-1 text-xs">width</code> (~300ms).
        </p>
      </section>

      <section className="space-y-4">
        <SectionHeader title="Поиск и фильтры" subtitle="В одной строке: поиск слева, фильтры справа" />
        <div className="flex items-center gap-2">
          <input
            className="h-10 min-w-0 flex-1 rounded-full border-0 bg-gray-100 px-4 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-indigo-400/70"
            placeholder="Поиск по названию, артикулу и коду"
            readOnly
          />
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-gray-100 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-200 ${
              filtersOpen ? 'bg-white ring-2 ring-indigo-400/70' : ''
            }`}
          >
            Фильтры
            <svg
              className={`h-4 w-4 transition-transform ${filtersOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        {filtersOpen ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button type="button" className="h-10 rounded-full bg-gray-100 px-4 text-left text-sm text-gray-500">
              Склад
            </button>
            <button type="button" className="h-10 rounded-full bg-gray-100 px-4 text-left text-sm text-gray-500">
              Ячейка
            </button>
            <button type="button" className="h-10 rounded-full bg-gray-100 px-4 text-left text-sm text-gray-500">
              Ответственный
            </button>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2.5 rounded-xl bg-gray-100 px-3 py-2.5">
          <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl bg-white px-3 text-sm text-gray-700">
            <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-indigo-600" readOnly />
            Выбрать всё
          </label>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border-0 bg-white px-3 text-sm text-gray-700 shadow-none"
          >
            Сначала новые
            <svg className="h-3.5 w-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            type="button"
            className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white text-gray-600"
            aria-label="Действия"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <circle cx="12" cy="5" r="1.75" />
              <circle cx="12" cy="12" r="1.75" />
              <circle cx="12" cy="19" r="1.75" />
            </svg>
          </button>
        </div>
        <p className="text-sm text-gray-500">
          Внутренние белые чипы: тот же <code className="rounded bg-gray-100 px-1 text-xs">rounded-xl</code>, что у родителя, без ring/border.
        </p>
      </section>

      <section className="space-y-4">
        <SectionHeader title="Список без карточек" subtitle="Фон строки = фон страницы" />
        <div>
          <DemoListRow title="Bosch · 0986424590" meta="Код товара: TVGP-AABER" price="875 ₽" />
          <DemoListRow title="Mann · HU7185X" meta="Код товара: 00013" price="1 002 ₽" />
        </div>
        <p className="text-sm text-gray-500">
          Чекбокс на фото: серый фон без обводки, при выборе — синий. Класс{' '}
          <code className="rounded bg-gray-100 px-1 text-xs">.my-parts-photo-checkbox</code>.
        </p>
      </section>

      <section className="space-y-4">
        <SectionHeader title="Статусы" subtitle="Мягкие в списках, сплошные в планировщике" />
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
              Ожидание
            </span>
            <span className="inline-flex items-center rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-800 ring-1 ring-inset ring-sky-200">
              В работе
            </span>
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
              Завершён
            </span>
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-200">
              Отменён
            </span>
            <StatusBadge label="Готов" tone="success" />
            <Badge tone="brand">Brand</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded-lg bg-sky-500 px-2 py-1.5 text-xs font-semibold text-white hover:bg-sky-600">
              15:15–16:00
            </button>
            <button type="button" className="rounded-lg bg-emerald-500 px-2 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600">
              10:00–11:00
            </button>
            <button type="button" className="rounded-lg bg-gray-400 px-2 py-1.5 text-xs font-semibold text-white hover:bg-gray-500">
              12:00–13:00
            </button>
          </div>
          <p className="text-sm text-gray-500">
            Планировщик: сплошная заливка без полупрозрачного фона и без обводки.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader title="Поля формы" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel required>Имя</FieldLabel>
            <Input placeholder="Иван" />
            <FieldHint>Подсказка под полем</FieldHint>
          </div>
          <div>
            <FieldLabel>Статус</FieldLabel>
            <Select defaultValue="new">
              <option value="new">Новый</option>
              <option value="ready">Готов</option>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <FieldLabel>Комментарий</FieldLabel>
            <Textarea placeholder="Коротко и по делу" />
          </div>
          <Checkbox label="Согласен с условиями" defaultChecked />
          <div>
            <FieldLabel>Ошибка</FieldLabel>
            <Input error defaultValue="Неверный телефон" />
            <FieldHint error>Укажите телефон в формате +7…</FieldHint>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeader title="Карточки UI-kit" subtitle="Только для интерактивных контейнеров и форм" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Card hover>
            <p className="text-sm font-semibold text-ink">Карточка с рамкой</p>
            <p className="mt-1 text-sm text-ink-muted">
              Для настроек и форм. Не использовать как обёртку каждой строки списка.
            </p>
          </Card>
          <SkeletonCard />
        </div>
        <EmptyState
          illustration="search"
          title="Ничего не нашли"
          description="Проверьте артикул или попробуйте другое название"
          actionLabel="Открыть каталог"
          actionHref="/catalog"
        />
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="Таблица и модалки"
          action={(
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setModalOpen(true)}>Modal</Button>
              <Button variant="danger" onClick={() => setConfirmOpen(true)}>Confirm</Button>
            </div>
          )}
        />
        <DataTable
          columns={[
            { key: 'name', label: 'Название' },
            { key: 'qty', label: 'Кол-во' },
            { key: 'status', label: 'Статус', render: (row) => <StatusBadge label={row.status} tone="brand" /> },
          ]}
          rows={[
            { id: 1, name: 'Фильтр масляный', qty: 4, status: 'В наличии' },
            { id: 2, name: 'Колодки передние', qty: 2, status: 'Мало' },
          ]}
        />
        <p className="text-sm text-gray-500">
          На мобильных таблицу заменяйте плоским списком карточек (как заказ-наряды).
        </p>
      </section>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Пример модального окна">
        <p className="text-sm text-ink-soft">Единый Modal с Escape, блокировкой скролла и footer-слотом.</p>
      </Modal>
      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => setConfirmOpen(false)}
        title="Удалить позицию?"
        message="Действие нельзя отменить."
        confirmLabel="Удалить"
        danger
      />
    </div>
  );
}
