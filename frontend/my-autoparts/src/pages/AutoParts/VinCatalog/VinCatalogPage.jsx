import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import SoftServiceNotice from '../../../components/SoftServiceNotice/SoftServiceNotice';
import { apiRequestUnauth } from '../../../utils/apiClient';
import {
  candidateLabel,
  softNoticeVariantFromReason,
} from '../../../utils/laximoVinCandidate';
import { looksLikeVin, normalizeVinOrNull, sanitizeVinInput, VIN_INPUT_MAX_LENGTH } from '../../../utils/laximoVin';
import { fetchPublicSiteConfig } from '../../../redux/slices/PublicInfoSlice';
import VinCatalogBrowse from './VinCatalogBrowse';

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

function normalizeOemKey(oem) {
  return String(oem || '')
    .replace(/[^A-Za-z0-9А-Яа-яЁё]/g, '')
    .toUpperCase();
}

export default function VinCatalogPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const showNewAutoparts = useSelector((state) => state.publicInfo.showNewAutoparts !== false);
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
  const [treeCategories, setTreeCategories] = useState([]);
  const [categories, setCategories] = useState([]);
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
        if (item?.normalized_oem) map[normalizeOemKey(item.normalized_oem)] = item;
        if (item?.oem) {
          map[normalizeOemKey(item.oem)] = item;
          map[String(item.oem).toUpperCase()] = item;
        }
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
    setTreeCategories([]);
    setCategories([]);
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
        const list = Array.isArray(cats?.categories) ? cats.categories : [];
        setTreeCategories(list);
        setCategories(list);
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
        setError('VIN должен содержать от 11 до 17 символов');
        setStep('boot');
        return;
      }
      // Always call API — do not gate on Redux flag (session cache can be stale
      // after admin enables Laximo; garage decode does not use this flag).
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
    []
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
    dispatch(fetchPublicSiteConfig(true));
  }, [dispatch]);

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
  }, [initialVin, openWizard]);

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
      const unit = res?.unit || null;
      setUnitInfo(unit || { name: group.name });
      setSelectedUnit(
        unit
          ? { ...unit, name: unit.name || group.name }
          : { name: group.name, unit_id: group.quick_group_id }
      );
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
        const list = Array.isArray(cats?.categories) ? cats.categories : [];
        setTreeCategories(list);
        setCategories(list);
        setUnits([]);
        setQuickGroups([]);
      } else {
        const groups = await apiRequestUnauth(`/public/laximo/quick-groups?${qs(ctx)}`);
        if (handleSoftFail(groups)) return;
        setQuickGroups(Array.isArray(groups?.quick_groups) ? groups.quick_groups : []);
        setTreeCategories([]);
        setCategories([]);
        setUnits([]);
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

  const loadUsedProducts = useCallback(async (oem) => {
    const q = (oem || '').trim();
    if (!q) return [];
    const params = new URLSearchParams({
      q,
      has_photos: 'true',
      page_size: '8',
      page: '1',
      sort: 'created_at_desc',
      is_new: 'false',
    });
    const res = await apiRequestUnauth(`/catalog/products?${params}`);
    const items = Array.isArray(res?.items)
      ? res.items
      : Array.isArray(res?.products)
        ? res.products
        : Array.isArray(res)
          ? res
          : [];
    return items.filter((p) => p?.id).slice(0, 8);
  }, []);

  return (
    <div className={`mx-auto px-3 py-6 sm:px-4 sm:py-8 ${step === 'browse' ? 'max-w-7xl' : 'max-w-4xl'}`}>
      {step !== 'browse' ? (
        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Каталог по VIN</h1>
          <Link to={fallbackSearchPath} className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
            Обычный поиск
          </Link>
        </div>
      ) : (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h1 className="text-lg font-bold text-gray-900 sm:text-xl">Каталог по VIN</h1>
          <Link to={fallbackSearchPath} className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
            Обычный поиск
          </Link>
        </div>
      )}

      {notice && step !== 'wizard' ? (
        <div className="mb-4">
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
              className="mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              Искать как обычный запрос
            </button>
          ) : null}
          {notice === 'not_found' && step === 'boot' ? (
            <button
              type="button"
              onClick={beginWizard}
              className="mt-2 block text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              Подобрать по параметрам
            </button>
          ) : null}
        </div>
      ) : null}

      {step === 'boot' && !loading && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="block w-full rounded-lg border border-gray-300 px-4 py-3 text-base shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              value={vin}
              onChange={(e) => setVin(sanitizeVinInput(e.target.value))}
              maxLength={VIN_INPUT_MAX_LENGTH}
              placeholder="VIN автомобиля"
              autoCapitalize="characters"
            />
            <button
              type="button"
              onClick={() => {
                const next = normalizeVinOrNull(vin);
                if (!next) {
                  setError('VIN должен содержать от 11 до 17 символов');
                  return;
                }
                navigate(`/autoparts/vin?vin=${encodeURIComponent(next)}`, { replace: true });
                decodeVin(next);
              }}
              className="shrink-0 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Найти
            </button>
          </div>
          {error && !notice ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
          <button
            type="button"
            onClick={beginWizard}
            className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-800"
          >
            Подобрать по параметрам
          </button>
        </div>
      )}

      {loading ? <p className="mt-6 text-sm text-gray-500">Загрузка…</p> : null}

      {step === 'wizard' && (
        <div className="mt-2 space-y-4">
          {notice ? (
            <SoftServiceNotice
              variant={notice}
              onRetry={notice === 'unavailable' ? beginWizard : undefined}
            />
          ) : null}
          <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-4 sm:p-5">
            <div>
              <label className="block text-sm font-medium text-gray-700">Марка</label>
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
        <div className="mt-2 space-y-2">
          <p className="text-sm text-gray-600">Выберите автомобиль</p>
          <ul className="space-y-2">
            {candidates.map((c, idx) => (
              <li key={`${c.vehicle_id || 'v'}-${idx}`}>
                <button
                  type="button"
                  onClick={() => startBrowse(c, { wizard: fromWizard })}
                  className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-left text-sm hover:border-indigo-300 hover:bg-indigo-50/40"
                >
                  {candidateLabel(c)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {step === 'browse' && vehicle && (
        <VinCatalogBrowse
          vehicle={vehicle}
          vin={vin}
          fromWizard={fromWizard}
          loading={loading}
          filterLoading={filterLoading}
          hasQuickgroups={hasQuickgroups}
          hasFulltext={hasFulltext}
          mode={mode}
          quickGroups={quickGroups}
          treeCategories={treeCategories}
          panelCategories={categories}
          units={units}
          selectedUnit={selectedUnit}
          unitInfo={unitInfo}
          details={details}
          availability={availability}
          searchQuery={searchQuery}
          searchLoading={searchLoading}
          searchEmpty={searchEmpty}
          filterStep={filterStep}
          error={error && !notice ? error : null}
          onSearchQueryChange={setSearchQuery}
          onRunSearch={runSearch}
          onClearSearch={clearSearch}
          onSwitchMode={switchMode}
          onOpenCategory={openCategory}
          onOpenUnit={openUnit}
          onOpenQuickGroup={openQuickGroup}
          onBeginDetailFilter={beginDetailFilter}
          onSetFilterAnswer={setFilterAnswer}
          onSubmitFilterStep={submitFilterStep}
          onCancelFilter={() => setFilterStep(null)}
          loadUsedProducts={loadUsedProducts}
        />
      )}
    </div>
  );
}
