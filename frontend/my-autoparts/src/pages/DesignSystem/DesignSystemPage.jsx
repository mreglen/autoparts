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
} from '../../components/UI';

export default function DesignSystemPage() {
  const { isReady, user } = useAuthReady();
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!isReady) return <AuthLoadingScreen />;
  if (!user?.is_admin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="mx-auto max-w-sg-narrow space-y-10 px-4 py-6 sm:px-0">
      <PageHeader
        title="Дизайн-система"
        subtitle="Эталон компонентов «Свой Гараж»: состояния, размеры и токены"
      />

      <section className="space-y-4">
        <SectionHeader title="Кнопки" subtitle="Primary, secondary, soft, danger, accent" />
        <Card>
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
          </div>
        </Card>
      </section>

      <section className="space-y-4">
        <SectionHeader title="Поля" />
        <Card className="grid gap-4 sm:grid-cols-2">
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
        </Card>
      </section>

      <section className="space-y-4">
        <SectionHeader title="Бейджи и статусы" />
        <Card className="flex flex-wrap gap-2">
          <Badge>Neutral</Badge>
          <Badge tone="brand">Brand</Badge>
          <Badge tone="accent">Б/у</Badge>
          <StatusBadge label="Готов" tone="success" />
          <StatusBadge label="Ожидает" tone="warning" />
          <StatusBadge label="Отменён" tone="danger" />
        </Card>
      </section>

      <section className="space-y-4">
        <SectionHeader title="Карточки и пустые состояния" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Card hover>
            <p className="text-sm font-semibold text-ink">Обычная карточка</p>
            <p className="mt-1 text-sm text-ink-muted">Светлая поверхность, тонкая рамка, без градиентов.</p>
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
          title="Модалки"
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
