import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import { AUTOSERVICE_PUBLIC_NAME } from '../../utils/autoserviceConstants';
import { BECOME_CLIENT_CONFIRM } from '../../utils/autoservicePublic';
import { apiRequest } from '../../utils/apiClient';

const inputClass =
  'mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20';

const emptyForm = {
  vin: '',
  make: '',
  model: '',
  year: '',
  color: '',
  plate: '',
  notes: '',
};

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Закрыть" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl ring-1 ring-gray-200">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Закрыть"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function VehicleForm({ initial, onSubmit, onCancel, saving, submitLabel }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const make = form.make.trim();
    const model = form.model.trim();
    if (!make || !model) {
      setError('Укажите марку и модель');
      return;
    }
    const year = form.year ? Number(form.year) : null;
    if (form.year && (!Number.isFinite(year) || year < 1900 || year > 2100)) {
      setError('Некорректный год');
      return;
    }
    try {
      await onSubmit({
        vin: form.vin.trim() || null,
        make,
        model,
        year,
        color: form.color.trim() || null,
        plate: form.plate.trim() || null,
        notes: form.notes.trim() || null,
      });
    } catch (err) {
      setError(err?.message || 'Не удалось сохранить');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">VIN</label>
        <input
          className={inputClass}
          value={form.vin}
          onChange={(e) => setForm((p) => ({ ...p, vin: e.target.value.toUpperCase() }))}
          maxLength={17}
          disabled={saving}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Марка</label>
        <input
          className={inputClass}
          value={form.make}
          onChange={(e) => setForm((p) => ({ ...p, make: e.target.value }))}
          required
          disabled={saving}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Модель</label>
        <input
          className={inputClass}
          value={form.model}
          onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))}
          required
          disabled={saving}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Год</label>
        <input
          type="number"
          className={inputClass}
          value={form.year}
          onChange={(e) => setForm((p) => ({ ...p, year: e.target.value }))}
          min={1900}
          max={2100}
          disabled={saving}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Цвет</label>
        <input
          className={inputClass}
          value={form.color}
          onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
          disabled={saving}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Госномер</label>
        <input
          className={inputClass}
          value={form.plate}
          onChange={(e) => setForm((p) => ({ ...p, plate: e.target.value }))}
          disabled={saving}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Заметка</label>
        <textarea
          className={inputClass}
          rows={3}
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          disabled={saving}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          disabled={saving}
        >
          Отмена
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {saving ? 'Сохранение…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

export default function GaragePage() {
  const { isReady, isAuthenticated } = useAuthReady();
  const { token } = useSelector((state) => state.auth);

  const [meLoading, setMeLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [becomeSaving, setBecomeSaving] = useState(false);
  const [becomeError, setBecomeError] = useState(null);

  const [vehicles, setVehicles] = useState([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [pageError, setPageError] = useState(null);

  const [addOpen, setAddOpen] = useState(false);
  const [addStep, setAddStep] = useState('vin');
  const [vinInput, setVinInput] = useState('');
  const [vinDecoding, setVinDecoding] = useState(false);
  const [vinError, setVinError] = useState(null);
  const [addForm, setAddForm] = useState(emptyForm);
  const [addSaving, setAddSaving] = useState(false);

  const [editVehicle, setEditVehicle] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const loadMe = useCallback(async () => {
    if (!token) {
      setIsClient(false);
      setMeLoading(false);
      return;
    }
    setMeLoading(true);
    try {
      const data = await apiRequest('/autoservice/clients/me');
      setIsClient(data?.is_client === true);
    } catch {
      setIsClient(false);
    } finally {
      setMeLoading(false);
    }
  }, [token]);

  const loadVehicles = useCallback(async () => {
    setVehiclesLoading(true);
    setPageError(null);
    try {
      const data = await apiRequest('/autoservice/garage/vehicles');
      setVehicles(Array.isArray(data) ? data : []);
    } catch (err) {
      setPageError(err?.message || 'Не удалось загрузить автомобили');
      setVehicles([]);
    } finally {
      setVehiclesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isReady && isAuthenticated) {
      loadMe();
    }
  }, [isReady, isAuthenticated, loadMe]);

  useEffect(() => {
    if (isReady && isAuthenticated && isClient) {
      loadVehicles();
    }
  }, [isReady, isAuthenticated, isClient, loadVehicles]);

  const handleBecomeClient = async () => {
    setBecomeError(null);
    if (!window.confirm(BECOME_CLIENT_CONFIRM(AUTOSERVICE_PUBLIC_NAME))) {
      return;
    }
    setBecomeSaving(true);
    try {
      await apiRequest('/autoservice/clients/me', { method: 'POST' });
      setIsClient(true);
    } catch (err) {
      setBecomeError(err?.message || 'Не удалось стать клиентом');
    } finally {
      setBecomeSaving(false);
    }
  };

  const openAdd = () => {
    setAddStep('vin');
    setVinInput('');
    setVinError(null);
    setAddForm(emptyForm);
    setAddOpen(true);
  };

  const handleDecodeVin = async () => {
    setVinError(null);
    const vin = vinInput.trim().toUpperCase();
    if (vin.length !== 17) {
      setVinError('VIN должен содержать 17 символов');
      return;
    }
    setVinDecoding(true);
    try {
      const result = await apiRequest('/autoservice/garage/decode-vin', {
        method: 'POST',
        body: JSON.stringify({ vin }),
      });
      if (result?.ok) {
        setAddForm((p) => ({ ...p, vin, ...result.data }));
        setAddStep('form');
      } else {
        setAddForm((p) => ({ ...emptyForm, vin }));
        setAddStep('form');
      }
    } catch (err) {
      setVinError(err?.message || 'Не удалось распознать VIN');
    } finally {
      setVinDecoding(false);
    }
  };

  const handleCreateVehicle = async (body) => {
    setAddSaving(true);
    try {
      const row = await apiRequest('/autoservice/garage/vehicles', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setVehicles((prev) => [row, ...prev]);
      setAddOpen(false);
    } finally {
      setAddSaving(false);
    }
  };

  const handleUpdateVehicle = async (body) => {
    if (!editVehicle) return;
    setEditSaving(true);
    try {
      const row = await apiRequest(`/autoservice/garage/vehicles/${editVehicle.id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      setVehicles((prev) => prev.map((v) => (v.id === row.id ? row : v)));
      setEditVehicle(null);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteVehicle = async (id) => {
    if (!window.confirm('Удалить автомобиль из гаража?')) return;
    setDeletingId(id);
    setPageError(null);
    try {
      await apiRequest(`/autoservice/garage/vehicles/${id}`, { method: 'DELETE' });
      setVehicles((prev) => prev.filter((v) => v.id !== id));
    } catch (err) {
      setPageError(err?.message || 'Не удалось удалить');
    } finally {
      setDeletingId(null);
    }
  };

  if (!isReady) return <AuthLoadingScreen />;

  if (meLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-gray-500">
        Загрузка…
      </div>
    );
  }

  if (!isClient) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900">Гараж</h1>
        <p className="mt-4 text-gray-600">
          Гараж доступен клиентам автосервиса. Станьте клиентом, чтобы хранить свои автомобили.
        </p>
        <button
          type="button"
          onClick={handleBecomeClient}
          disabled={becomeSaving}
          className="mt-6 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {becomeSaving ? 'Сохранение…' : 'Стать клиентом автосервиса'}
        </button>
        {becomeError && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {becomeError}
          </p>
        )}
        <p className="mt-6 text-sm text-gray-500">
          Или перейдите на{' '}
          <Link to="/autoservice" className="text-indigo-600 hover:underline">
            страницу автосервиса
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Гараж</h1>
          <p className="mt-1 text-sm text-gray-500">Ваши автомобили</p>
          <p className="mt-2 text-sm">
            <Link to="/garage/orders" className="text-indigo-600 hover:underline">
              Мои записи
            </Link>
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Добавить авто
        </button>
      </div>

      {pageError && (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {pageError}
        </p>
      )}

      <div className="mt-6 space-y-3">
        {vehiclesLoading ? (
          <p className="text-sm text-gray-500">Загрузка автомобилей…</p>
        ) : vehicles.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
            Пока нет автомобилей. Добавьте первый по VIN или вручную.
          </p>
        ) : (
          vehicles.map((v) => (
            <div
              key={v.id}
              className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold text-gray-900">
                  {v.make} {v.model}
                  {v.year ? `, ${v.year}` : ''}
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  {v.vin ? `VIN: ${v.vin}` : 'VIN не указан'}
                  {v.plate ? ` · ${v.plate}` : ''}
                  {v.color ? ` · ${v.color}` : ''}
                </p>
                {v.notes && <p className="mt-1 text-sm text-gray-500">{v.notes}</p>}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditVehicle(v)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Изменить
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteVehicle(v.id)}
                  disabled={deletingId === v.id}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
                >
                  {deletingId === v.id ? '…' : 'Удалить'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {addOpen && addStep === 'vin' && (
        <Modal title="Добавить автомобиль" onClose={() => setAddOpen(false)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Введите VIN — попробуем подставить данные автоматически.</p>
            <div>
              <label className="block text-sm font-medium text-gray-700">VIN</label>
              <input
                className={inputClass}
                value={vinInput}
                onChange={(e) => {
                  setVinInput(e.target.value.toUpperCase());
                  setVinError(null);
                }}
                maxLength={17}
                disabled={vinDecoding}
              />
              {vinError && <p className="mt-1 text-sm text-red-600">{vinError}</p>}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setAddForm(emptyForm);
                  setAddStep('form');
                }}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Ввести вручную
              </button>
              <button
                type="button"
                onClick={handleDecodeVin}
                disabled={vinDecoding}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {vinDecoding ? 'Проверка…' : 'Распознать'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {addOpen && addStep === 'form' && (
        <Modal title="Данные автомобиля" onClose={() => setAddOpen(false)}>
          <VehicleForm
            initial={addForm}
            saving={addSaving}
            submitLabel="Добавить"
            onCancel={() => setAddOpen(false)}
            onSubmit={handleCreateVehicle}
          />
        </Modal>
      )}

      {editVehicle && (
        <Modal title="Изменить автомобиль" onClose={() => setEditVehicle(null)}>
          <VehicleForm
            initial={{
              vin: editVehicle.vin || '',
              make: editVehicle.make || '',
              model: editVehicle.model || '',
              year: editVehicle.year ? String(editVehicle.year) : '',
              color: editVehicle.color || '',
              plate: editVehicle.plate || '',
              notes: editVehicle.notes || '',
            }}
            saving={editSaving}
            submitLabel="Сохранить"
            onCancel={() => setEditVehicle(null)}
            onSubmit={handleUpdateVehicle}
          />
        </Modal>
      )}
    </div>
  );
}
