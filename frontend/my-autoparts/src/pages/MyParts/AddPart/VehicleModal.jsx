import { useDispatch, useSelector } from 'react-redux';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchVehicles,
  createVehicle,
  updateVehicle,
  fetchVehicleCatalogManufacturers,
  fetchVehicleCatalogModels,
  fetchVehicleCatalogPassengercars,
  fetchVehicleCatalogEngines,
  fetchReferenceTransmissions,
} from '../../../redux/slices/ProductSlice';
import { apiRequestFormData, normalizeImageUrl } from '../../../utils/apiClient';

const MAX_VEHICLE_PHOTOS = 10;

/** Единый вид подписей и полей ввода в модалке автомобиля */
const FIELD_LABEL = 'block text-sm font-medium text-gray-700 mb-1';
const FIELD_BASE =
  'block w-full px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-md shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed';
const FIELD_TEXTAREA = `${FIELD_BASE} resize-y min-h-[96px]`;
const FIELD_FILE =
  'block w-full cursor-pointer text-sm text-gray-900 border border-gray-300 rounded-md bg-white px-3 py-2 shadow-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-800 hover:file:bg-indigo-50 focus-within:outline-none focus-within:ring-2 focus-within:ring-indigo-500/40 focus-within:border-indigo-500';
const SUGGEST_LIST =
  'mt-1 max-h-40 overflow-y-auto rounded-md border border-gray-300 bg-white text-sm text-gray-900 shadow-sm';
const SUGGEST_ITEM =
  'w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-indigo-50 focus:bg-indigo-50 focus:outline-none';
const FORM_CARD = 'p-4 bg-gray-50 rounded-lg border border-gray-200/80';

/** Подсказки только внутри полей (placeholder), не под полями */
const PLH = {
  brand: 'Начните вводить или выберите из списка',
  model: 'Начните вводить или выберите из списка',
  modelManual: 'Введите модель',
  generation: 'Начните вводить или выберите из списка',
  generationManual: 'Введите поколение',
  engine: 'Начните вводить или выберите из списка',
  engineManual: 'Например, 2.0 TDI',
  vin: '17 символов',
  mileage: 'Например, 85000',
  price: 'Необязательно',
  description: 'Комплектация, замечания по кузову…',
};

const normCatalogQ = (q) => (q || '').trim().toLowerCase();

const filterManufacturersByInput = (rows, brandInput) => {
  const nq = normCatalogQ(brandInput);
  if (!nq) return rows || [];
  return (rows || []).filter((m) => {
    const d = (m.description || '').toLowerCase();
    const c = (m.matchcode || '').toLowerCase();
    return d.includes(nq) || c.includes(nq);
  });
};

const modelOptionLabel = (m) =>
  m.description || [m.from_year, m.to_year].filter(Boolean).join('–') || String(m.id);

const filterModelsByInput = (rows, query) => {
  const nq = normCatalogQ(query);
  if (!nq) return rows || [];
  return (rows || []).filter((m) => modelOptionLabel(m).toLowerCase().includes(nq));
};

const pcOptionLabel = (p) => p.full_description || p.description || String(p.id);

const filterPcByInput = (rows, query) => {
  const nq = normCatalogQ(query);
  if (!nq) return rows || [];
  return (rows || []).filter((p) => pcOptionLabel(p).toLowerCase().includes(nq));
};

const engineOptionLabel = (en) =>
  en.sales_description || en.description || String(en.id);

const filterEnginesByInput = (rows, query) => {
  const nq = normCatalogQ(query);
  if (!nq) return rows || [];
  return (rows || []).filter((e) => engineOptionLabel(e).toLowerCase().includes(nq));
};

const emptyCreate = () => ({
  catalogManufacturerId: null,
  catalogModelId: null,
  catalogPassengercarId: null,
  catalogEngineId: null,
  referenceTransmissionId: null,
  brandInput: '',
  modelInput: '',
  generationInput: '',
  engineText: '',
  transmissionText: '',
  vin: '',
  mileage: '',
  price: '',
  description: '',
  vehiclePhotos: [],
  manufacturerOptions: [],
  modelOptions: [],
  pcOptions: [],
  engineOptions: [],
});

const emptyDetailEdit = () => ({
  ...emptyCreate(),
  vin: '',
  mileage: '',
  price: '',
});

const vehicleToDetailEditSyncPart = (v) => ({
  catalogManufacturerId: v?.tecdoc_manufacturer_id ?? null,
  catalogModelId: v?.tecdoc_model_id ?? null,
  catalogPassengercarId: v?.tecdoc_passengercar_id ?? null,
  catalogEngineId: v?.tecdoc_engine_id ?? null,
  referenceTransmissionId: v?.transmission_id ?? null,
  brandInput: v?.brand || '',
  modelInput: v?.model || '',
  generationInput: v?.generation || '',
  engineText: v?.engine || '',
  transmissionText: v?.transmission || '',
  vin: v?.vin || '',
  mileage: v?.mileage != null && v?.mileage !== '' ? String(v.mileage) : '',
  price:
    v?.price != null && v?.price !== ''
      ? String(v.price).replace('.', ',')
      : '',
  description: v?.description ?? '',
  manufacturerOptions: [],
  modelOptions: [],
  pcOptions: [],
  engineOptions: [],
  vehiclePhotos: [],
});

const buildUpdatePayloadFromDraft = (draft, referenceTransmissionTypes = []) => {
  const usingManufacturerCatalog = draft.catalogManufacturerId != null;

  let modelVal = draft.modelInput.trim();
  if (usingManufacturerCatalog && draft.catalogModelId) {
    const mo = draft.modelOptions.find((m) => m.id === draft.catalogModelId);
    modelVal = (mo && (mo.description || '')) || modelVal;
  }

  let generationVal = draft.generationInput.trim();
  if (usingManufacturerCatalog && draft.catalogPassengercarId) {
    const pc = draft.pcOptions.find((p) => p.id === draft.catalogPassengercarId);
    generationVal =
      (pc && (pc.full_description || pc.description || '')) || generationVal;
  }

  let engineVal = (draft.engineText || '').trim();
  if (draft.catalogEngineId) {
    const en = draft.engineOptions.find((x) => x.id === draft.catalogEngineId);
    engineVal = (en && (en.sales_description || en.description || '')) || engineVal;
  }

  let transmissionVal = (draft.transmissionText || '').trim();
  if (draft.referenceTransmissionId != null && Array.isArray(referenceTransmissionTypes)) {
    const row = referenceTransmissionTypes.find((t) => t.id === draft.referenceTransmissionId);
    if (row?.name) transmissionVal = row.name;
  }

  const mileageStr = String(draft.mileage ?? '').trim();
  let mileage = null;
  if (mileageStr !== '') {
    const n = parseInt(mileageStr, 10);
    if (!Number.isNaN(n)) mileage = n;
  }

  const priceRaw = String(draft.price || '').trim().replace(',', '.');
  let price = null;
  if (priceRaw !== '') {
    const n = parseFloat(priceRaw);
    if (!Number.isNaN(n)) price = n;
  }

  const vinRaw = draft.vin.trim();
  const vinVal = vinRaw ? vinRaw.toUpperCase() : '';
  const descTrim = (draft.description || '').trim();

  return {
    brand: draft.brandInput.trim(),
    model: modelVal,
    generation: generationVal || null,
    engine: engineVal || null,
    transmission: transmissionVal || null,
    description: descTrim === '' ? null : descTrim,
    vin: vinVal || null,
    mileage: mileageStr === '' ? null : mileage,
    price,
    tecdoc_manufacturer_id: draft.catalogManufacturerId,
    tecdoc_model_id: usingManufacturerCatalog ? draft.catalogModelId : null,
    tecdoc_passengercar_id: usingManufacturerCatalog ? draft.catalogPassengercarId : null,
    tecdoc_engine_id: draft.catalogEngineId || null,
    tecdoc_transmission_json:
      draft.referenceTransmissionId != null ? null : undefined,
    transmission_id: draft.referenceTransmissionId ?? null,
  };
};

const serializeUpdatePayload = (draft, referenceTransmissionTypes = []) => {
  const p = buildUpdatePayloadFromDraft(draft, referenceTransmissionTypes);
  return JSON.stringify(p);
};

async function hydrateDetailCatalogForVehicle(dispatch, v) {
  const sync = vehicleToDetailEditSyncPart(v);
  let modelOptions = [];
  let pcOptions = [];
  let engineOptions = [];
  if (v.tecdoc_manufacturer_id) {
    try {
      modelOptions = await dispatch(
        fetchVehicleCatalogModels(v.tecdoc_manufacturer_id)
      ).unwrap();
    } catch {
      modelOptions = [];
    }
  }
  if (v.tecdoc_model_id) {
    try {
      pcOptions = await dispatch(
        fetchVehicleCatalogPassengercars(v.tecdoc_model_id)
      ).unwrap();
    } catch {
      pcOptions = [];
    }
  }
  if (v.tecdoc_passengercar_id) {
    try {
      engineOptions = await dispatch(
        fetchVehicleCatalogEngines(v.tecdoc_passengercar_id)
      ).unwrap();
    } catch {
      engineOptions = [];
    }
  }
  return {
    ...sync,
    modelOptions,
    pcOptions,
    engineOptions,
  };
}

const VehicleModal = ({
  isOpen,
  onClose,
  onSelectVehicle,
  selectedVehicle: selectedVehicleProp = null,
  stockInVehicleModal = false,
}) => {
  const dispatch = useDispatch();
  const { vehicles, vehiclesLoading } = useSelector((state) => state.products);

  const [mode, setMode] = useState('select');
  const [detailVehicle, setDetailVehicle] = useState(null);
  const [create, setCreate] = useState(emptyCreate);
  const [childLoading, setChildLoading] = useState(false);
  const [detailEdit, setDetailEdit] = useState(emptyDetailEdit);
  const [detailBaselinePayload, setDetailBaselinePayload] = useState('');
  const [detailSaveLoading, setDetailSaveLoading] = useState(false);
  const [referenceTransmissionTypes, setReferenceTransmissionTypes] = useState([]);
  const referenceTransmissionTypesRef = useRef([]);
  referenceTransmissionTypesRef.current = referenceTransmissionTypes;

  useEffect(() => {
    if (isOpen) {
      dispatch(fetchVehicles());
    }
  }, [isOpen, dispatch]);

  useEffect(() => {
    if (!isOpen) return;
    dispatch(fetchReferenceTransmissions())
      .unwrap()
      .then((rows) => setReferenceTransmissionTypes(rows || []))
      .catch(() => setReferenceTransmissionTypes([]));
  }, [isOpen, dispatch]);

  useEffect(() => {
    if (!isOpen) return;
    if (selectedVehicleProp?.id) {
      setMode('detail');
      setDetailVehicle(selectedVehicleProp);
    } else {
      setMode('select');
      setDetailVehicle(null);
    }
  }, [isOpen, selectedVehicleProp?.id]);

  useEffect(() => {
    if (!isOpen || !stockInVehicleModal || mode !== 'detail' || !detailVehicle?.id) return;
    const v = detailVehicle;
    let cancelled = false;
    (async () => {
      const merged = await hydrateDetailCatalogForVehicle(dispatch, v);
      if (cancelled) return;
      setDetailEdit(merged);
      setDetailBaselinePayload(
        serializeUpdatePayload(merged, referenceTransmissionTypesRef.current)
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, stockInVehicleModal, mode, detailVehicle?.id, dispatch]);

  useEffect(() => {
    if (isOpen && mode === 'create') {
      setCreate(emptyCreate());
    }
  }, [isOpen, mode]);

  const runBrandSearch = useCallback(
    async (q, target) => {
      const term = (q || '').trim();
      const clearOpts = (prev) => ({ ...prev, manufacturerOptions: [] });
      const setOpts = (rows) => (prev) => ({ ...prev, manufacturerOptions: rows || [] });
      if (!term) {
        if (target === 'create') setCreate(clearOpts);
        else setDetailEdit(clearOpts);
        return;
      }
      try {
        const rows = await dispatch(
          fetchVehicleCatalogManufacturers({ q: term, limit: 80 })
        ).unwrap();
        if (target === 'create') setCreate(setOpts(rows));
        else setDetailEdit(setOpts(rows));
      } catch {
        if (target === 'create') setCreate(clearOpts);
        else setDetailEdit(clearOpts);
      }
    },
    [dispatch]
  );

  useEffect(() => {
    if (mode === 'create') {
      const t = setTimeout(() => runBrandSearch(create.brandInput, 'create'), 320);
      return () => clearTimeout(t);
    }
    if (mode === 'detail' && stockInVehicleModal) {
      const t = setTimeout(() => runBrandSearch(detailEdit.brandInput, 'detail'), 320);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [create.brandInput, detailEdit.brandInput, mode, stockInVehicleModal, runBrandSearch]);

  const pickManufacturer = (row, target) => {
    const patch = (prev) => ({
      ...prev,
      catalogManufacturerId: row.id,
      brandInput: row.description || row.matchcode || '',
      manufacturerOptions: [],
      catalogModelId: null,
      catalogPassengercarId: null,
      catalogEngineId: null,
      referenceTransmissionId: null,
      modelInput: '',
      generationInput: '',
      engineText: '',
      transmissionText: '',
      modelOptions: [],
      pcOptions: [],
      engineOptions: [],
    });
    if (target === 'create') setCreate(patch);
    else setDetailEdit(patch);
    setChildLoading(true);
    dispatch(fetchVehicleCatalogModels(row.id))
      .unwrap()
      .then((rows) => {
        const setModels = (prev) => ({ ...prev, modelOptions: rows || [] });
        if (target === 'create') setCreate(setModels);
        else setDetailEdit(setModels);
      })
      .catch(() => {
        const empty = (prev) => ({ ...prev, modelOptions: [] });
        if (target === 'create') setCreate(empty);
        else setDetailEdit(empty);
      })
      .finally(() => setChildLoading(false));
  };

  const onBrandInputChange = (e, target) => {
    const val = e.target.value;
    const patch = (prev) => ({
      ...prev,
      brandInput: val,
      catalogManufacturerId: null,
      catalogModelId: null,
      catalogPassengercarId: null,
      catalogEngineId: null,
      referenceTransmissionId: null,
      modelInput: '',
      generationInput: '',
      engineText: '',
      transmissionText: '',
      modelOptions: [],
      pcOptions: [],
      engineOptions: [],
    });
    if (target === 'create') setCreate(patch);
    else setDetailEdit(patch);
  };

  const pickCatalogModel = (m, target) => {
    const id = m?.id;
    if (!id) return;
    const label = modelOptionLabel(m);
    const patch = (prev) => ({
      ...prev,
      catalogModelId: id,
      modelInput: label,
      catalogPassengercarId: null,
      catalogEngineId: null,
      referenceTransmissionId: null,
      generationInput: '',
      engineText: '',
      transmissionText: '',
      pcOptions: [],
      engineOptions: [],
    });
    if (target === 'create') setCreate(patch);
    else setDetailEdit(patch);
    setChildLoading(true);
    dispatch(fetchVehicleCatalogPassengercars(id))
      .unwrap()
      .then((rows) => {
        const setPc = (prev) => ({ ...prev, pcOptions: rows || [] });
        if (target === 'create') setCreate(setPc);
        else setDetailEdit(setPc);
      })
      .catch(() => {
        const empty = (prev) => ({ ...prev, pcOptions: [] });
        if (target === 'create') setCreate(empty);
        else setDetailEdit(empty);
      })
      .finally(() => setChildLoading(false));
  };

  const onCatalogModelInputChange = (e, target) => {
    const val = e.target.value;
    const patch = (prev) => ({
      ...prev,
      modelInput: val,
      catalogModelId: null,
      catalogPassengercarId: null,
      catalogEngineId: null,
      referenceTransmissionId: null,
      generationInput: '',
      engineText: '',
      transmissionText: '',
      pcOptions: [],
      engineOptions: [],
    });
    if (target === 'create') setCreate(patch);
    else setDetailEdit(patch);
  };

  const pickPassengercar = (p, target) => {
    const id = p?.id;
    if (!id) return;
    const label = pcOptionLabel(p);
    const patch = (prev) => ({
      ...prev,
      catalogPassengercarId: id,
      generationInput: label,
      catalogEngineId: null,
      referenceTransmissionId: null,
      engineText: '',
      transmissionText: '',
      engineOptions: [],
    });
    if (target === 'create') setCreate(patch);
    else setDetailEdit(patch);
    setChildLoading(true);
    dispatch(fetchVehicleCatalogEngines(id))
      .unwrap()
      .then((engRows) => {
        const setEng = (prev) => ({ ...prev, engineOptions: engRows || [] });
        if (target === 'create') setCreate(setEng);
        else setDetailEdit(setEng);
      })
      .catch(() => {
        const empty = (prev) => ({ ...prev, engineOptions: [] });
        if (target === 'create') setCreate(empty);
        else setDetailEdit(empty);
      })
      .finally(() => setChildLoading(false));
  };

  const onPassengercarInputChange = (e, target) => {
    const val = e.target.value;
    const patch = (prev) => ({
      ...prev,
      generationInput: val,
      catalogPassengercarId: null,
      catalogEngineId: null,
      referenceTransmissionId: null,
      engineText: '',
      transmissionText: '',
      engineOptions: [],
    });
    if (target === 'create') setCreate(patch);
    else setDetailEdit(patch);
  };

  const pickCatalogEngine = (en, target) => {
    if (!en?.id) return;
    const label = engineOptionLabel(en);
    const patch = (prev) => ({
      ...prev,
      catalogEngineId: en.id,
      engineText: label,
    });
    if (target === 'create') setCreate(patch);
    else setDetailEdit(patch);
  };

  const onCatalogEngineInputChange = (e, target) => {
    const val = e.target.value;
    const patch = (prev) => ({
      ...prev,
      engineText: val,
      catalogEngineId: null,
    });
    if (target === 'create') setCreate(patch);
    else setDetailEdit(patch);
  };

  const pickReferenceTransmission = (row, target) => {
    const patch = (prev) => ({
      ...prev,
      referenceTransmissionId: row.id,
      transmissionText: row.name || '',
    });
    if (target === 'create') setCreate(patch);
    else setDetailEdit(patch);
  };

  const modelEnabled = create.brandInput.trim().length > 0;
  const usingManufacturerCatalog = create.catalogManufacturerId != null;
  const generationEnabled = usingManufacturerCatalog
    ? create.catalogModelId != null
    : modelEnabled && create.modelInput.trim().length > 0;
  const engineTxEnabled = usingManufacturerCatalog
    ? create.catalogPassengercarId != null
    : generationEnabled && create.generationInput.trim().length > 0;

  // После выбора поколения активируем остальные поля.
  // Двигатель/КПП не обязаны для ввода VIN/пробега.
  const vinEnabled = engineTxEnabled;

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!create.brandInput.trim()) return;

    if (create.vin && create.vin.length !== 17) {
      alert('VIN должен содержать ровно 17 символов');
      return;
    }

    let modelVal = create.modelInput.trim();
    if (usingManufacturerCatalog && create.catalogModelId) {
      const mo = create.modelOptions.find((m) => m.id === create.catalogModelId);
      modelVal = (mo && (mo.description || '')) || modelVal;
    }
    if (!modelVal) {
      alert('Укажите модель');
      return;
    }

    let generationVal = create.generationInput.trim();
    if (usingManufacturerCatalog && create.catalogPassengercarId) {
      const pc = create.pcOptions.find((p) => p.id === create.catalogPassengercarId);
      generationVal =
        (pc && (pc.full_description || pc.description || '')) || generationVal;
    }
    if (!generationVal) {
      alert('Укажите поколение');
      return;
    }

    let engineVal = (create.engineText || '').trim();
    if (create.catalogEngineId) {
      const en = create.engineOptions.find((x) => x.id === create.catalogEngineId);
      engineVal =
        (en && (en.sales_description || en.description || '')) || engineVal;
    }

    if (referenceTransmissionTypes.length > 0 && create.referenceTransmissionId == null) {
      alert('Выберите тип коробки передач');
      return;
    }

    let transmissionVal = (create.transmissionText || '').trim();
    if (create.referenceTransmissionId != null) {
      const tr = referenceTransmissionTypes.find((t) => t.id === create.referenceTransmissionId);
      if (tr?.name) transmissionVal = tr.name;
    }

    const mileageRaw = create.mileage === '' ? null : parseInt(String(create.mileage), 10);
    const mileage = Number.isNaN(mileageRaw) ? null : mileageRaw;

    const priceRaw = String(create.price || '').trim();
    let price = null;
    if (priceRaw !== '') {
      const n = parseFloat(priceRaw.replace(',', '.'));
      if (Number.isNaN(n)) {
        alert('Некорректная цена');
        return;
      }
      price = n;
    }

    const descTrim = (create.description || '').trim();

    const payload = {
      brand: create.brandInput.trim(),
      model: modelVal,
      generation: generationVal || null,
      engine: engineVal || null,
      transmission: transmissionVal || null,
      vin: create.vin ? create.vin.trim().toUpperCase() || null : null,
      mileage,
      price,
      description: descTrim === '' ? null : descTrim,
      photos: (create.vehiclePhotos || []).map((p) => p.tempPath).filter(Boolean),
      tecdoc_transmission_json: create.referenceTransmissionId != null ? null : undefined,
      transmission_id: create.referenceTransmissionId ?? undefined,
      tecdoc_manufacturer_id: create.catalogManufacturerId,
      tecdoc_model_id: usingManufacturerCatalog ? create.catalogModelId : null,
      tecdoc_passengercar_id: usingManufacturerCatalog ? create.catalogPassengercarId : null,
      tecdoc_engine_id: create.catalogEngineId || null,
    };

    const result = await dispatch(createVehicle(payload));
    if (createVehicle.fulfilled.match(result)) {
      onSelectVehicle(result.payload);
      onClose();
      setMode('select');
    } else {
      alert(result.payload || 'Не удалось создать автомобиль');
    }
  };

  const openVehicleDetail = (vehicle) => {
    setDetailVehicle(vehicle);
    setMode('detail');
  };

  const confirmVehicleSelection = () => {
    if (!detailVehicle) return;
    onSelectVehicle(detailVehicle);
    onClose();
  };

  const goBackToVehicleList = () => {
    setMode('select');
    setDetailVehicle(null);
  };

  const isStockInDetailDirty = useMemo(() => {
    if (!stockInVehicleModal || mode !== 'detail' || !detailVehicle?.id) return false;
    if (!detailBaselinePayload) return false;
    try {
      return (
        serializeUpdatePayload(detailEdit, referenceTransmissionTypes) !== detailBaselinePayload
      );
    } catch {
      return false;
    }
  }, [
    stockInVehicleModal,
    mode,
    detailVehicle?.id,
    detailEdit,
    detailBaselinePayload,
    referenceTransmissionTypes,
  ]);

  const handleStockInSaveDetail = async () => {
    if (!detailVehicle?.id) return;
    if (!detailEdit.brandInput.trim()) {
      alert('Укажите марку');
      return;
    }

    const usingManufacturerCatalog = detailEdit.catalogManufacturerId != null;
    let modelVal = detailEdit.modelInput.trim();
    if (usingManufacturerCatalog && detailEdit.catalogModelId) {
      const mo = detailEdit.modelOptions.find((m) => m.id === detailEdit.catalogModelId);
      modelVal = (mo && (mo.description || '')) || modelVal;
    }
    if (!modelVal) {
      alert('Укажите модель');
      return;
    }

    let generationVal = detailEdit.generationInput.trim();
    if (usingManufacturerCatalog && detailEdit.catalogPassengercarId) {
      const pc = detailEdit.pcOptions.find((p) => p.id === detailEdit.catalogPassengercarId);
      generationVal =
        (pc && (pc.full_description || pc.description || '')) || generationVal;
    }
    if (!generationVal) {
      alert('Укажите поколение');
      return;
    }

    if (detailEdit.vin && detailEdit.vin.length !== 17) {
      alert('VIN должен содержать ровно 17 символов');
      return;
    }

    const mileageStr = String(detailEdit.mileage ?? '').trim();
    if (mileageStr !== '') {
      const n = parseInt(mileageStr, 10);
      if (Number.isNaN(n)) {
        alert('Некорректный пробег');
        return;
      }
    }

    const priceStr = detailEdit.price.trim().replace(',', '.');
    if (priceStr !== '') {
      const n = parseFloat(priceStr);
      if (Number.isNaN(n)) {
        alert('Некорректная цена');
        return;
      }
    }

    if (referenceTransmissionTypes.length > 0 && detailEdit.referenceTransmissionId == null) {
      alert('Выберите тип коробки передач');
      return;
    }

    const patch = buildUpdatePayloadFromDraft(detailEdit, referenceTransmissionTypes);

    setDetailSaveLoading(true);
    try {
      const result = await dispatch(
        updateVehicle({
          id: detailVehicle.id,
          brand: patch.brand,
          model: patch.model,
          generation: patch.generation,
          engine: patch.engine,
          transmission: patch.transmission,
          transmission_id: patch.transmission_id,
          vin: patch.vin,
          mileage: patch.mileage,
          price: patch.price,
          description: patch.description,
          tecdoc_manufacturer_id: patch.tecdoc_manufacturer_id,
          tecdoc_model_id: patch.tecdoc_model_id,
          tecdoc_passengercar_id: patch.tecdoc_passengercar_id,
          tecdoc_engine_id: patch.tecdoc_engine_id,
          tecdoc_transmission_json: patch.tecdoc_transmission_json,
        })
      );
      if (updateVehicle.fulfilled.match(result)) {
        const updated = result.payload;
        setDetailVehicle(updated);
        const merged = await hydrateDetailCatalogForVehicle(dispatch, updated);
        setDetailEdit(merged);
        setDetailBaselinePayload(
          serializeUpdatePayload(merged, referenceTransmissionTypesRef.current)
        );
      } else {
        alert(result.payload || 'Не удалось сохранить');
      }
    } finally {
      setDetailSaveLoading(false);
    }
  };

  const handleVehiclePhotosAdd = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    const remaining = MAX_VEHICLE_PHOTOS - (create.vehiclePhotos?.length || 0);
    if (remaining <= 0) {
      alert(`Максимум ${MAX_VEHICLE_PHOTOS} фотографий`);
      return;
    }
    const toUpload = files.slice(0, remaining);
    if (files.length > remaining) {
      alert(`Можно добавить ещё только ${remaining} фото (макс. ${MAX_VEHICLE_PHOTOS})`);
    }
    for (const file of toUpload) {
      if (!file.type.startsWith('image/')) continue;
      try {
        const formData = new FormData();
        formData.append('file', file);
        const result = await apiRequestFormData('/upload/photo', formData);
        if (result.temp_path) {
          setCreate((prev) => ({
            ...prev,
            vehiclePhotos: [
              ...(prev.vehiclePhotos || []),
              { tempPath: result.temp_path, name: file.name },
            ],
          }));
        }
      } catch (err) {
        console.error(err);
        alert(`Ошибка загрузки: ${file.name}`);
      }
    }
  };

  const removeVehiclePhoto = (index) => {
    setCreate((prev) => ({
      ...prev,
      vehiclePhotos: (prev.vehiclePhotos || []).filter((_, i) => i !== index),
    }));
  };

  if (!isOpen) return null;

  const detailUsingManufacturerCatalog =
    stockInVehicleModal && mode === 'detail' && detailEdit.catalogManufacturerId != null;
  const detailModelEnabled = detailEdit.brandInput.trim().length > 0;
  const detailGenerationEnabled = detailUsingManufacturerCatalog
    ? detailEdit.catalogModelId != null
    : detailModelEnabled && detailEdit.modelInput.trim().length > 0;
  const detailEngineTxEnabled = detailUsingManufacturerCatalog
    ? detailEdit.catalogPassengercarId != null
    : detailGenerationEnabled && detailEdit.generationInput.trim().length > 0;

  const modalTitle =
    mode === 'select' ? 'Выберите автомобиль' : mode === 'detail' ? 'Автомобиль' : 'Добавить автомобиль';

  const renderVehicleDetailCard = (v) => {
    if (!v) return null;
    const priceNum = v.price != null && v.price !== '' ? Number(v.price) : null;
    const showPrice = priceNum != null && !Number.isNaN(priceNum);
    return (
      <div className="space-y-4">
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${FORM_CARD}`}>
          <div>
            <div className={FIELD_LABEL}>Марка</div>
            <div className="text-sm font-medium text-gray-900">{v.brand}</div>
          </div>
          <div>
            <div className={FIELD_LABEL}>Модель</div>
            <div className="text-sm font-medium text-gray-900">{v.model}</div>
          </div>
          <div>
            <div className={FIELD_LABEL}>Поколение</div>
            <div className="text-sm font-medium text-gray-900">{v.generation || '—'}</div>
          </div>
          <div>
            <div className={FIELD_LABEL}>Двигатель</div>
            <div className="text-sm font-medium text-gray-900">{v.engine || '—'}</div>
          </div>
          <div>
            <div className={FIELD_LABEL}>КПП</div>
            <div className="text-sm font-medium text-gray-900">{v.transmission || '—'}</div>
          </div>
          {v.vin && (
            <div>
              <div className={FIELD_LABEL}>VIN</div>
              <div className="text-sm font-medium text-gray-900">{v.vin}</div>
            </div>
          )}
          {v.mileage != null && v.mileage !== '' && (
            <div>
              <div className={FIELD_LABEL}>Пробег</div>
              <div className="text-sm font-medium text-gray-900">
                {Number(v.mileage).toLocaleString()} км
              </div>
            </div>
          )}
          {showPrice && (
            <div>
              <div className={FIELD_LABEL}>Цена</div>
              <div className="text-sm font-medium text-gray-900">
                {priceNum.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₽
              </div>
            </div>
          )}
        </div>
        {Array.isArray(v.photos) && v.photos.length > 0 && (
          <div className={FORM_CARD}>
            <div className={FIELD_LABEL}>Фото</div>
            <div className="flex flex-wrap gap-2">
              {v.photos.map((ph) => (
                <img
                  key={ph.id ?? ph.photo_path}
                  src={normalizeImageUrl(ph.photo_path)}
                  alt=""
                  className="w-24 h-24 object-cover rounded-md border border-gray-300 shadow-sm"
                />
              ))}
            </div>
          </div>
        )}
        {v.description && String(v.description).trim() !== '' && (
          <div className={FORM_CARD}>
            <div className={FIELD_LABEL}>Описание</div>
            <p className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">{v.description}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold">{modalTitle}</h2>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">
            &times;
          </button>
        </div>

        <div className="p-4">
          {mode === 'select' ? (
            <div>
              <div className="flex justify-end mb-4">
                <button
                  type="button"
                  onClick={() => setMode('create')}
                  className="text-indigo-600 hover:text-indigo-800 underline text-sm"
                >
                  Добавить новый автомобиль
                </button>
              </div>

              {vehiclesLoading ? (
                <div className="text-center py-8 text-gray-500">Загрузка...</div>
              ) : vehicles?.length === 0 ? (
                <div className="text-center py-8 text-gray-500">Нет доступных автомобилей</div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {vehicles.map((vehicle) => (
                    <div
                      key={vehicle.id}
                      role="button"
                      tabIndex={0}
                      className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition"
                      onClick={() => openVehicleDetail(vehicle)}
                      onKeyDown={(ev) => ev.key === 'Enter' && openVehicleDetail(vehicle)}
                    >
                      <div className="font-medium">
                        {vehicle.brand} {vehicle.model}
                      </div>
                      <div className="text-sm text-gray-600">
                        {vehicle.generation} • {vehicle.engine} • {vehicle.transmission}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-2">
                        {vehicle.vin && <span>VIN: {vehicle.vin}</span>}
                        {vehicle.mileage != null && vehicle.mileage !== '' && (
                          <span>Пробег: {Number(vehicle.mileage).toLocaleString()} км</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : mode === 'detail' ? (
            <div>
              {stockInVehicleModal ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Марку и комплектацию можно выбрать из каталога или ввести вручную (как при создании).
                  </p>
                  <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${FORM_CARD}`}>
                    <div className="md:col-span-2">
                      <div className={FIELD_LABEL}>Марка *</div>
                      <input
                        type="text"
                        value={detailEdit.brandInput}
                        onChange={(e) => onBrandInputChange(e, 'detail')}
                        className={FIELD_BASE}
                        placeholder={PLH.brand}
                        autoComplete="off"
                      />
                      {detailEdit.manufacturerOptions.length > 0 &&
                        detailEdit.catalogManufacturerId == null &&
                        filterManufacturersByInput(
                          detailEdit.manufacturerOptions,
                          detailEdit.brandInput
                        ).length > 0 && (
                          <ul className={SUGGEST_LIST}>
                            {filterManufacturersByInput(
                              detailEdit.manufacturerOptions,
                              detailEdit.brandInput
                            ).map((m) => (
                              <li key={m.id}>
                                <button
                                  type="button"
                                  className={SUGGEST_ITEM}
                                  onClick={() => pickManufacturer(m, 'detail')}
                                >
                                  {m.description || m.matchcode || m.id}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                    </div>

                    {detailUsingManufacturerCatalog ? (
                      <div className="md:col-span-2">
                        <div className={FIELD_LABEL}>Модель *</div>
                        <input
                          type="text"
                          value={detailEdit.modelInput}
                          onChange={(e) => onCatalogModelInputChange(e, 'detail')}
                          disabled={!detailModelEnabled || childLoading}
                          className={FIELD_BASE}
                          placeholder={PLH.model}
                          autoComplete="off"
                        />
                        {detailEdit.modelOptions.length > 0 &&
                          detailEdit.catalogModelId == null &&
                          filterModelsByInput(detailEdit.modelOptions, detailEdit.modelInput).length >
                            0 && (
                            <ul className={SUGGEST_LIST}>
                              {filterModelsByInput(
                                detailEdit.modelOptions,
                                detailEdit.modelInput
                              ).map((m) => (
                                <li key={m.id}>
                                  <button
                                    type="button"
                                    className={SUGGEST_ITEM}
                                    onClick={() => pickCatalogModel(m, 'detail')}
                                  >
                                    {modelOptionLabel(m)}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                      </div>
                    ) : (
                      <div className="md:col-span-2">
                        <div className={FIELD_LABEL}>Модель *</div>
                        <input
                          type="text"
                          value={detailEdit.modelInput}
                          onChange={(e) =>
                            setDetailEdit((prev) => ({ ...prev, modelInput: e.target.value }))
                          }
                          disabled={!detailModelEnabled}
                          className={FIELD_BASE}
                          placeholder={PLH.modelManual}
                        />
                      </div>
                    )}

                    {detailUsingManufacturerCatalog ? (
                      <div className="md:col-span-2">
                        <div className={FIELD_LABEL}>Поколение *</div>
                        <input
                          type="text"
                          value={detailEdit.generationInput}
                          onChange={(e) => onPassengercarInputChange(e, 'detail')}
                          disabled={!detailGenerationEnabled || childLoading}
                          className={FIELD_BASE}
                          placeholder={PLH.generation}
                          autoComplete="off"
                        />
                        {detailEdit.pcOptions.length > 0 &&
                          detailEdit.catalogPassengercarId == null &&
                          filterPcByInput(detailEdit.pcOptions, detailEdit.generationInput).length >
                            0 && (
                            <ul className={SUGGEST_LIST}>
                              {filterPcByInput(
                                detailEdit.pcOptions,
                                detailEdit.generationInput
                              ).map((p) => (
                                <li key={p.id}>
                                  <button
                                    type="button"
                                    className={SUGGEST_ITEM}
                                    onClick={() => pickPassengercar(p, 'detail')}
                                  >
                                    {pcOptionLabel(p)}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                      </div>
                    ) : (
                      <div className="md:col-span-2">
                        <div className={FIELD_LABEL}>Поколение *</div>
                        <input
                          type="text"
                          value={detailEdit.generationInput}
                          onChange={(e) =>
                            setDetailEdit((prev) => ({ ...prev, generationInput: e.target.value }))
                          }
                          disabled={!detailGenerationEnabled}
                          className={FIELD_BASE}
                          placeholder={PLH.generationManual}
                        />
                      </div>
                    )}

                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className={FIELD_LABEL}>Двигатель</div>
                        {detailUsingManufacturerCatalog && detailEdit.catalogPassengercarId ? (
                          <>
                            <input
                              type="text"
                              value={detailEdit.engineText}
                              onChange={(e) => onCatalogEngineInputChange(e, 'detail')}
                              disabled={!detailEngineTxEnabled || childLoading}
                              className={FIELD_BASE}
                              placeholder={PLH.engine}
                              autoComplete="off"
                            />
                            {detailEdit.engineOptions.length > 0 &&
                              detailEdit.catalogEngineId == null &&
                              filterEnginesByInput(
                                detailEdit.engineOptions,
                                detailEdit.engineText
                              ).length > 0 && (
                                <ul className={SUGGEST_LIST}>
                                  {filterEnginesByInput(
                                    detailEdit.engineOptions,
                                    detailEdit.engineText
                                  ).map((en) => (
                                    <li key={en.id}>
                                      <button
                                        type="button"
                                        className={SUGGEST_ITEM}
                                        onClick={() => pickCatalogEngine(en, 'detail')}
                                      >
                                        {engineOptionLabel(en)}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              )}
                          </>
                        ) : (
                          <input
                            type="text"
                            value={detailEdit.engineText}
                            onChange={(e) =>
                              setDetailEdit((prev) => ({ ...prev, engineText: e.target.value }))
                            }
                            disabled={!detailEngineTxEnabled}
                            className={FIELD_BASE}
                            placeholder={PLH.engineManual}
                          />
                        )}
                      </div>

                      <div>
                        <div className={FIELD_LABEL}>Коробка передач *</div>
                        <select
                          value={
                            referenceTransmissionTypes.length > 0 &&
                            detailEdit.referenceTransmissionId != null
                              ? String(detailEdit.referenceTransmissionId)
                              : ''
                          }
                          onChange={(e) => {
                            const v = e.target.value;
                            if (!v) {
                              setDetailEdit((prev) => ({
                                ...prev,
                                referenceTransmissionId: null,
                                transmissionText: '',
                              }));
                              return;
                            }
                            const row = referenceTransmissionTypes.find(
                              (t) => String(t.id) === v
                            );
                            if (row) pickReferenceTransmission(row, 'detail');
                          }}
                          disabled={
                            !detailEngineTxEnabled ||
                            childLoading ||
                            referenceTransmissionTypes.length === 0
                          }
                          className={FIELD_BASE}
                        >
                          <option value="">
                            {referenceTransmissionTypes.length === 0
                              ? 'Загрузка типов КПП…'
                              : 'Выберите КПП'}
                          </option>
                          {referenceTransmissionTypes.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <div className={FIELD_LABEL}>VIN</div>
                      <input
                        type="text"
                        value={detailEdit.vin}
                        onChange={(e) =>
                          setDetailEdit((prev) => ({ ...prev, vin: e.target.value }))
                        }
                        onBlur={() =>
                          setDetailEdit((prev) => ({
                            ...prev,
                            vin: prev.vin.trim().toUpperCase(),
                          }))
                        }
                        className={FIELD_BASE}
                        maxLength={17}
                        placeholder={PLH.vin}
                        spellCheck={false}
                      />
                    </div>
                    <div>
                      <div className={FIELD_LABEL}>Пробег (км)</div>
                      <input
                        type="number"
                        value={detailEdit.mileage}
                        onChange={(e) =>
                          setDetailEdit((prev) => ({ ...prev, mileage: e.target.value }))
                        }
                        className={FIELD_BASE}
                        placeholder={PLH.mileage}
                        min="0"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <div className={FIELD_LABEL}>Цена автомобиля</div>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={detailEdit.price}
                        onChange={(e) =>
                          setDetailEdit((prev) => ({ ...prev, price: e.target.value }))
                        }
                        className={FIELD_BASE}
                        placeholder={PLH.price}
                      />
                    </div>
                    {Array.isArray(detailVehicle?.photos) && detailVehicle.photos.length > 0 && (
                      <div className="md:col-span-2">
                        <div className={FIELD_LABEL}>Фото</div>
                        <div className="flex flex-wrap gap-2">
                          {detailVehicle.photos.map((ph) => (
                            <img
                              key={ph.id ?? ph.photo_path}
                              src={normalizeImageUrl(ph.photo_path)}
                              alt=""
                              className="w-24 h-24 object-cover rounded-md border border-gray-300 shadow-sm"
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="md:col-span-2">
                      <div className={FIELD_LABEL}>Описание</div>
                      <textarea
                        value={detailEdit.description}
                        onChange={(e) =>
                          setDetailEdit((prev) => ({ ...prev, description: e.target.value }))
                        }
                        rows={4}
                        maxLength={8000}
                        className={FIELD_TEXTAREA}
                        placeholder={PLH.description}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                renderVehicleDetailCard(detailVehicle)
              )}
              <div className="mt-6 flex flex-wrap items-center gap-3 justify-between">
                <button
                  type="button"
                  onClick={goBackToVehicleList}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-200 rounded-md"
                >
                  Назад к списку
                </button>
                {!stockInVehicleModal && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setMode('create')}
                      className="px-4 py-2 text-indigo-600 border border-indigo-200 rounded-md hover:bg-indigo-50"
                    >
                      Добавить новый
                    </button>
                    <button
                      type="button"
                      onClick={confirmVehicleSelection}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                    >
                      Выбрать этот автомобиль
                    </button>
                  </div>
                )}
                {stockInVehicleModal && isStockInDetailDirty && (
                  <button
                    type="button"
                    onClick={handleStockInSaveDetail}
                    disabled={detailSaveLoading}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {detailSaveLoading ? 'Сохранение…' : 'Сохранить изменения'}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreate}>
              <div className={FORM_CARD}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <div className={FIELD_LABEL}>Марка *</div>
                  <input
                    type="text"
                    value={create.brandInput}
                    onChange={(e) => onBrandInputChange(e, 'create')}
                    required
                    className={FIELD_BASE}
                    placeholder={PLH.brand}
                    autoComplete="off"
                  />
                  {create.manufacturerOptions.length > 0 &&
                    create.catalogManufacturerId == null &&
                    filterManufacturersByInput(create.manufacturerOptions, create.brandInput).length >
                      0 && (
                      <ul className={SUGGEST_LIST}>
                        {filterManufacturersByInput(
                          create.manufacturerOptions,
                          create.brandInput
                        ).map((m) => (
                          <li key={m.id}>
                            <button
                              type="button"
                              className={SUGGEST_ITEM}
                              onClick={() => pickManufacturer(m, 'create')}
                            >
                              {m.description || m.matchcode || m.id}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                </div>

                {usingManufacturerCatalog ? (
                  <div className="md:col-span-2">
                    <div className={FIELD_LABEL}>Модель *</div>
                    <input
                      type="text"
                      value={create.modelInput}
                      onChange={(e) => onCatalogModelInputChange(e, 'create')}
                      disabled={!modelEnabled || childLoading}
                      required
                      className={FIELD_BASE}
                      placeholder={PLH.model}
                      autoComplete="off"
                    />
                    {create.modelOptions.length > 0 &&
                      create.catalogModelId == null &&
                      filterModelsByInput(create.modelOptions, create.modelInput).length > 0 && (
                        <ul className={SUGGEST_LIST}>
                          {filterModelsByInput(create.modelOptions, create.modelInput).map((m) => (
                            <li key={m.id}>
                              <button
                                type="button"
                                className={SUGGEST_ITEM}
                                onClick={() => pickCatalogModel(m, 'create')}
                              >
                                {modelOptionLabel(m)}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                  </div>
                ) : (
                  <div className="md:col-span-2">
                    <div className={FIELD_LABEL}>Модель *</div>
                    <input
                      type="text"
                      value={create.modelInput}
                      onChange={(e) =>
                        setCreate((prev) => ({ ...prev, modelInput: e.target.value }))
                      }
                      disabled={!modelEnabled}
                      required
                      className={FIELD_BASE}
                      placeholder={PLH.modelManual}
                    />
                  </div>
                )}

                {usingManufacturerCatalog ? (
                  <div className="md:col-span-2">
                    <div className={FIELD_LABEL}>Поколение *</div>
                    <input
                      type="text"
                      value={create.generationInput}
                      onChange={(e) => onPassengercarInputChange(e, 'create')}
                      disabled={!generationEnabled || childLoading}
                      required
                      className={FIELD_BASE}
                      placeholder={PLH.generation}
                      autoComplete="off"
                    />
                    {create.pcOptions.length > 0 &&
                      create.catalogPassengercarId == null &&
                      filterPcByInput(create.pcOptions, create.generationInput).length > 0 && (
                        <ul className={SUGGEST_LIST}>
                          {filterPcByInput(create.pcOptions, create.generationInput).map((p) => (
                            <li key={p.id}>
                              <button
                                type="button"
                                className={SUGGEST_ITEM}
                                onClick={() => pickPassengercar(p, 'create')}
                              >
                                {pcOptionLabel(p)}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                  </div>
                ) : (
                  <div className="md:col-span-2">
                    <div className={FIELD_LABEL}>Поколение *</div>
                    <input
                      type="text"
                      value={create.generationInput}
                      onChange={(e) =>
                        setCreate((prev) => ({ ...prev, generationInput: e.target.value }))
                      }
                      disabled={!generationEnabled}
                      required
                      className={FIELD_BASE}
                      placeholder={PLH.generationManual}
                    />
                  </div>
                )}

                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className={FIELD_LABEL}>Двигатель</div>
                    {usingManufacturerCatalog && create.catalogPassengercarId ? (
                      <>
                        <input
                          type="text"
                          value={create.engineText}
                          onChange={(e) => onCatalogEngineInputChange(e, 'create')}
                          disabled={!engineTxEnabled || childLoading}
                          className={FIELD_BASE}
                          placeholder={PLH.engine}
                          autoComplete="off"
                        />
                        {create.engineOptions.length > 0 &&
                          create.catalogEngineId == null &&
                          filterEnginesByInput(create.engineOptions, create.engineText).length >
                            0 && (
                            <ul className={SUGGEST_LIST}>
                              {filterEnginesByInput(create.engineOptions, create.engineText).map(
                                (en) => (
                                  <li key={en.id}>
                                    <button
                                      type="button"
                                      className={SUGGEST_ITEM}
                                      onClick={() => pickCatalogEngine(en, 'create')}
                                    >
                                      {engineOptionLabel(en)}
                                    </button>
                                  </li>
                                )
                              )}
                            </ul>
                          )}
                      </>
                    ) : (
                      <input
                        type="text"
                        value={create.engineText}
                        onChange={(e) =>
                          setCreate((prev) => ({ ...prev, engineText: e.target.value }))
                        }
                        disabled={!engineTxEnabled}
                        className={FIELD_BASE}
                        placeholder={PLH.engineManual}
                      />
                    )}
                  </div>

                  <div>
                    <div className={FIELD_LABEL}>Коробка передач *</div>
                    <select
                      value={
                        referenceTransmissionTypes.length > 0 &&
                        create.referenceTransmissionId != null
                          ? String(create.referenceTransmissionId)
                          : ''
                      }
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) {
                          setCreate((prev) => ({
                            ...prev,
                            referenceTransmissionId: null,
                            transmissionText: '',
                          }));
                          return;
                        }
                        const row = referenceTransmissionTypes.find((t) => String(t.id) === v);
                        if (row) pickReferenceTransmission(row, 'create');
                      }}
                      disabled={
                        !engineTxEnabled || childLoading || referenceTransmissionTypes.length === 0
                      }
                      className={FIELD_BASE}
                    >
                      <option value="">
                        {referenceTransmissionTypes.length === 0
                          ? 'Загрузка типов КПП…'
                          : 'Выберите КПП'}
                      </option>
                      {referenceTransmissionTypes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <div className={FIELD_LABEL}>VIN</div>
                  <input
                    type="text"
                    value={create.vin}
                    onChange={(e) => setCreate((prev) => ({ ...prev, vin: e.target.value }))}
                    onBlur={() =>
                      setCreate((prev) => ({
                        ...prev,
                        vin: prev.vin.trim().toUpperCase(),
                      }))
                    }
                    disabled={!vinEnabled}
                    className={FIELD_BASE}
                    maxLength={17}
                    placeholder={PLH.vin}
                    spellCheck={false}
                  />
                </div>

                <div>
                  <div className={FIELD_LABEL}>Пробег (км)</div>
                  <input
                    type="number"
                    value={create.mileage}
                    onChange={(e) =>
                      setCreate((prev) => ({ ...prev, mileage: e.target.value }))
                    }
                    disabled={!vinEnabled}
                    className={FIELD_BASE}
                    placeholder={PLH.mileage}
                    min="0"
                  />
                </div>

                <div className="md:col-span-2">
                  <div className={FIELD_LABEL}>Цена автомобиля</div>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={create.price}
                    onChange={(e) => setCreate((prev) => ({ ...prev, price: e.target.value }))}
                    className={FIELD_BASE}
                    placeholder={PLH.price}
                  />
                </div>

                <div className="md:col-span-2">
                  <div className={FIELD_LABEL}>Фото (до {MAX_VEHICLE_PHOTOS})</div>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleVehiclePhotosAdd}
                    className={FIELD_FILE}
                  />
                  {(create.vehiclePhotos?.length || 0) > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {create.vehiclePhotos.map((ph, idx) => (
                        <div
                          key={`${ph.tempPath}-${idx}`}
                          className="relative w-20 h-20 rounded-md border border-gray-300 shadow-sm overflow-hidden"
                        >
                          <img
                            src={normalizeImageUrl(ph.tempPath)}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeVehiclePhoto(idx)}
                            className="absolute top-0 right-0 bg-black/60 text-white text-xs px-1"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="md:col-span-2">
                  <div className={FIELD_LABEL}>Описание</div>
                  <textarea
                    value={create.description}
                    onChange={(e) =>
                      setCreate((prev) => ({ ...prev, description: e.target.value }))
                    }
                    rows={4}
                    maxLength={8000}
                    className={FIELD_TEXTAREA}
                    placeholder={PLH.description}
                  />
                </div>
              </div>
              </div>

              <div className="mt-6 flex justify-between">
                <button
                  type="button"
                  onClick={() => setMode('select')}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Назад к выбору
                </button>
                <button
                  type="submit"
                  disabled={!vinEnabled}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  Добавить автомобиль
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default VehicleModal;
