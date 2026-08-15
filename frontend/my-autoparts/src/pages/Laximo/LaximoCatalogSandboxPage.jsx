import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import SoftServiceNotice from '../../components/SoftServiceNotice/SoftServiceNotice';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import { apiRequest } from '../../utils/apiClient';
import {
  candidateLabel,
  softNoticeVariantFromReason,
} from '../../utils/laximoVinCandidate';
import { normalizeVinOrNull, sanitizeVinInput, VIN_INPUT_MAX_LENGTH } from '../../utils/laximoVin';

const inputClass =
  'mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20';

function qs(params) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== '') sp.set(k, String(v));
  });
  return sp.toString();
}

function vehicleCtx(vehicle) {
  return {
    catalog: vehicle?.catalog || '',
    vehicle_id: vehicle?.vehicle_id || '',
    ssd: vehicle?.ssd || '',
  };
}

export default function LaximoCatalogSandboxPage() {
  const { isReady, isAuthenticated } = useAuthReady();

  const [step, setStep] = useState('vin'); // vin | pick | browse
  const [vinInput, setVinInput] = useState('');
  const [vinLoading, setVinLoading] = useState(false);
  const [vinError, setVinError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [vehicle, setVehicle] = useState(null);

  const [mode, setMode] = useState('quick'); // quick | oem
  const [hasQuickgroups, setHasQuickgroups] = useState(false);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState(null);

  const [quickGroups, setQuickGroups] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryStack, setCategoryStack] = useState([]); // [{id, name}]
  const [units, setUnits] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [details, setDetails] = useState([]);
  const [unitInfo, setUnitInfo] = useState(null);
  const [fromSnapshot, setFromSnapshot] = useState(false);
  const [snapshotFetchedAt, setSnapshotFetchedAt] = useState(null);

  const resetBrowse = () => {
    setQuickGroups([]);
    setCategories([]);
    setCategoryStack([]);
    setUnits([]);
    setSelectedUnit(null);
    setDetails([]);
    setUnitInfo(null);
    setBrowseError(null);
    setNotice(null);
  };

  const noteSnapshot = (result) => {
    if (result?.from_snapshot) {
      setFromSnapshot(true);
      setSnapshotFetchedAt(result.snapshot_fetched_at || null);
    }
  };

  const handleSoftFail = (result) => {
    if (!result || result.ok) return false;
    setNotice(softNoticeVariantFromReason(result.reason));
    setBrowseError(result.message || null);
    return true;
  };

  const startBrowse = async (cand) => {
    setVehicle(cand);
    resetBrowse();
    setStep('browse');
    setBrowseLoading(true);
    try {
      const ctx = vehicleCtx(cand);
      const feat = await apiRequest(
        `/laximo/catalog/features?${qs({ catalog: ctx.catalog })}`
      );
      if (handleSoftFail(feat)) return;
      noteSnapshot(feat);
      const qg = Boolean(feat?.has_quickgroups);
      setHasQuickgroups(qg);
      const nextMode = qg ? 'quick' : 'oem';
      setMode(nextMode);
      if (qg) {
        const groups = await apiRequest(`/laximo/quick-groups?${qs(ctx)}`);
        if (handleSoftFail(groups)) return;
        noteSnapshot(groups);
        setQuickGroups(Array.isArray(groups?.quick_groups) ? groups.quick_groups : []);
      } else {
        const cats = await apiRequest(
          `/laximo/categories?${qs({ ...ctx, category_id: '-1' })}`
        );
        if (handleSoftFail(cats)) return;
        noteSnapshot(cats);
        setCategories(Array.isArray(cats?.categories) ? cats.categories : []);
        setCategoryStack([]);
      }
    } catch (err) {
      setBrowseError(err?.message || 'Не удалось открыть каталог');
      setNotice('unavailable');
    } finally {
      setBrowseLoading(false);
    }
  };

  const handleDecodeVin = async () => {
    setVinError(null);
    setNotice(null);
    const vin = normalizeVinOrNull(vinInput);
    if (!vin) {
      setVinError('VIN должен содержать от 11 до 17 символов');
      return;
    }
    setVinInput(vin);
    setVinLoading(true);
    try {
      const result = await apiRequest('/laximo/vehicles/by-vin', {
        method: 'POST',
        body: JSON.stringify({ vin }),
      });
      const list = Array.isArray(result?.candidates) ? result.candidates : [];
      if (result?.ok && list.length === 1) {
        noteSnapshot(result);
        await startBrowse(list[0]);
        return;
      }
      if (result?.ok && list.length > 1) {
        noteSnapshot(result);
        setCandidates(list);
        setStep('pick');
        return;
      }
      setNotice(softNoticeVariantFromReason(result?.reason));
      setStep('vin');
    } catch (err) {
      setVinError(err?.message || 'Не удалось распознать VIN');
    } finally {
      setVinLoading(false);
    }
  };

  const loadOemRoot = useCallback(async () => {
    if (!vehicle) return;
    setBrowseLoading(true);
    setBrowseError(null);
    setNotice(null);
    setUnits([]);
    setSelectedUnit(null);
    setDetails([]);
    setUnitInfo(null);
    try {
      const cats = await apiRequest(
        `/laximo/categories?${qs({ ...vehicleCtx(vehicle), category_id: '-1' })}`
      );
      if (handleSoftFail(cats)) return;
      noteSnapshot(cats);
      setCategories(Array.isArray(cats?.categories) ? cats.categories : []);
      setCategoryStack([]);
    } catch (err) {
      setBrowseError(err?.message || 'Не удалось загрузить категории');
      setNotice('unavailable');
    } finally {
      setBrowseLoading(false);
    }
  }, [vehicle]);

  const openCategory = async (cat) => {
    if (!vehicle || !cat?.category_id) return;
    const ctx = vehicleCtx(vehicle);
    const ssd = cat.ssd || ctx.ssd;
    setBrowseLoading(true);
    setBrowseError(null);
    setNotice(null);
    setSelectedUnit(null);
    setDetails([]);
    setUnitInfo(null);
    try {
      if (cat.has_children) {
        const cats = await apiRequest(
          `/laximo/categories?${qs({
            catalog: ctx.catalog,
            vehicle_id: ctx.vehicle_id,
            ssd,
            category_id: cat.category_id,
          })}`
        );
        if (handleSoftFail(cats)) return;
        setCategoryStack((prev) => [...prev, { id: cat.category_id, name: cat.name }]);
        setCategories(Array.isArray(cats?.categories) ? cats.categories : []);
        setUnits([]);
      } else {
        const unitsRes = await apiRequest(
          `/laximo/units?${qs({
            catalog: ctx.catalog,
            vehicle_id: ctx.vehicle_id,
            ssd,
            category_id: cat.category_id,
          })}`
        );
        if (handleSoftFail(unitsRes)) return;
        setCategoryStack((prev) => [...prev, { id: cat.category_id, name: cat.name }]);
        setUnits(Array.isArray(unitsRes?.units) ? unitsRes.units : []);
        setCategories([]);
      }
    } catch (err) {
      setBrowseError(err?.message || 'Не удалось открыть категорию');
      setNotice('unavailable');
    } finally {
      setBrowseLoading(false);
    }
  };

  const openUnit = async (unit) => {
    if (!vehicle || !unit?.unit_id) return;
    const ctx = vehicleCtx(vehicle);
    const ssd = unit.ssd || ctx.ssd;
    setBrowseLoading(true);
    setBrowseError(null);
    setNotice(null);
    setSelectedUnit(unit);
    try {
      const res = await apiRequest(
        `/laximo/units/${encodeURIComponent(unit.unit_id)}?${qs({
          catalog: ctx.catalog,
          vehicle_id: ctx.vehicle_id,
          ssd,
        })}`
      );
      if (handleSoftFail(res)) return;
      setUnitInfo(res?.unit || null);
      setDetails(Array.isArray(res?.details) ? res.details : []);
    } catch (err) {
      setBrowseError(err?.message || 'Не удалось загрузить детали узла');
      setNotice('unavailable');
    } finally {
      setBrowseLoading(false);
    }
  };

  const openQuickGroup = async (group) => {
    if (!vehicle || !group?.quick_group_id) return;
    if (group.link === false) {
      setBrowseError('Это группа-контейнер. Выберите вложенный раздел.');
      return;
    }
    const ctx = vehicleCtx(vehicle);
    const ssd = group.ssd || ctx.ssd;
    setBrowseLoading(true);
    setBrowseError(null);
    setNotice(null);
    setSelectedUnit({ name: group.name, unit_id: group.quick_group_id });
    setUnitInfo({ name: group.name });
    try {
      const res = await apiRequest(
        `/laximo/quick-groups/${encodeURIComponent(group.quick_group_id)}/details?${qs({
          catalog: ctx.catalog,
          vehicle_id: ctx.vehicle_id,
          ssd,
        })}`
      );
      if (handleSoftFail(res)) return;
      const detailRows = Array.isArray(res?.details) ? res.details : [];
      const unit = res?.unit || null;
      setUnitInfo(unit || { name: group.name });
      setSelectedUnit(
        unit
          ? { ...unit, name: unit.name || group.name }
          : { name: group.name, unit_id: group.quick_group_id }
      );
      setDetails(detailRows);
    } catch (err) {
      setBrowseError(err?.message || 'Не удалось загрузить группу');
      setNotice('unavailable');
    } finally {
      setBrowseLoading(false);
    }
  };

  const switchMode = async (next) => {
    if (next === mode) return;
    setMode(next);
    setSelectedUnit(null);
    setDetails([]);
    setUnitInfo(null);
    setBrowseError(null);
    setNotice(null);
    if (next === 'oem') {
      await loadOemRoot();
    } else if (vehicle) {
      setBrowseLoading(true);
      try {
        const groups = await apiRequest(`/laximo/quick-groups?${qs(vehicleCtx(vehicle))}`);
        if (handleSoftFail(groups)) return;
        setQuickGroups(Array.isArray(groups?.quick_groups) ? groups.quick_groups : []);
        setCategories([]);
        setUnits([]);
        setCategoryStack([]);
      } catch (err) {
        setBrowseError(err?.message || 'Не удалось загрузить группы');
        setNotice('unavailable');
      } finally {
        setBrowseLoading(false);
      }
    }
  };

  const backToVin = () => {
    setStep('vin');
    setVehicle(null);
    setCandidates([]);
    setFromSnapshot(false);
    setSnapshotFetchedAt(null);
    resetBrowse();
  };

  if (!isReady) return <AuthLoadingScreen />;

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900">Каталог по VIN</h1>
        <p className="mt-3 text-sm text-gray-600">Войдите, чтобы открыть каталог узлов.</p>
        <Link to="/auth" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline">
          Войти
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Каталог по VIN</h1>
          <p className="mt-1 text-sm text-gray-500">
            Песочница: узлы и OEM без проверки наличия на складе.
          </p>
        </div>
        {step !== 'vin' ? (
          <button
            type="button"
            onClick={backToVin}
            className="text-sm font-medium text-indigo-600 hover:underline"
          >
            Новый VIN
          </button>
        ) : null}
      </div>

      {notice ? (
        <div className="mt-4">
          <SoftServiceNotice
            variant={notice}
            onRetry={notice === 'unavailable' || notice === 'not_found' ? backToVin : undefined}
          />
        </div>
      ) : null}

      {fromSnapshot ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Данные из сохранённого снимка
          {snapshotFetchedAt ? ` (загружено ${snapshotFetchedAt})` : ''}. Laximo API недоступен или
          ответ отдан из локального хранилища.
        </div>
      ) : null}

      {step === 'vin' && (
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <label className="block text-sm font-medium text-gray-700">VIN</label>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row">
            <input
              className={inputClass}
              value={vinInput}
              onChange={(e) => {
                setVinInput(sanitizeVinInput(e.target.value));
                setVinError(null);
                setNotice(null);
              }}
              maxLength={VIN_INPUT_MAX_LENGTH}
              disabled={vinLoading}
              placeholder="17 символов"
            />
            <button
              type="button"
              onClick={handleDecodeVin}
              disabled={vinLoading}
              className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {vinLoading ? 'Поиск…' : 'Найти'}
            </button>
          </div>
          {vinError ? <p className="mt-2 text-sm text-red-600">{vinError}</p> : null}
        </div>
      )}

      {step === 'pick' && (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-gray-600">Найдено несколько автомобилей. Выберите вариант.</p>
          <ul className="space-y-2">
            {candidates.map((c, idx) => (
              <li key={`${c.vehicle_id || 'v'}-${idx}`}>
                <button
                  type="button"
                  onClick={() => startBrowse(c)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm hover:border-indigo-300 hover:bg-indigo-50/40"
                >
                  <span className="font-medium text-gray-900">{candidateLabel(c)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {step === 'browse' && vehicle && (
        <div className="mt-6 space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-sm font-semibold text-gray-900">
              {candidateLabel(vehicle) || vehicle.display_name || 'Автомобиль'}
            </p>
            <p className="mt-0.5 text-xs text-gray-500">
              Каталог: {vehicle.catalog || '—'}
            </p>
          </div>

          {hasQuickgroups ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => switchMode('quick')}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  mode === 'quick'
                    ? 'bg-indigo-600 text-white'
                    : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Быстрые группы
              </button>
              <button
                type="button"
                onClick={() => switchMode('oem')}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  mode === 'oem'
                    ? 'bg-indigo-600 text-white'
                    : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Оригинальный каталог
              </button>
            </div>
          ) : null}

          {browseLoading ? <p className="text-sm text-gray-500">Загрузка…</p> : null}
          {browseError && !notice ? (
            <p className="text-sm text-red-600" role="alert">
              {browseError}
            </p>
          ) : null}

          {mode === 'quick' && (
            <ul className="space-y-2">
              {quickGroups.map((g, idx) => (
                <li key={`${g.quick_group_id || 'g'}-${idx}`}>
                  <button
                    type="button"
                    onClick={() => openQuickGroup(g)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm hover:border-indigo-300 hover:bg-indigo-50/40"
                  >
                    {g.name || g.quick_group_id}
                    {g.link === false ? (
                      <span className="ml-2 text-xs text-gray-400">(раздел)</span>
                    ) : null}
                  </button>
                </li>
              ))}
              {!browseLoading && quickGroups.length === 0 ? (
                <p className="text-sm text-gray-500">Группы не найдены.</p>
              ) : null}
            </ul>
          )}

          {mode === 'oem' && (
            <div className="space-y-3">
              {categoryStack.length > 0 ? (
                <p className="text-xs text-gray-500">
                  {categoryStack.map((c) => c.name || c.id).join(' / ')}
                </p>
              ) : null}
              {categories.length > 0 ? (
                <ul className="space-y-2">
                  {categories.map((c, idx) => (
                    <li key={`${c.category_id || 'c'}-${idx}`}>
                      <button
                        type="button"
                        onClick={() => openCategory(c)}
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm hover:border-indigo-300 hover:bg-indigo-50/40"
                      >
                        {c.name || c.category_id}
                        {c.has_children ? (
                          <span className="ml-2 text-xs text-gray-400">→</span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {units.length > 0 ? (
                <ul className="space-y-2">
                  {units.map((u, idx) => (
                    <li key={`${u.unit_id || 'u'}-${idx}`}>
                      <button
                        type="button"
                        onClick={() => openUnit(u)}
                        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm hover:border-indigo-300 hover:bg-indigo-50/40"
                      >
                        {u.name || u.unit_id}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {!browseLoading && categories.length === 0 && units.length === 0 ? (
                <p className="text-sm text-gray-500">Категории не найдены.</p>
              ) : null}
            </div>
          )}

          {(unitInfo || details.length > 0) && (
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">
                {unitInfo?.name || selectedUnit?.name || 'Детали'}
              </h2>
              {unitInfo?.image_url ? (
                <img
                  src={unitInfo.image_url}
                  alt=""
                  className="mt-3 max-h-64 w-auto rounded-lg border border-gray-100"
                />
              ) : null}
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-500">
                      <th className="py-2 pr-4 font-medium">OEM</th>
                      <th className="py-2 pr-4 font-medium">Название</th>
                      <th className="py-2 font-medium">Код на схеме</th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.map((d, idx) => (
                      <tr key={`${d.oem || 'd'}-${idx}`} className="border-b border-gray-100">
                        <td className="py-2 pr-4 font-mono text-xs text-gray-900">
                          {d.oem || '—'}
                        </td>
                        <td className="py-2 pr-4 text-gray-800">{d.name || '—'}</td>
                        <td className="py-2 text-gray-600">{d.code_on_image || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {details.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-500">Нет деталей в этом узле.</p>
                ) : null}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
