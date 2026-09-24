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
import {
  Button,
  ConfirmDialog,
  EmptyState,
  FieldLabel,
  Input,
  Modal,
  Select,
  Skeleton,
  Textarea,
} from '../../components/UI';
import Toast from '../../components/UI/Toast';
import {
  autoserviceListErrorClass,
  autoserviceListHeaderSubtitleClass,
  autoserviceListHeaderTitleClass,
  autoserviceListMobileWrapClass,
  autoserviceListPageClass,
  autoserviceListPrimaryButtonClass,
  autoserviceListTableClass,
  autoserviceListTableWrapClass,
  autoserviceListTbodyClass,
  autoserviceListTdClass,
  autoserviceListTheadRowClass,
  autoserviceListThClass,
  autoserviceListTrClickableClass,
  warehousePillButtonClass,
} from '../../utils/warehouseListUi';

function cellsCountLabel(count) {
  const n = Number(count) || 0;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} адрес`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} адреса`;
  return `${n} адресов`;
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

  const [formOpen, setFormOpen] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [detailsCell, setDetailsCell] = useState(null);
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

  const flatCells = useMemo(() => {
    const rows = [];
    for (const location of sellerLocationsWithCells) {
      for (const cell of location.cells || []) {
        rows.push({
          ...cell,
          locationAddress: location.address || `Склад #${location.id}`,
        });
      }
    }
    return rows;
  }, [sellerLocationsWithCells]);

  const totalCells = flatCells.length;

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

  const resetForm = () => {
    setEditingCell(null);
    setFormOpen(false);
    setFormData(emptyForm);
    setFormError('');
  };

  const openCreateForm = (locationId = '') => {
    setEditingCell(null);
    setFormData({ ...emptyForm, storage_location_id: locationId ? String(locationId) : '' });
    setFormError('');
    setFormOpen(true);
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
    setDetailsCell(null);
    setEditingCell(cell);
    setFormData({
      name: cell.name || '',
      description: cell.description || '',
      storage_location_id: cell.storage_location_id
        ? String(cell.storage_location_id)
        : '',
    });
    setFormError('');
    setFormOpen(true);
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
      if (detailsCell?.id === cellToDelete.id) setDetailsCell(null);
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
    <div className={autoserviceListPageClass}>
      <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className={`${autoserviceListHeaderTitleClass} max-lg:hidden`}>
            Адресное хранение
          </h1>
          <p className={autoserviceListHeaderSubtitleClass}>
            {loading ? 'Загрузка…' : cellsCountLabel(totalCells)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canOpenInventory ? (
            <Link to="/warehouse/inventory" className={warehousePillButtonClass}>
              Инвентаризация
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => openCreateForm()}
            className={autoserviceListPrimaryButtonClass}
            disabled={!sellerLocations.length}
          >
            Добавить адрес
          </button>
        </div>
      </div>

      <Toast
        message={notice?.message || null}
        variant={notice?.type === 'success' ? 'success' : 'error'}
        onClose={() => setNotice(null)}
        durationMs={notice?.type === 'success' ? 3000 : 5000}
      />

      {!loading && error ? (
        <p className={autoserviceListErrorClass} role="alert">
          {typeof error === 'string' ? error : 'Не удалось загрузить адреса'}
        </p>
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

      {!error && sellerLocationsWithCells.length > 0 ? (
        <>
          <div className={autoserviceListTableWrapClass}>
            <table className={autoserviceListTableClass}>
              <thead>
                <tr className={autoserviceListTheadRowClass}>
                  <th className={`w-2/5 ${autoserviceListThClass}`}>Адрес</th>
                  <th className={`w-2/5 ${autoserviceListThClass}`}>Склад</th>
                  <th className={autoserviceListThClass}>Описание</th>
                </tr>
              </thead>
              <tbody className={autoserviceListTbodyClass}>
                {loading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <tr key={`sk-cell-${index}`}>
                      <td className={autoserviceListTdClass}><Skeleton className="h-4 w-32" /></td>
                      <td className={autoserviceListTdClass}><Skeleton className="h-4 w-40" /></td>
                      <td className={autoserviceListTdClass}><Skeleton className="h-4 w-48" /></td>
                    </tr>
                  ))
                ) : flatCells.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-12 text-center text-ink-muted">
                      Адресов пока нет — нажмите «Добавить адрес»
                    </td>
                  </tr>
                ) : (
                  flatCells.map((cell) => (
                    <tr
                      key={cell.id}
                      className={autoserviceListTrClickableClass}
                      onClick={() => setDetailsCell(cell)}
                    >
                      <td className={`min-w-0 ${autoserviceListTdClass}`}>
                        <div className="w-0 min-w-full truncate font-semibold text-ink">
                          {cell.name}
                        </div>
                      </td>
                      <td className={`min-w-0 ${autoserviceListTdClass}`}>
                        <div className="w-0 min-w-full truncate text-ink-muted">
                          {cell.locationAddress}
                        </div>
                      </td>
                      <td className={`min-w-0 ${autoserviceListTdClass}`}>
                        <div className="w-0 min-w-full truncate text-ink-muted">
                          {cell.description || '—'}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className={autoserviceListMobileWrapClass}>
            {loading ? (
              <div className="divide-y divide-line-soft">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={`msk-cell-${index}`} className="border-b border-line-soft py-2 last:border-b-0">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="mt-1 h-3 w-40" />
                  </div>
                ))}
              </div>
            ) : flatCells.length === 0 ? (
              <p className="py-10 text-center text-sm text-ink-muted">
                Адресов пока нет — нажмите «Добавить адрес»
              </p>
            ) : (
              flatCells.map((cell) => (
                <button
                  key={cell.id}
                  type="button"
                  onClick={() => setDetailsCell(cell)}
                  className="w-full border-b border-line-soft py-2 text-left last:border-b-0"
                >
                  <p className="truncate font-medium text-ink">{cell.name}</p>
                  <p className="mt-0.5 truncate text-xs text-ink-muted">
                    {cell.locationAddress}
                  </p>
                  {cell.description ? (
                    <p className="mt-1 truncate text-sm text-ink-muted">
                      {cell.description}
                    </p>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </>
      ) : null}

      <Modal
        open={Boolean(detailsCell)}
        onClose={() => setDetailsCell(null)}
        title={detailsCell?.name || 'Адрес'}
        draggable
        footer={(
          <div className="flex flex-wrap justify-end gap-2 max-md:flex-col">
            <Button
              variant="danger"
              onClick={() => setCellToDelete(detailsCell)}
              className="max-md:min-h-11"
            >
              Удалить
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleEdit(detailsCell)}
              className="max-md:min-h-11"
            >
              Редактировать
            </Button>
            <Button onClick={() => setDetailsCell(null)} className="max-md:min-h-11">
              Закрыть
            </Button>
          </div>
        )}
      >
        {detailsCell ? (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-ink-muted">Адрес</dt>
              <dd className="font-medium text-ink">{detailsCell.name}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Склад</dt>
              <dd className="text-ink">{detailsCell.locationAddress}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-ink-muted">Описание</dt>
              <dd className="text-ink">{detailsCell.description || '—'}</dd>
            </div>
          </dl>
        ) : null}
      </Modal>

      <Modal
        open={formOpen}
        onClose={resetForm}
        title={editingCell ? 'Редактировать адрес' : 'Новый адрес'}
        footer={(
          <div className="flex flex-wrap justify-end gap-2 max-md:flex-col">
            <Button
              variant="secondary"
              onClick={resetForm}
              disabled={saving}
              className="max-md:min-h-11"
            >
              Отмена
            </Button>
            <Button
              type="submit"
              form="storage-cell-form"
              loading={saving}
              disabled={saving}
              className="max-md:min-h-11"
            >
              {editingCell ? 'Сохранить' : 'Создать адрес'}
            </Button>
          </div>
        )}
      >
        <form id="storage-cell-form" onSubmit={handleSubmit} className="space-y-4">
          {!editingCell ? (
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
          ) : null}

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
        </form>
      </Modal>

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
