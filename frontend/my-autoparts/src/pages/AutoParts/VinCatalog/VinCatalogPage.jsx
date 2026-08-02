import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import SoftServiceNotice from '../../../components/SoftServiceNotice/SoftServiceNotice';
import { apiRequestUnauth } from '../../../utils/apiClient';
import {
  candidateLabel,
  softNoticeVariantFromReason,
} from '../../../utils/laximoVinCandidate';
import { looksLikeVin, normalizeVinOrNull } from '../../../utils/laximoVin';

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

function formatPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n.toLocaleString('ru-RU', { maximumFractionDigits: 0 });
}

export default function VinCatalogPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const showNewAutoparts = useSelector((state) => state.publicInfo.showNewAutoparts !== false);
  const laximoAvailable = useSelector(
    (state) => state.publicInfo.laximoVinCatalogAvailable === true
  );
  const fallbackSearchPath = showNewAutoparts ? '/autoparts/new' : '/autoparts/used';

  const initialVin = useMemo(
    () => normalizeVinOrNull(searchParams.get('vin') || '') || '',
    [searchParams]
  );

  const [step, setStep] = useState('boot'); // boot | pick | browse | wizard
  const [vin, setVin] = useState(initialVin);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [vehicle, setVehicle] = useState(null);
  const [fromWizard, setFromWizard] = useState(false);

  const [mode, setMode] = useState('quick');
  const [hasQuickgroups, setHasQuickgroups] = useState(false);
  const [hasFulltext, setHasFulltext] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchEmpty, setSearchEmpty] = useState(false);
  const [quickGroups, setQuickGroups] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryStack, setCategoryStack] = useState([]);
  const [units, setUnits] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [details, setDetails] = useState([]);
  const [unitInfo, setUnitInfo] = useState(null);
  const [availability, setAvailability] = useState({});
  // filterStep: { kind, unit, filter, detail?, conditions, answers: { [idx]: string } }
  const [filterStep, setFilterStep] = useState(null);
  const [filterLoading, setFilterLoading] = useState(false);

  const [wizardCatalogs, setWizardCatalogs] = useState([]);
  const [wizardCatalog, setWizardCatalog] = useState('');
  const [wizardSsd, setWizardSsd] = useState('');
  const [wizardConditions, setWizardConditions] = useState([]);
  const [wizardCanList, setWizardCanList] = useState(false);
  const [wizardLoading, setWizardLoading] = useState(false);

  const openWizard = searchParams.get('wizard') === '1';

  const handleSoftFail = (result) => {
    if (!result || result.ok) return false;
    setNotice(softNoticeVariantFromReason(result.reason));
    setError(result.message || null);
    return true;
  };

  const updateVehicleSsd = (nextSsd) => {
    if (!nextSsd) return;
    setVehicle((prev) => (prev ? { ...prev, ssd: nextSsd } : prev));
  };

  const loadAvailability = async (detailRows) => {
    const oems = (detailRows || [])
      .map((d) => (d.oem || '').trim())
      .filter(Boolean)
      .slice(0, 40);
    if (!oems.length) {
      setAvailability({});
      return;
    }
    try {
      const res = await apiRequestUnauth('/public/laximo/oem/availability', {
        method: 'POST',
        body: JSON.stringify({ oems }),
      });
      const map = {};
      (res?.items || []).forEach((item) => {
        if (item?.normalized_oem) map[item.normalized_oem] = item;
        if (item?.oem) map[String(item.oem).toUpperCase()] = item;
      });
      setAvailability(map);
    } catch {
      setAvailability({});
    }
  };

  const startBrowse = async (cand, { wizard = false } = {}) => {
    setVehicle(cand);
    setFromWizard(wizard);
    setStep('browse');
    setQuickGroups([]);
    setCategories([]);
    setCategoryStack([]);
    setUnits([]);
    setSelectedUnit(null);
    setDetails([]);
    setUnitInfo(null);
    setAvailability({});
    setSearchQuery('');
    setSearchEmpty(false);
    setFilterStep(null);
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const ctx = vehicleCtx(cand);
      const feat = await apiRequestUnauth(
        `/public/laximo/catalog/features?${qs({ catalog: ctx.catalog })}`
      );
      if (handleSoftFail(feat)) return;
      const qg = Boolean(feat?.has_quickgroups);
      const fts = Boolean(feat?.has_fulltextsearch);
      setHasQuickgroups(qg);
      setHasFulltext(fts);
      const nextMode = qg ? 'quick' : 'oem';
      setMode(nextMode);
      if (qg) {
        const groups = await apiRequestUnauth(`/public/laximo/quick-groups?${qs(ctx)}`);
        if (handleSoftFail(groups)) return;
        setQuickGroups(Array.isArray(groups?.quick_groups) ? groups.quick_groups : []);
      } else {
        const cats = await apiRequestUnauth(
          `/public/laximo/categories?${qs({ ...ctx, category_id: '-1' })}`
        );
        if (handleSoftFail(cats)) return;
        setCategories(Array.isArray(cats?.categories) ? cats.categories : []);
      }
    } catch (err) {
      setNotice('unavailable');
      setError(err?.message || 'Не удалось открыть каталог');
    } finally {
      setLoading(false);
    }
  };

  const decodeVin = useCallback(
    async (vinValue) => {
      const normalized = normalizeVinOrNull(vinValue);
      if (!normalized) {
        setError('VIN должен содержать 17 символов');
        setStep('boot');
        return;
      }
      if (!laximoAvailable) {
        setVin(normalized);
        setNotice('unavailable');
        setStep('boot');
        return;
      }
      setVin(normalized);
      setFromWizard(false);
      setLoading(true);
      setNotice(null);
      setError(null);
      try {
        const result = await apiRequestUnauth('/public/laximo/vehicles/by-vin', {
          method: 'POST',
          body: JSON.stringify({ vin: normalized }),
        });
        const list = Array.isArray(result?.candidates) ? result.candidates : [];
        if (result?.ok && list.length === 1) {
          await startBrowse(list[0]);
          return;
        }
        if (result?.ok && list.length > 1) {
          setCandidates(list);
          setFromWizard(false);
          setStep('pick');
          return;
        }
        setNotice(softNoticeVariantFromReason(result?.reason));
        setError(result?.message || null);
        setStep('boot');
      } catch (err) {
        setNotice('unavailable');
        setError(err?.message || 'Не удалось распознать VIN');
        setStep('boot');
      } finally {
        setLoading(false);
      }
    },
    [laximoAvailable]
  );

  const beginWizard = async () => {
    setStep('wizard');
    setNotice(null);
    setError(null);
    setCandidates([]);
    setWizardCatalog('');
    setWizardSsd('');
    setWizardConditions([]);
    setWizardCanList(false);
    setWizardLoading(true);
    try {
      const res = await apiRequestUnauth('/public/laximo/wizard/catalogs');
      if (handleSoftFail(res)) {
        setStep('boot');
        return;
      }
      const list = Array.isArray(res?.catalogs) ? res.catalogs : [];
      setWizardCatalogs(list);
      if (!list.length) {
        setError('Подбор по параметрам сейчас недоступен');
      }
    } catch (err) {
      setNotice('unavailable');
      setError(err?.message || 'Не удалось открыть подбор');
      setStep('boot');
    } finally {
      setWizardLoading(false);
    }
  };

  const loadWizardStep = async (catalog, ssd = '') => {
    if (!catalog) return;
    setWizardLoading(true);
    setNotice(null);
    setError(null);
    try {
      const res = await apiRequestUnauth('/public/laximo/wizard/step', {
        method: 'POST',
        body: JSON.stringify({ catalog, ssd: ssd || '' }),
      });
      if (handleSoftFail(res)) return;
      setWizardCatalog(catalog);
      setWizardSsd(res?.ssd || ssd || '');
      setWizardConditions(Array.isArray(res?.conditions) ? res.conditions : []);
      setWizardCanList(Boolean(res?.can_list_vehicles));
    } catch (err) {
      setNotice('unavailable');
      setError(err?.message || 'Не удалось загрузить параметры');
    } finally {
      setWizardLoading(false);
    }
  };

  const chooseWizardOption = async (optionKey) => {
    if (!wizardCatalog || !optionKey) return;
    await loadWizardStep(wizardCatalog, optionKey);
  };

  const listWizardVehicles = async () => {
    if (!wizardCatalog || !wizardSsd) {
      setError('Сначала выберите параметры автомобиля');
      return;
    }
    setWizardLoading(true);
    setNotice(null);
    setError(null);
    try {
      const res = await apiRequestUnauth('/public/laximo/wizard/vehicles', {
        method: 'POST',
        body: JSON.stringify({ catalog: wizardCatalog, ssd: wizardSsd }),
      });
      if (handleSoftFail(res)) return;
      const list = Array.isArray(res?.candidates) ? res.candidates : [];
      if (!list.length) {
        setNotice('not_found');
        setError(res?.message || 'Автомобиль не найден');
        return;
      }
      if (list.length === 1) {
        await startBrowse(list[0], { wizard: true });
        return;
      }
      setCandidates(list);
      setFromWizard(true);
      setStep('pick');
    } catch (err) {
      setNotice('unavailable');
      setError(err?.message || 'Не удалось подобрать автомобиль');
    } finally {
      setWizardLoading(false);
    }
  };

  useEffect(() => {
    if (openWizard && !initialVin) {
      beginWizard();
      return;
    }
    if (initialVin && looksLikeVin(initialVin)) {
      decodeVin(initialVin);
    } else if (!openWizard) {
      setStep('boot');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialVin, laximoAvailable, openWizard]);

  const openCategory = async (cat) => {
    if (!vehicle || !cat?.category_id) return;
    const ctx = vehicleCtx(vehicle);
    const ssd = cat.ssd || ctx.ssd;
    setLoading(true);
    setNotice(null);
    setError(null);
    setSelectedUnit(null);
    setDetails([]);
    setUnitInfo(null);
    setAvailability({});
    try {
      if (cat.has_children) {
        const cats = await apiRequestUnauth(
          `/public/laximo/categories?${qs({
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
        const unitsRes = await apiRequestUnauth(
          `/public/laximo/units?${qs({
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
      setNotice('unavailable');
      setError(err?.message || 'Не удалось открыть категорию');
    } finally {
      setLoading(false);
    }
  };

  const openUnit = async (unit, ssdOverride) => {
    if (!vehicle || !unit?.unit_id) return;
    const filterCode = unit.filter != null && String(unit.filter).trim()
      ? String(unit.filter).trim()
      : '';
    if (filterCode && !ssdOverride) {
      await beginUnitFilter(unit, filterCode);
      return;
    }
    const ctx = vehicleCtx(vehicle);
    const ssd = ssdOverride || unit.ssd || ctx.ssd;
    setLoading(true);
    setNotice(null);
    setError(null);
    setFilterStep(null);
    setSelectedUnit(unit);
    try {
      const res = await apiRequestUnauth(
        `/public/laximo/units/${encodeURIComponent(unit.unit_id)}?${qs({
          catalog: ctx.catalog,
          vehicle_id: ctx.vehicle_id,
          ssd,
        })}`
      );
      if (handleSoftFail(res)) return;
      const detailRows = Array.isArray(res?.details) ? res.details : [];
      setUnitInfo(res?.unit || null);
      setDetails(detailRows);
      await loadAvailability(detailRows);
    } catch (err) {
      setNotice('unavailable');
      setError(err?.message || 'Не удалось загрузить детали');
    } finally {
      setLoading(false);
    }
  };

  const beginUnitFilter = async (unit, filterCode) => {
    if (!vehicle) return;
    const ctx = vehicleCtx(vehicle);
    const ssd = unit.ssd || ctx.ssd;
    setFilterLoading(true);
    setNotice(null);
    setError(null);
    try {
      const res = await apiRequestUnauth('/public/laximo/filters/by-unit', {
        method: 'POST',
        body: JSON.stringify({
          catalog: ctx.catalog,
          vehicle_id: ctx.vehicle_id,
          ssd,
          unit_id: unit.unit_id,
          filter: filterCode,
        }),
      });
      if (handleSoftFail(res)) return;
      const conditions = Array.isArray(res?.conditions) ? res.conditions : [];
      if (!conditions.length) {
        setError('Не удалось уточнить комплектацию');
        return;
      }
      setFilterStep({
        kind: 'unit',
        unit,
        filter: filterCode,
        conditions,
        answers: {},
        baseSsd: ssd,
      });
    } catch (err) {
      setNotice('unavailable');
      setError(err?.message || 'Не удалось уточнить комплектацию');
    } finally {
      setFilterLoading(false);
    }
  };

  const beginDetailFilter = async (detail) => {
    if (!vehicle || !selectedUnit?.unit_id) return;
    const filterCode = detail?.filter != null && String(detail.filter).trim()
      ? String(detail.filter).trim()
      : '';
    if (!filterCode) return;
    const detailId = detail.detail_id || detail.oem;
    if (!detailId) return;
    const ctx = vehicleCtx(vehicle);
    const ssd = selectedUnit.ssd || unitInfo?.ssd || ctx.ssd;
    setFilterLoading(true);
    setNotice(null);
    setError(null);
    try {
      const res = await apiRequestUnauth('/public/laximo/filters/by-detail', {
        method: 'POST',
        body: JSON.stringify({
          catalog: ctx.catalog,
          vehicle_id: ctx.vehicle_id,
          ssd,
          unit_id: selectedUnit.unit_id,
          detail_id: detailId,
          filter: filterCode,
        }),
      });
      if (handleSoftFail(res)) return;
      const conditions = Array.isArray(res?.conditions) ? res.conditions : [];
      if (!conditions.length) {
        setError('Не удалось уточнить комплектацию');
        return;
      }
      setFilterStep({
        kind: 'detail',
        unit: selectedUnit,
        detail,
        filter: filterCode,
        conditions,
        answers: {},
        baseSsd: ssd,
      });
    } catch (err) {
      setNotice('unavailable');
      setError(err?.message || 'Не удалось уточнить комплектацию');
    } finally {
      setFilterLoading(false);
    }
  };

  const setFilterAnswer = (condIdx, value) => {
    setFilterStep((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        answers: { ...prev.answers, [condIdx]: value },
      };
    });
  };

  const submitFilterStep = async () => {
    if (!filterStep || !vehicle) return;
    const { conditions, answers, baseSsd, unit, kind } = filterStep;
    let ssd = baseSsd;
    setFilterLoading(true);
    setNotice(null);
    setError(null);
    try {
      for (let i = 0; i < conditions.length; i += 1) {
        const cond = conditions[i];
        const answer = answers[i];
        if (answer == null || String(answer).trim() === '') {
          setError('Ответьте на все вопросы комплектации');
          setFilterLoading(false);
          return;
        }
        let ssdModification = '';
        let value = null;
        if (cond.type === 'input') {
          ssdModification = cond.ssd_modification || '';
          value = String(answer).trim();
        } else {
          const values = Array.isArray(cond.values) ? cond.values : [];
          const picked = values.find(
            (v) => (v.ssd_modification || v.name) === answer
          ) || values.find((v) => v.name === answer);
          ssdModification = picked?.ssd_modification || String(answer);
        }
        if (!ssdModification) {
          setError('Не удалось уточнить комплектацию');
          setFilterLoading(false);
          return;
        }
        const body = { ssd, ssd_modification: ssdModification };
        if (value != null) body.value = value;
        const res = await apiRequestUnauth('/public/laximo/filters/apply', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        if (handleSoftFail(res)) {
          setFilterLoading(false);
          return;
        }
        if (!res?.ssd) {
          setError('Не удалось уточнить комплектацию');
          setFilterLoading(false);
          return;
        }
        ssd = res.ssd;
      }
      updateVehicleSsd(ssd);
      setFilterStep(null);
      const unitForOpen = unit
        ? { ...unit, filter: null, ssd }
        : selectedUnit
          ? { ...selectedUnit, filter: null, ssd }
          : null;
      if (unitForOpen?.unit_id) {
        await openUnit(unitForOpen, ssd);
      }
      void kind;
    } catch (err) {
      setNotice('unavailable');
      setError(err?.message || 'Не удалось уточнить комплектацию');
    } finally {
      setFilterLoading(false);
    }
  };

  const openQuickGroup = async (group) => {
    if (!vehicle || !group?.quick_group_id) return;
    if (group.link === false) {
      setError('Это группа-контейнер. Выберите вложенный раздел.');
      return;
    }
    const ctx = vehicleCtx(vehicle);
    const ssd = group.ssd || ctx.ssd;
    setLoading(true);
    setNotice(null);
    setError(null);
    setSelectedUnit({ name: group.name, unit_id: group.quick_group_id });
    setUnitInfo({ name: group.name });
    try {
      const res = await apiRequestUnauth(
        `/public/laximo/quick-groups/${encodeURIComponent(group.quick_group_id)}/details?${qs({
          catalog: ctx.catalog,
          vehicle_id: ctx.vehicle_id,
          ssd,
        })}`
      );
      if (handleSoftFail(res)) return;
      const detailRows = Array.isArray(res?.details) ? res.details : [];
      setDetails(detailRows);
      await loadAvailability(detailRows);
    } catch (err) {
      setNotice('unavailable');
      setError(err?.message || 'Не удалось загрузить группу');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = async (next) => {
    if (!vehicle || next === mode) return;
    setMode(next);
    setSelectedUnit(null);
    setDetails([]);
    setUnitInfo(null);
    setAvailability({});
    setSearchEmpty(false);
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const ctx = vehicleCtx(vehicle);
      if (next === 'oem') {
        const cats = await apiRequestUnauth(
          `/public/laximo/categories?${qs({ ...ctx, category_id: '-1' })}`
        );
        if (handleSoftFail(cats)) return;
        setCategories(Array.isArray(cats?.categories) ? cats.categories : []);
        setCategoryStack([]);
        setUnits([]);
        setQuickGroups([]);
      } else {
        const groups = await apiRequestUnauth(`/public/laximo/quick-groups?${qs(ctx)}`);
        if (handleSoftFail(groups)) return;
        setQuickGroups(Array.isArray(groups?.quick_groups) ? groups.quick_groups : []);
        setCategories([]);
        setUnits([]);
        setCategoryStack([]);
      }
    } catch (err) {
      setNotice('unavailable');
      setError(err?.message || 'Не удалось переключить каталог');
    } finally {
      setLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchEmpty(false);
    setDetails([]);
    setUnitInfo(null);
    setSelectedUnit(null);
    setAvailability({});
    setError(null);
    setNotice(null);
    const next = hasQuickgroups ? 'quick' : 'oem';
    setMode(next);
  };

  const runSearch = async () => {
    if (!vehicle) return;
    const q = searchQuery.trim();
    if (q.length < 2) {
      setError('Введите хотя бы 2 символа');
      return;
    }
    const ctx = vehicleCtx(vehicle);
    setSearchLoading(true);
    setError(null);
    setNotice(null);
    setSearchEmpty(false);
    setSelectedUnit(null);
    setUnitInfo({ name: `Поиск: ${q}` });
    setMode('search');
    try {
      const res = await apiRequestUnauth('/public/laximo/details/search', {
        method: 'POST',
        body: JSON.stringify({
          catalog: ctx.catalog,
          vehicle_id: ctx.vehicle_id,
          ssd: ctx.ssd,
          query: q,
        }),
      });
      if (handleSoftFail(res)) {
        setDetails([]);
        setAvailability({});
        return;
      }
      const detailRows = Array.isArray(res?.details) ? res.details : [];
      setDetails(detailRows);
      setSearchEmpty(detailRows.length === 0);
      await loadAvailability(detailRows);
    } catch (err) {
      setNotice('unavailable');
      setError(err?.message || 'Не удалось выполнить поиск');
      setDetails([]);
      setAvailability({});
    } finally {
      setSearchLoading(false);
    }
  };

  const goFallbackSearch = () => {
    const q = vin || initialVin;
    navigate(`${fallbackSearchPath}?q=${encodeURIComponent(q || '')}`);
  };

  const availFor = (oem) => {
    if (!oem) return null;
    const key = String(oem).replace(/[^A-Za-z0-9А-Яа-яЁё]/g, '').toUpperCase();
    return availability[key] || availability[String(oem).toUpperCase()] || null;
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Каталог по VIN</h1>
          <p className="mt-1 text-sm text-gray-500">
            Узлы и OEM-номера. Наличие новых и б/у — отдельно по каждой детали.
          </p>
        </div>
        <Link to={fallbackSearchPath} className="text-sm font-medium text-indigo-600 hover:underline">
          Обычный поиск
        </Link>
      </div>

      {notice && step !== 'wizard' ? (
        <div className="mt-4">
          <SoftServiceNotice
            variant={notice}
            onRetry={
              notice === 'unavailable' || notice === 'not_found'
                ? () => (vin ? decodeVin(vin) : navigate('/'))
                : undefined
            }
          />
          {notice === 'unavailable' ? (
            <button
              type="button"
              onClick={goFallbackSearch}
              className="mt-3 text-sm font-medium text-indigo-600 hover:underline"
            >
              Искать VIN как обычный запрос
            </button>
          ) : null}
          {notice === 'not_found' && step === 'boot' ? (
            <button
              type="button"
              onClick={beginWizard}
              className="mt-3 block text-sm font-medium text-indigo-600 hover:underline"
            >
              Подобрать по параметрам
            </button>
          ) : null}
        </div>
      ) : null}

      {step === 'boot' && !loading && (
        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <label className="block text-sm font-medium text-gray-700">VIN</label>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row">
            <input
              className={inputClass}
              value={vin}
              onChange={(e) => setVin(e.target.value.toUpperCase())}
              maxLength={17}
              placeholder="17 символов"
            />
            <button
              type="button"
              onClick={() => {
                const next = normalizeVinOrNull(vin);
                if (!next) {
                  setError('VIN должен содержать 17 символов');
                  return;
                }
                navigate(`/autoparts/vin?vin=${encodeURIComponent(next)}`, { replace: true });
                decodeVin(next);
              }}
              className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Найти
            </button>
          </div>
          {error && !notice ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        </div>
      )}

      {loading ? <p className="mt-6 text-sm text-gray-500">Загрузка…</p> : null}

      {step === 'wizard' && (
        <div className="mt-6 space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Подбор по параметрам — точность ниже, чем по VIN. Результат не сохраняется в гараж.
          </div>
          {notice ? (
            <SoftServiceNotice
              variant={notice}
              onRetry={notice === 'unavailable' ? beginWizard : undefined}
            />
          ) : null}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Каталог / марка</label>
              <select
                className={inputClass}
                value={wizardCatalog}
                disabled={wizardLoading || !wizardCatalogs.length}
                onChange={(e) => {
                  const code = e.target.value;
                  setWizardCatalog(code);
                  setWizardSsd('');
                  setWizardConditions([]);
                  setWizardCanList(false);
                  if (code) loadWizardStep(code, '');
                }}
              >
                <option value="">Выберите каталог</option>
                {wizardCatalogs.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.brand || c.name || c.code}
                    {c.name && c.brand ? ` — ${c.name}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {wizardConditions
              .filter((cond) => !cond.determined && Array.isArray(cond.options) && cond.options.length)
              .map((cond, idx) => (
                <div key={cond.condition_id || `cond-${idx}`}>
                  <label className="block text-sm font-medium text-gray-700">
                    {cond.name || 'Параметр'}
                  </label>
                  <select
                    key={`${wizardSsd || 'root'}-${cond.condition_id || idx}`}
                    className={inputClass}
                    defaultValue=""
                    disabled={wizardLoading}
                    onChange={(e) => {
                      const key = e.target.value;
                      if (key) chooseWizardOption(key);
                    }}
                  >
                    <option value="">Выберите…</option>
                    {cond.options.map((opt, oi) => (
                      <option key={opt.key || `opt-${oi}`} value={opt.key || ''}>
                        {opt.value || opt.key}
                      </option>
                    ))}
                  </select>
                </div>
              ))}

            {wizardConditions.some((c) => c.determined && c.value) ? (
              <ul className="text-sm text-gray-600 space-y-1">
                {wizardConditions
                  .filter((c) => c.determined && c.value)
                  .map((c, i) => (
                    <li key={c.condition_id || `det-${i}`}>
                      <span className="text-gray-500">{c.name || 'Параметр'}:</span> {c.value}
                      {c.ssd ? (
                        <button
                          type="button"
                          className="ml-2 text-indigo-600 hover:underline"
                          disabled={wizardLoading}
                          onClick={() => loadWizardStep(wizardCatalog, c.ssd)}
                        >
                          Изменить
                        </button>
                      ) : null}
                    </li>
                  ))}
              </ul>
            ) : null}

            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {wizardLoading ? <p className="text-sm text-gray-500">Загрузка…</p> : null}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setStep('boot');
                  setNotice(null);
                  setError(null);
                  navigate('/autoparts/vin', { replace: true });
                }}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Назад к VIN
              </button>
              <button
                type="button"
                onClick={listWizardVehicles}
                disabled={wizardLoading || !wizardCanList || !wizardSsd}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                Показать автомобили
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'pick' && (
        <div className="mt-6 space-y-3">
          {fromWizard ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Подбор по параметрам — точность ниже, чем по VIN.
            </div>
          ) : null}
          <p className="text-sm text-gray-600">Найдено несколько автомобилей. Выберите вариант.</p>
          <ul className="space-y-2">
            {candidates.map((c, idx) => (
              <li key={`${c.vehicle_id || 'v'}-${idx}`}>
                <button
                  type="button"
                  onClick={() => startBrowse(c, { wizard: fromWizard })}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm hover:border-indigo-300 hover:bg-indigo-50/40"
                >
                  {candidateLabel(c)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {step === 'browse' && vehicle && (
        <div className="mt-6 space-y-4">
          {fromWizard ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Подбор по параметрам — точность ниже, чем по VIN. Автомобиль не сохраняется в гараж.
            </div>
          ) : null}
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-sm font-semibold text-gray-900">
              {candidateLabel(vehicle) || vehicle.display_name || 'Автомобиль'}
            </p>
            {vin && !fromWizard ? <p className="mt-0.5 text-xs text-gray-500">VIN: {vin}</p> : null}
          </div>

          {hasFulltext ? (
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
              <label className="block text-sm font-medium text-gray-700">Найти деталь</label>
              <p className="mt-0.5 text-xs text-gray-500">
                Поиск по названию внутри этого автомобиля (например, «колодки», «фильтр»).
              </p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  className={inputClass}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      runSearch();
                    }
                  }}
                  placeholder="Название детали"
                  disabled={searchLoading || loading}
                />
                <button
                  type="button"
                  onClick={runSearch}
                  disabled={searchLoading || loading}
                  className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {searchLoading ? 'Поиск…' : 'Найти'}
                </button>
                {mode === 'search' ? (
                  <button
                    type="button"
                    onClick={clearSearch}
                    disabled={searchLoading || loading}
                    className="shrink-0 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    К каталогу
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {filterStep ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/40 px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-900">Уточните комплектацию</h3>
              <p className="mt-0.5 text-xs text-gray-500">
                Для этого узла нужны дополнительные параметры автомобиля.
              </p>
              <div className="mt-3 space-y-3">
                {filterStep.conditions.map((cond, idx) => {
                  const isInput = cond.type === 'input';
                  const values = Array.isArray(cond.values) ? cond.values : [];
                  return (
                    <div key={`${cond.name || 'c'}-${idx}`}>
                      <label className="block text-sm font-medium text-gray-700">
                        {cond.name || `Параметр ${idx + 1}`}
                      </label>
                      {isInput ? (
                        <input
                          className={inputClass}
                          value={filterStep.answers[idx] || ''}
                          onChange={(e) => setFilterAnswer(idx, e.target.value)}
                          placeholder={cond.regexp ? `Формат: ${cond.regexp}` : 'Значение'}
                          disabled={filterLoading || loading}
                        />
                      ) : (
                        <select
                          className={inputClass}
                          value={filterStep.answers[idx] || ''}
                          onChange={(e) => setFilterAnswer(idx, e.target.value)}
                          disabled={filterLoading || loading}
                        >
                          <option value="">Выберите…</option>
                          {values.map((v, vIdx) => {
                            const optVal = v.ssd_modification || v.name || '';
                            return (
                              <option key={`${optVal}-${vIdx}`} value={optVal}>
                                {v.name || v.note || `Вариант ${vIdx + 1}`}
                              </option>
                            );
                          })}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={submitFilterStep}
                  disabled={filterLoading || loading}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {filterLoading ? 'Применение…' : 'Применить'}
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStep(null)}
                  disabled={filterLoading || loading}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : null}

          {hasQuickgroups && mode !== 'search' ? (
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

          {error && !notice ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
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
                  </button>
                </li>
              ))}
            </ul>
          )}

          {mode === 'oem' && (
            <div className="space-y-3">
              {categoryStack.length > 0 ? (
                <p className="text-xs text-gray-500">
                  {categoryStack.map((c) => c.name || c.id).join(' / ')}
                </p>
              ) : null}
              <ul className="space-y-2">
                {categories.map((c, idx) => (
                  <li key={`${c.category_id || 'c'}-${idx}`}>
                    <button
                      type="button"
                      onClick={() => openCategory(c)}
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm hover:border-indigo-300 hover:bg-indigo-50/40"
                    >
                      {c.name || c.category_id}
                    </button>
                  </li>
                ))}
                {units.map((u, idx) => (
                  <li key={`${u.unit_id || 'u'}-${idx}`}>
                    <button
                      type="button"
                      onClick={() => openUnit(u)}
                      disabled={loading || filterLoading}
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm hover:border-indigo-300 hover:bg-indigo-50/40 disabled:opacity-60"
                    >
                      <span>{u.name || u.unit_id}</span>
                      {u.filter ? (
                        <span className="mt-0.5 block text-xs text-amber-700">
                          Требуется уточнение комплектации
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(mode === 'search' || unitInfo || details.length > 0) && (
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900">
                {unitInfo?.name || selectedUnit?.name || (mode === 'search' ? 'Результаты поиска' : 'Детали')}
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
                      <th className="py-2 pr-3 font-medium">OEM</th>
                      <th className="py-2 pr-3 font-medium">Название</th>
                      <th className="py-2 pr-3 font-medium">Оригинал</th>
                      <th className="py-2 pr-3 font-medium">Аналоги</th>
                      <th className="py-2 font-medium">Б/у</th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.map((d, idx) => {
                      const av = availFor(d.oem);
                      const rossko = av?.rossko;
                      const used = av?.used;
                      const analogs = av?.analogs;
                      const price = formatPrice(rossko?.min_price);
                      const analogItems = Array.isArray(analogs?.items) ? analogs.items : [];
                      const noStock =
                        !rossko?.available && !used?.available && !analogs?.available;
                      return (
                        <tr key={`${d.oem || 'd'}-${idx}`} className="border-b border-gray-100 align-top">
                          <td className="py-2 pr-3 font-mono text-xs text-gray-900">
                            {d.oem || '—'}
                          </td>
                          <td className="py-2 pr-3 text-gray-800">
                            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
                              <span>{d.name || '—'}</span>
                              {d.filter ? (
                                <button
                                  type="button"
                                  onClick={() => beginDetailFilter(d)}
                                  disabled={filterLoading || loading || !selectedUnit?.unit_id}
                                  className="w-fit text-xs font-medium text-indigo-600 hover:underline disabled:opacity-50"
                                >
                                  Уточнить
                                </button>
                              ) : null}
                            </div>
                          </td>
                          <td className="py-2 pr-3 text-gray-700">
                            {rossko?.available ? (
                              <Link
                                to={`/autoparts/new?q=${encodeURIComponent(d.oem || '')}`}
                                className="text-indigo-600 hover:underline"
                              >
                                {price ? `от ${price} ₽` : 'есть'}
                              </Link>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-2 pr-3 text-gray-700">
                            {analogs?.available && analogItems.length > 0 ? (
                              <div className="space-y-1">
                                <span className="text-xs text-gray-500">
                                  {analogs.count > 1 ? `${analogs.count} шт.` : 'есть'}
                                </span>
                                <ul className="space-y-0.5">
                                  {analogItems.slice(0, 3).map((item, aIdx) => {
                                    const q = item.oem || '';
                                    const hasNew = item.rossko?.available;
                                    const hasUsed = item.used?.available;
                                    const href = hasNew
                                      ? `/autoparts/new?q=${encodeURIComponent(q)}`
                                      : hasUsed
                                        ? `/autoparts/used?q=${encodeURIComponent(q)}`
                                        : `/autoparts/new?q=${encodeURIComponent(q)}`;
                                    return (
                                      <li key={`${q}-${aIdx}`}>
                                        <Link
                                          to={href}
                                          className="font-mono text-xs text-indigo-600 hover:underline"
                                          title={item.name || item.brand || q}
                                        >
                                          {item.brand ? `${item.brand} ` : ''}
                                          {q}
                                        </Link>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="py-2 text-gray-700">
                            {used?.available ? (
                              <Link
                                to={`/autoparts/used?q=${encodeURIComponent(d.oem || '')}`}
                                className="text-indigo-600 hover:underline"
                              >
                                {used.count > 1 ? `${used.count} шт.` : 'есть'}
                              </Link>
                            ) : noStock ? (
                              <span className="text-gray-400">нет в наличии</span>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {details.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-500">
                    {mode === 'search' || searchEmpty
                      ? 'Ничего не найдено.'
                      : 'Нет деталей в этом узле.'}
                  </p>
                ) : null}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
