import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  fetchStorageLocations,
  createStorageLocation,
  updateStorageLocation,
  deleteStorageLocation,
} from '../../redux/slices/OrganizationSlice';
import DadataAddressInput from '../../components/DadataAddressInput/DadataAddressInput';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  FieldHint,
  FieldLabel,
  SectionHeader,
  Skeleton,
  fieldClass,
} from '../../components/UI';

const iconBtnClass =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50';

const StorageLocationsSection = ({ orgId }) => {
  const dispatch = useDispatch();
  const { storageLocations, loadingLocations, locationsError } = useSelector(
    (state) => state.organization
  );

  const [isAdding, setIsAdding] = useState(false);
  const [newLocation, setNewLocation] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editLocation, setEditLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    if (orgId) {
      dispatch(fetchStorageLocations(orgId));
    }
  }, [dispatch, orgId]);

  const resetAddForm = () => {
    setIsAdding(false);
    setNewLocation('');
    setFormError('');
  };

  const resetEditForm = () => {
    setEditingId(null);
    setEditLocation('');
    setFormError('');
  };

  const handleAddLocation = async (e) => {
    e.preventDefault();
    const address = newLocation.trim();
    if (!address || saving) return;

    setSaving(true);
    setFormError('');
    try {
      await dispatch(
        createStorageLocation({
          address,
          organization_id: orgId,
        })
      ).unwrap();
      resetAddForm();
    } catch (error) {
      setFormError(typeof error === 'string' ? error : 'Не удалось добавить склад');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateLocation = async (e) => {
    e.preventDefault();
    const address = editLocation.trim();
    if (!address || saving) return;

    setSaving(true);
    setFormError('');
    try {
      await dispatch(
        updateStorageLocation({
          id: editingId,
          address,
          organization_id: orgId,
        })
      ).unwrap();
      resetEditForm();
    } catch (error) {
      setFormError(typeof error === 'string' ? error : 'Не удалось сохранить склад');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLocation = async () => {
    if (!deleteId) return;
    setSaving(true);
    setFormError('');
    try {
      await dispatch(deleteStorageLocation(deleteId)).unwrap();
      if (editingId === deleteId) resetEditForm();
      setDeleteId(null);
    } catch (error) {
      setFormError(typeof error === 'string' ? error : 'Не удалось удалить склад');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SectionHeader
        title="Склады"
        subtitle="Адреса мест хранения товаров"
        action={
          !isAdding ? (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                resetEditForm();
                setIsAdding(true);
              }}
            >
              Добавить
            </Button>
          ) : null
        }
      />

      {isAdding ? (
        <form onSubmit={handleAddLocation} className="rounded-xl bg-gray-100 p-4">
          <FieldLabel htmlFor="new-storage-location">Адрес склада</FieldLabel>
          <DadataAddressInput
            id="new-storage-location"
            value={newLocation}
            onChange={setNewLocation}
            placeholder="Город, улица, дом"
            className={fieldClass}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="submit" size="sm" loading={saving} disabled={saving || !newLocation.trim()}>
              Сохранить
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={resetAddForm} disabled={saving}>
              Отмена
            </Button>
          </div>
        </form>
      ) : null}

      {formError || locationsError ? (
        <FieldHint error>{formError || locationsError}</FieldHint>
      ) : null}

      {loadingLocations ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : storageLocations && storageLocations.length > 0 ? (
        <div>
          {storageLocations.map((location) =>
            editingId === location.id ? (
              <form key={location.id} onSubmit={handleUpdateLocation} className="py-3">
                <div className="rounded-xl bg-gray-100 p-4">
                  <DadataAddressInput
                    id={`edit-storage-location-${location.id}`}
                    value={editLocation}
                    onChange={setEditLocation}
                    placeholder="Город, улица, дом"
                    className={fieldClass}
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="submit" size="sm" loading={saving} disabled={saving || !editLocation.trim()}>
                      Сохранить
                    </Button>
                    <Button type="button" variant="secondary" size="sm" onClick={resetEditForm} disabled={saving}>
                      Отмена
                    </Button>
                  </div>
                </div>
              </form>
            ) : (
              <div key={location.id} className="flex items-start gap-3 py-3">
                <p className="min-w-0 flex-1 pt-1 text-sm font-semibold text-gray-900">{location.address}</p>
                <div className="flex shrink-0">
                  <button
                    type="button"
                    className={iconBtnClass}
                    disabled={saving}
                    aria-label="Редактировать"
                    title="Редактировать"
                    onClick={() => {
                      setIsAdding(false);
                      setFormError('');
                      setEditingId(location.id);
                      setEditLocation(location.address || '');
                    }}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className={iconBtnClass}
                    disabled={saving}
                    aria-label="Удалить"
                    title="Удалить"
                    onClick={() => setDeleteId(location.id)}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      ) : (
        <EmptyState
          illustration="empty"
          title="Складов пока нет"
          description="Добавьте адрес места хранения."
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteId)}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDeleteLocation}
        title="Удалить склад?"
        message="Если к складу привязаны товары или документы, удаление будет отклонено."
        confirmLabel="Удалить"
        danger
        loading={saving}
      />
    </>
  );
};

export default StorageLocationsSection;
