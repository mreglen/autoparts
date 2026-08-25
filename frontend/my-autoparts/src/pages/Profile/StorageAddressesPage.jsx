import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, Navigate } from 'react-router-dom';
import {
  fetchLocationsWithCells,
  fetchStorageCells,
  createStorageCell,
  updateStorageCell,
  deleteStorageCell,
} from '../../redux/slices/StorageCellsSlice';
import { fetchStorageLocations } from '../../redux/slices/OrganizationSlice';
import { fetchMyProducts } from '../../redux/slices/ProductSlice';
import { canViewInventory } from '../../utils/inventoryAccess';
import { useShowWarehouseInventory } from '../../utils/siteReviewsPublic';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import PageIntro from '../../components/PageIntro/PageIntro';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  FieldLabel,
  Input,
  Select,
  Skeleton,
  Textarea,
} from '../../components/UI';
import {
  warehousePageClass,
  warehousePrimaryButtonClass,
} from '../../utils/warehouseListUi';

const iconBtnClass =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-50';

function cellsCountLabel(count) {
  const n = Number(count) || 0;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} адрес`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} адреса`;
  return `${n} адресов`;
}

function InlineNotice({ notice, onClose }) {
  if (!notice) return null;
  const isSuccess = notice.type === 'success';
  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-sg border px-4 py-3 ${
        isSuccess
          ? 'border-success-100 bg-success-50 text-success-700'
          : 'border-danger-100 bg-danger-50 text-danger-700'
      }`}
      role="status"
    >
      <p className="text-sm font-medium">{notice.message}</p>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 rounded-md p-1 opacity-70 transition hover:opacity-100"
        aria-label="Закрыть"
      >
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  );
}

const emptyForm = {
  name: '',
  description: '',
  storage_location_id: '',
};

export default function StorageAddressesPage() {
  const dispatch = useDispatch();
  const { isReady, user } = useAuthReady();
  const permissionCodes = useSelector((state) => state.auth.permissionCodes);
  const { locationsWithCells, loading, error, lastModified } = useSelector(
    (state) => state.storageCells,
  );
  const { storageLocations } = useSelector((state) => state.organization);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [cellToDelete, setCellToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [notice, setNotice] = useState(null);

  const hasPermission =
    user?.is_admin ||
    user?.is_seller ||
    (user?.is_employee && permissionCodes?.includes('storage-addresses'));

  const showWarehouseInventory = useShowWarehouseInventory();
  const canOpenInventory = showWarehouseInventory && canViewInventory(user, permissionCodes);

  const sellerLocations = useMemo(
    () =>
      (storageLocations || []).filter(
        (location) => location.organization_id === user?.organization_id,
      ),
    [storageLocations, user?.organization_id],
  );

  const sellerLocationsWithCells = useMemo(
    () =>
      (locationsWithCells || []).filter(
        (location) => location.organization_id === user?.organization_id,
      ),
    [locationsWithCells, user?.organization_id],
  );

  const totalCells = useMemo(
    () =>
      sellerLocationsWithCells.reduce(
        (sum, location) => sum + (location.cells?.length || 0),
        0,
      ),
    [sellerLocationsWithCells],
  );

  useEffect(() => {
    if (!isReady || !hasPermission || !user?.organization_id) return;
    dispatch(fetchStorageLocations(user.organization_id));
    dispatch(fetchLocationsWithCells());
    dispatch(fetchStorageCells());
  }, [dispatch, user?.organization_id, isReady, hasPermission]);

  useEffect(() => {
    if (!user?.organization_id || !lastModified) return;
    dispatch(fetchMyProducts({ page: 1, page_size: 500 }));
    dispatch(fetchLocationsWithCells());
    dispatch(fetchStorageCells());
  }, [dispatch, lastModified, user?.organization_id]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), notice.type === 'success' ? 3000 : 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  const resetForm = () => {
    setEditingCell(null);
    setShowAddForm(false);
    setFormData(emptyForm);
    setFormError('');
  };

  const openCreateForm = () => {
    setEditingCell(null);
    setFormData(emptyForm);
    setFormError('');
    setShowAddForm(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    const name = formData.name.trim();
    if (!name) {
      setFormError('Укажите название ячейки');
      return;
    }
    if (!editingCell && !formData.storage_location_id) {
      setFormError('Выберите склад');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      if (editingCell) {
        await dispatch(
          updateStorageCell({
            id: editingCell.id,
            name,
            description: formData.description,
            storage_location_id: formData.storage_location_id,
          }),
        ).unwrap();
        setNotice({ type: 'success', message: `Адрес «${name}» обновлён` });
      } else {
        await dispatch(
          createStorageCell({
            name,
            description: formData.description,
            storage_location_id: formData.storage_location_id,
          }),
        ).unwrap();
        setNotice({ type: 'success', message: `Адрес «${name}» создан` });
      }
      resetForm();
    } catch (err) {
      setFormError(typeof err === 'string' ? err : 'Не удалось сохранить адрес');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (cell) => {
    setEditingCell(cell);
    setFormData({
      name: cell.name || '',
      description: cell.description || '',
      storage_location_id: cell.storage_location_id
        ? String(cell.storage_location_id)
        : '',
    });
    setFormError('');
    setShowAddForm(true);
    setTimeout(() => {
      document.getElementById('storage-cell-form')?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }, 50);
  };

  const handleDeleteConfirm = async () => {
    if (!cellToDelete) return;
    setDeleteLoading(true);
    try {
      await dispatch(deleteStorageCell(cellToDelete.id)).unwrap();
      setNotice({
        type: 'success',
        message: `Адрес «${cellToDelete.name}» удалён`,
      });
      setCellToDelete(null);
      if (editingCell?.id === cellToDelete.id) resetForm();
    } catch (err) {
      const message =
        typeof err === 'string'
          ? err
          : err?.message || 'Не удалось удалить адрес';
      setNotice({ type: 'error', message });
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!isReady) {
    return <AuthLoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!hasPermission) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className={`${warehousePageClass} min-w-0 space-y-4`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageIntro
          title="Адресное хранение"
          description={
            !loading && !error && totalCells > 0
              ? cellsCountLabel(totalCells)
              : 'Ячейки и адреса внутри складов организации'
          }
          className="mb-0"
        />
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          {canOpenInventory ? (
            <Link
              to="/warehouse/inventory"
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Инвентаризация
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => (showAddForm && !editingCell ? resetForm() : openCreateForm())}
            className={`${warehousePrimaryButtonClass} w-full sm:w-auto`}
            disabled={!sellerLocations.length && !showAddForm}
          >
            {showAddForm && !editingCell ? 'Отмена' : 'Добавить адрес'}
          </button>
        </div>
      </div>

      <InlineNotice notice={notice} onClose={() => setNotice(null)} />

      {showAddForm ? (
        <Card id="storage-cell-form">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-ink">
                {editingCell ? 'Редактировать адрес' : 'Новый адрес'}
              </h2>
              <p className="mt-0.5 text-sm text-ink-muted">
                {editingCell
                  ? 'Измените название или описание ячейки'
                  : 'Выберите склад и укажите название ячейки'}
              </p>
            </div>
            {editingCell ? (
              <Badge tone="neutral">ID {editingCell.id}</Badge>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {editingCell ? (
              <div>
                <FieldLabel htmlFor="cell-name" required>
                  Название ячейки
                </FieldLabel>
                <Input
                  id="cell-name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  placeholder="Например: A1, Стеллаж 1, Полка 2"
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <FieldLabel htmlFor="cell-warehouse" required>
                    Склад
                  </FieldLabel>
                  <Select
                    id="cell-warehouse"
                    name="storage_location_id"
                    value={formData.storage_location_id}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Выберите склад</option>
                    {sellerLocations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.address}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <FieldLabel htmlFor="cell-name" required>
                    Название ячейки
                  </FieldLabel>
                  <Input
                    id="cell-name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    placeholder="Например: A1, Стеллаж 1, Полка 2"
                  />
                </div>
              </div>
            )}

            <div>
              <FieldLabel htmlFor="cell-description">Описание</FieldLabel>
              <Textarea
                id="cell-description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={3}
                placeholder="Описание ячейки (необязательно)"
              />
            </div>

            {formError ? (
              <p className="text-sm text-danger-600">{formError}</p>
            ) : null}

            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="submit" loading={saving} disabled={saving}>
                {editingCell ? 'Сохранить' : 'Создать адрес'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={resetForm}
                disabled={saving}
              >
                Отмена
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-sg-lg" />
          <Skeleton className="h-40 w-full rounded-sg-lg" />
        </div>
      ) : null}

      {!loading && error ? (
        <EmptyState
          illustration="error"
          title="Не удалось загрузить адреса"
          description={typeof error === 'string' ? error : 'Попробуйте обновить страницу'}
        />
      ) : null}

      {!loading && !error && sellerLocationsWithCells.length === 0 ? (
        <EmptyState
          illustration="empty"
          title="Складов пока нет"
          description={
            user?.is_seller || user?.is_director
              ? 'Сначала добавьте склад в настройках организации — затем создайте адреса ячеек.'
              : 'Обратитесь к директору организации, чтобы добавить склады.'
          }
          actionLabel={
            user?.is_seller || user?.is_director ? 'Перейти к организации' : undefined
          }
          actionHref={
            user?.is_seller || user?.is_director ? '/settings/organization' : undefined
          }
        />
      ) : null}

      {!loading && !error
        ? sellerLocationsWithCells.map((location) => (
            <Card key={location.id} padding="none" className="overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line bg-surface-subtle/60 px-5 py-4 sm:px-6">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                    Склад
                  </p>
                  <h3 className="mt-0.5 text-base font-semibold text-ink">
                    {location.address || `Склад #${location.id}`}
                  </h3>
                </div>
                <Badge tone="brand">{cellsCountLabel(location.cells?.length || 0)}</Badge>
              </div>

              <div className="p-5 sm:p-6">
                {!location.cells?.length ? (
                  <div className="rounded-sg border border-dashed border-line bg-surface-subtle/40 px-4 py-8 text-center">
                    <p className="text-sm font-medium text-ink">Нет адресов</p>
                    <p className="mt-1 text-sm text-ink-muted">
                      В этом складе ещё нет ячеек.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      className="mt-4"
                      onClick={() => {
                        openCreateForm();
                        setFormData((prev) => ({
                          ...prev,
                          storage_location_id: String(location.id),
                        }));
                      }}
                    >
                      Добавить адрес
                    </Button>
                  </div>
                ) : (
                  <ul className="divide-y divide-line">
                    {location.cells.map((cell) => (
                      <li
                        key={cell.id}
                        className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0 flex-1 pt-0.5">
                          <p className="text-sm font-semibold text-ink">{cell.name}</p>
                          {cell.description ? (
                            <p className="mt-0.5 text-sm text-ink-muted">
                              {cell.description}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0">
                          <button
                            type="button"
                            className={iconBtnClass}
                            aria-label="Редактировать"
                            title="Редактировать"
                            onClick={() => handleEdit(cell)}
                          >
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className={`${iconBtnClass} hover:bg-danger-50 hover:text-danger-700`}
                            aria-label="Удалить"
                            title="Удалить"
                            onClick={() => setCellToDelete(cell)}
                          >
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          ))
        : null}

      <ConfirmDialog
        open={Boolean(cellToDelete)}
        onClose={() => setCellToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Удалить адрес?"
        message={`Адрес «${cellToDelete?.name || ''}» будет удалён вместе со связями с товарами. Это действие нельзя отменить.`}
        confirmLabel="Удалить"
        danger
        loading={deleteLoading}
      />
    </div>
  );
}
