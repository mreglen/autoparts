import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  fetchStorageLocations,
  createStorageLocation,
  updateStorageLocation,
  deleteStorageLocation,
} from '../../redux/slices/OrganizationSlice';
import DadataAddressInput from '../../components/DadataAddressInput/DadataAddressInput';
import Button from '../../components/UI/Button';
import {
  SettingsCard,
  SettingsIconButton,
  settingsInputClass,
} from './settingsUi';

const PinIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const PencilIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const TrashIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

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

  const handleDeleteLocation = async (id) => {
    if (!window.confirm('Удалить этот склад?')) return;
    setSaving(true);
    setFormError('');
    try {
      await dispatch(deleteStorageLocation(id)).unwrap();
      if (editingId === id) resetEditForm();
    } catch (error) {
      setFormError(typeof error === 'string' ? error : 'Не удалось удалить склад');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsCard>
      <div className="mb-4 flex items-start justify-between gap-3">
        <p className="text-sm text-ink-muted">Адреса мест хранения товаров</p>
        {!isAdding ? (
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
        ) : null}
      </div>

      {isAdding ? (
        <form onSubmit={handleAddLocation} className="mb-4 rounded-sg border border-brand-100 bg-brand-50/40 p-4">
          <label className="mb-1.5 block text-xs font-medium text-ink-muted">Адрес склада</label>
          <DadataAddressInput
            id="new-storage-location"
            value={newLocation}
            onChange={setNewLocation}
            placeholder="Город, улица, дом"
            className={settingsInputClass}
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
        <p className="mb-3 rounded-sg border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700" role="alert">
          {formError || locationsError}
        </p>
      ) : null}

      {loadingLocations ? (
        <div className="animate-pulse space-y-2">
          <div className="h-14 rounded-sg bg-surface-subtle" />
          <div className="h-14 rounded-sg bg-surface-subtle" />
        </div>
      ) : storageLocations && storageLocations.length > 0 ? (
        <div className="space-y-2">
          {storageLocations.map((location) =>
            editingId === location.id ? (
              <form
                key={location.id}
                onSubmit={handleUpdateLocation}
                className="rounded-sg border border-brand-200 bg-brand-50/50 p-4"
              >
                <DadataAddressInput
                  id={`edit-storage-location-${location.id}`}
                  value={editLocation}
                  onChange={setEditLocation}
                  placeholder="Город, улица, дом"
                  className={settingsInputClass}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="submit" size="sm" loading={saving} disabled={saving || !editLocation.trim()}>
                    Сохранить
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={resetEditForm} disabled={saving}>
                    Отмена
                  </Button>
                </div>
              </form>
            ) : (
              <div
                key={location.id}
                className="flex min-h-[56px] items-start gap-3 rounded-sg border border-line bg-white px-3 py-3 sm:px-4"
              >
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <PinIcon />
                </span>
                <p className="min-w-0 flex-1 break-words pt-1.5 text-sm font-medium text-ink">{location.address}</p>
                <div className="flex shrink-0 gap-1.5">
                  <SettingsIconButton
                    label="Редактировать"
                    disabled={saving}
                    onClick={() => {
                      setIsAdding(false);
                      setFormError('');
                      setEditingId(location.id);
                      setEditLocation(location.address || '');
                    }}
                  >
                    <PencilIcon />
                  </SettingsIconButton>
                  <SettingsIconButton
                    label="Удалить"
                    danger
                    disabled={saving}
                    onClick={() => handleDeleteLocation(location.id)}
                  >
                    <TrashIcon />
                  </SettingsIconButton>
                </div>
              </div>
            )
          )}
        </div>
      ) : (
        <p className="rounded-sg border border-dashed border-line px-4 py-8 text-center text-sm text-ink-muted">
          Складов пока нет. Добавьте адрес места хранения.
        </p>
      )}
    </SettingsCard>
  );
};

export default StorageLocationsSection;
