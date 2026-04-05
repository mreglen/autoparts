import { useDispatch, useSelector } from 'react-redux';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchVehicles,
  createVehicle,
  updateVehicle,
  fetchVehicleCatalogManufacturers,
  fetchVehicleCatalogModels,
  fetchVehicleCatalogPassengercars,
  fetchVehicleCatalogEngines,
  fetchVehicleCatalogTransmissions,
} from '../../../redux/slices/ProductSlice';
import { apiRequestFormData, normalizeImageUrl } from '../../../utils/apiClient';

const MAX_VEHICLE_PHOTOS = 10;

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

const transmissionOptionKey = (tx, idx) =>
  `${tx.title || ''}\t${tx.value}`.trim() || `tx-${idx}`;

const transmissionDisplay = (tx) =>
  tx.title ? `${tx.title}: ${tx.value}` : tx.value;

const filterTransmissionsByInput = (rows, query) => {
  const nq = normCatalogQ(query);
  if (!nq) return rows || [];
  return (rows || []).filter((tx) => {
    const disp = transmissionDisplay(tx).toLowerCase();
    const val = (tx.value || '').toLowerCase();
    const tit = (tx.title || '').toLowerCase();
    return disp.includes(nq) || val.includes(nq) || tit.includes(nq);
  });
};

const emptyCreate = () => ({
  catalogManufacturerId: null,
  catalogModelId: null,
  catalogPassengercarId: null,
  catalogEngineId: null,
  catalogTransmissionKey: '',
  brandInput: '',
  modelInput: '',
  generationInput: '',
  engineText: '',
  transmissionText: '',
  vin: '',
  mileage: '',
  price: '',
  vehiclePhotos: [],
  manufacturerOptions: [],
  modelOptions: [],
  pcOptions: [],
  engineOptions: [],
  transmissionOptions: [],
});

const emptyDetailEdit = () => ({
  ...emptyCreate(),
  vin: '',
  mileage: '',
  price: '',
});

const vehicleToDetailEditSyncPart = (v) => {
  const tj = v?.tecdoc_transmission_json;
  let catalogTransmissionKey = '';
  if (tj && typeof tj === 'object') {
    const title = tj.title != null ? String(tj.title) : '';
    const val = tj.value != null ? String(tj.value) : '';
    catalogTransmissionKey = title || val ? `${title}\t${val}` : '';
  }
  return {
    catalogManufacturerId: v?.tecdoc_manufacturer_id ?? null,
    catalogModelId: v?.tecdoc_model_id ?? null,
    catalogPassengercarId: v?.tecdoc_passengercar_id ?? null,
    catalogEngineId: v?.tecdoc_engine_id ?? null,
    catalogTransmissionKey,
    brandInput: v?.brand || '',
    modelInput: v?.model || '',
    generationInput: v?.generation || '',
    engineText: v?.engine || '',
    transmissionText: v?.transmission || '',
    vin: (v?.vin || '').toUpperCase(),
    mileage: v?.mileage != null && v?.mileage !== '' ? String(v.mileage) : '',
    price:
      v?.price != null && v?.price !== ''
        ? String(v.price).replace('.', ',')
        : '',
    manufacturerOptions: [],
    modelOptions: [],
    pcOptions: [],
    engineOptions: [],
    transmissionOptions: [],
    vehiclePhotos: [],
  };
};

const buildUpdatePayloadFromDraft = (draft) => {
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
  if (draft.catalogTransmissionKey) {
    const tab = draft.catalogTransmissionKey.indexOf('\t');
    const title = tab >= 0 ? draft.catalogTransmissionKey.slice(0, tab) : '';
    const value = tab >= 0 ? draft.catalogTransmissionKey.slice(tab + 1) : draft.catalogTransmissionKey;
    transmissionVal = (value || title || transmissionVal).trim();
  }

  let tecdocTransmissionJson = null;
  if (draft.catalogTransmissionKey) {
    const k = draft.catalogTransmissionKey;
    const tab = k.indexOf('\t');
    tecdocTransmissionJson =
      tab >= 0
        ? { title: k.slice(0, tab) || null, value: k.slice(tab + 1) || null }
        : { title: null, value: k };
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

  const vinVal = draft.vin.trim();

  return {
    brand: draft.brandInput.trim(),
    model: modelVal,
    generation: generationVal || null,
    engine: engineVal || null,
    transmission: transmissionVal || null,
    vin: vinVal ? vinVal : null,
    mileage: mileageStr === '' ? null : mileage,
    price,
    tecdoc_manufacturer_id: draft.catalogManufacturerId,
    tecdoc_model_id: usingManufacturerCatalog ? draft.catalogModelId : null,
    tecdoc_passengercar_id: usingManufacturerCatalog ? draft.catalogPassengercarId : null,
    tecdoc_engine_id: draft.catalogEngineId || null,
    tecdoc_transmission_json: tecdocTransmissionJson,
  };
};

const serializeUpdatePayload = (draft) => {
  const p = buildUpdatePayloadFromDraft(draft);
  return JSON.stringify(p);
};

async function hydrateDetailCatalogForVehicle(dispatch, v) {
  const sync = vehicleToDetailEditSyncPart(v);
  let modelOptions = [];
  let pcOptions = [];
  let engineOptions = [];
  let transmissionOptions = [];
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
      const [er, tr] = await Promise.allSettled([
        dispatch(fetchVehicleCatalogEngines(v.tecdoc_passengercar_id)).unwrap(),
        dispatch(fetchVehicleCatalogTransmissions(v.tecdoc_passengercar_id)).unwrap(),
      ]);
      engineOptions = er.status === 'fulfilled' ? er.value || [] : [];
      transmissionOptions = tr.status === 'fulfilled' ? tr.value || [] : [];
    } catch {
      engineOptions = [];
      transmissionOptions = [];
    }
  }
  return {
    ...sync,
    modelOptions,
    pcOptions,
    engineOptions,
    transmissionOptions,
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
  const [brandSearchLoading, setBrandSearchLoading] = useState(false);
  const [childLoading, setChildLoading] = useState(false);
  const [detailEdit, setDetailEdit] = useState(emptyDetailEdit);
  const [detailBaselinePayload, setDetailBaselinePayload] = useState('');
  const [detailSaveLoading, setDetailSaveLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      dispatch(fetchVehicles());
    }
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
      setDetailBaselinePayload(serializeUpdatePayload(merged));
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
      setBrandSearchLoading(true);
      try {
        const rows = await dispatch(
          fetchVehicleCatalogManufacturers({ q: term, limit: 80 })
        ).unwrap();
        if (target === 'create') setCreate(setOpts(rows));
        else setDetailEdit(setOpts(rows));
      } catch {
        if (target === 'create') setCreate(clearOpts);
        else setDetailEdit(clearOpts);
      } finally {
        setBrandSearchLoading(false);
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
      catalogTransmissionKey: '',
      modelInput: '',
      generationInput: '',
      engineText: '',
      transmissionText: '',
      modelOptions: [],
      pcOptions: [],
      engineOptions: [],
      transmissionOptions: [],
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
      catalogTransmissionKey: '',
      modelInput: '',
      generationInput: '',
      engineText: '',
      transmissionText: '',
      modelOptions: [],
      pcOptions: [],
      engineOptions: [],
      transmissionOptions: [],
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
      catalogTransmissionKey: '',
      generationInput: '',
      engineText: '',
      transmissionText: '',
      pcOptions: [],
      engineOptions: [],
      transmissionOptions: [],
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
      catalogTransmissionKey: '',
      generationInput: '',
      engineText: '',
      transmissionText: '',
      pcOptions: [],
      engineOptions: [],
      transmissionOptions: [],
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
      catalogTransmissionKey: '',
      engineText: '',
      transmissionText: '',
      engineOptions: [],
      transmissionOptions: [],
    });
    if (target === 'create') setCreate(patch);
    else setDetailEdit(patch);
    setChildLoading(true);
    Promise.allSettled([
      dispatch(fetchVehicleCatalogEngines(id)).unwrap(),
      dispatch(fetchVehicleCatalogTransmissions(id)).unwrap(),
    ])
      .then((results) => {
        const engRows =
          results[0].status === 'fulfilled' ? results[0].value || [] : [];
        const txRows =
          results[1].status === 'fulfilled' ? results[1].value || [] : [];
        const setEngTx = (prev) => ({
          ...prev,
          engineOptions: engRows,
          transmissionOptions: txRows,
        });
        if (target === 'create') setCreate(setEngTx);
        else setDetailEdit(setEngTx);
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
      catalogTransmissionKey: '',
      engineText: '',
      transmissionText: '',
      engineOptions: [],
      transmissionOptions: [],
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

  const pickCatalogTransmission = (tx, idx, target) => {
    const key = transmissionOptionKey(tx, idx);
    const label = transmissionDisplay(tx);
    const patch = (prev) => ({
      ...prev,
      catalogTransmissionKey: key,
      transmissionText: label,
    });
    if (target === 'create') setCreate(patch);
    else setDetailEdit(patch);
  };

  const onCatalogTransmissionInputChange = (e, target) => {
    const val = e.target.value;
    const patch = (prev) => ({
      ...prev,
      transmissionText: val,
      catalogTransmissionKey: '',
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

  const engineOrTxOk = useMemo(() => {
    if (!engineTxEnabled) return false;
    if (usingManufacturerCatalog && create.catalogPassengercarId) {
      const hasLists =
        (create.engineOptions?.length || 0) > 0 ||
        (create.transmissionOptions?.length || 0) > 0;
      if (!hasLists) return true;
      const engOk = create.catalogEngineId != null;
      const txOk =
        create.catalogTransmissionKey && create.catalogTransmissionKey.length > 0;
      return engOk || txOk;
    }
    const engOk = create.engineText && create.engineText.trim().length > 0;
    const txOk = create.transmissionText && create.transmissionText.trim().length > 0;
    return engOk || txOk;
  }, [
    engineTxEnabled,
    usingManufacturerCatalog,
    create.catalogPassengercarId,
    create.engineOptions,
    create.transmissionOptions,
    create.catalogEngineId,
    create.catalogTransmissionKey,
    create.engineText,
    create.transmissionText,
  ]);

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

    let transmissionVal = (create.transmissionText || '').trim();
    if (create.catalogTransmissionKey) {
      const [title, value] = create.catalogTransmissionKey.split('\t');
      transmissionVal = value || title || transmissionVal;
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

    let tecdocTransmissionJson = null;
    if (create.catalogTransmissionKey) {
      const k = create.catalogTransmissionKey;
      const tab = k.indexOf('\t');
      tecdocTransmissionJson =
        tab >= 0
          ? { title: k.slice(0, tab) || null, value: k.slice(tab + 1) || null }
          : { title: null, value: k };
    }

    const payload = {
      brand: create.brandInput.trim(),
      model: modelVal,
      generation: generationVal || null,
      engine: engineVal || null,
      transmission: transmissionVal || null,
      vin: create.vin ? create.vin.trim().toUpperCase() || null : null,
      mileage,
      price,
      photos: (create.vehiclePhotos || []).map((p) => p.tempPath).filter(Boolean),
      tecdoc_transmission_json: tecdocTransmissionJson,
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
      return serializeUpdatePayload(detailEdit) !== detailBaselinePayload;
    } catch {
      return false;
    }
  }, [stockInVehicleModal, mode, detailVehicle?.id, detailEdit, detailBaselinePayload]);

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

    const patch = buildUpdatePayloadFromDraft(detailEdit);

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
          vin: patch.vin,
          mileage: patch.mileage,
          price: patch.price,
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
        setDetailBaselinePayload(serializeUpdatePayload(merged));
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
          <div>
            <span className="text-xs text-gray-500">Марка</span>
            <div className="font-medium">{v.brand}</div>
          </div>
          <div>
            <span className="text-xs text-gray-500">Модель</span>
            <div className="font-medium">{v.model}</div>
          </div>
          <div>
            <span className="text-xs text-gray-500">Поколение</span>
            <div className="font-medium">{v.generation || '—'}</div>
          </div>
          <div>
            <span className="text-xs text-gray-500">Двигатель</span>
            <div className="font-medium">{v.engine || '—'}</div>
          </div>
          <div>
            <span className="text-xs text-gray-500">КПП</span>
            <div className="font-medium">{v.transmission || '—'}</div>
          </div>
          {v.vin && (
            <div>
              <span className="text-xs text-gray-500">VIN</span>
              <div className="font-medium">{v.vin}</div>
            </div>
          )}
          {v.mileage != null && v.mileage !== '' && (
            <div>
              <span className="text-xs text-gray-500">Пробег</span>
              <div className="font-medium">{Number(v.mileage).toLocaleString()} км</div>
            </div>
          )}
          {showPrice && (
            <div>
              <span className="text-xs text-gray-500">Цена</span>
              <div className="font-medium">
                {priceNum.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₽
              </div>
            </div>
          )}
        </div>
        {Array.isArray(v.photos) && v.photos.length > 0 && (
          <div>
            <span className="text-xs text-gray-500 block mb-2">Фото</span>
            <div className="flex flex-wrap gap-2">
              {v.photos.map((ph) => (
                <img
                  key={ph.id ?? ph.photo_path}
                  src={normalizeImageUrl(ph.photo_path)}
                  alt=""
                  className="w-24 h-24 object-cover rounded-lg border"
                />
              ))}
            </div>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Марка *</label>
                      <input
                        type="text"
                        value={detailEdit.brandInput}
                        onChange={(e) => onBrandInputChange(e, 'detail')}
                        className="w-full px-3 py-2 border rounded-md"
                        placeholder="Начните вводить или выберите из списка"
                        autoComplete="off"
                      />
                      {brandSearchLoading && (
                        <div className="text-xs text-gray-500 mt-1">Поиск марок…</div>
                      )}
                      {detailEdit.manufacturerOptions.length > 0 &&
                        detailEdit.catalogManufacturerId == null && (
                        <>
                          {filterManufacturersByInput(
                            detailEdit.manufacturerOptions,
                            detailEdit.brandInput
                          ).length > 0 ? (
                            <ul className="mt-1 max-h-40 overflow-y-auto border rounded-md bg-gray-50 text-sm">
                              {filterManufacturersByInput(
                                detailEdit.manufacturerOptions,
                                detailEdit.brandInput
                              ).map((m) => (
                                <li key={m.id}>
                                  <button
                                    type="button"
                                    className="w-full text-left px-3 py-2 hover:bg-indigo-50"
                                    onClick={() => pickManufacturer(m, 'detail')}
                                  >
                                    {m.description || m.matchcode || m.id}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-1 text-xs text-gray-500">Нет совпадений в списке</p>
                          )}
                        </>
                      )}
                    </div>

                    {detailUsingManufacturerCatalog ? (
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Модель *</label>
                        <input
                          type="text"
                          value={detailEdit.modelInput}
                          onChange={(e) => onCatalogModelInputChange(e, 'detail')}
                          disabled={!detailModelEnabled || childLoading}
                          className="w-full px-3 py-2 border rounded-md disabled:bg-gray-100"
                          placeholder="Начните вводить или выберите из списка"
                          autoComplete="off"
                        />
                        {detailEdit.modelOptions.length > 0 && detailEdit.catalogModelId == null && (
                          <>
                            {filterModelsByInput(detailEdit.modelOptions, detailEdit.modelInput).length >
                            0 ? (
                              <ul className="mt-1 max-h-40 overflow-y-auto border rounded-md bg-gray-50 text-sm">
                                {filterModelsByInput(
                                  detailEdit.modelOptions,
                                  detailEdit.modelInput
                                ).map((m) => (
                                  <li key={m.id}>
                                    <button
                                      type="button"
                                      className="w-full text-left px-3 py-2 hover:bg-indigo-50"
                                      onClick={() => pickCatalogModel(m, 'detail')}
                                    >
                                      {modelOptionLabel(m)}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="mt-1 text-xs text-gray-500">Нет совпадений в списке</p>
                            )}
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Модель *</label>
                        <input
                          type="text"
                          value={detailEdit.modelInput}
                          onChange={(e) =>
                            setDetailEdit((prev) => ({ ...prev, modelInput: e.target.value }))
                          }
                          disabled={!detailModelEnabled}
                          className="w-full px-3 py-2 border rounded-md disabled:bg-gray-100"
                          placeholder="После ввода марки вне справочника"
                        />
                      </div>
                    )}

                    {detailUsingManufacturerCatalog ? (
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Поколение *</label>
                        <input
                          type="text"
                          value={detailEdit.generationInput}
                          onChange={(e) => onPassengercarInputChange(e, 'detail')}
                          disabled={!detailGenerationEnabled || childLoading}
                          className="w-full px-3 py-2 border rounded-md disabled:bg-gray-100"
                          placeholder="Начните вводить или выберите из списка"
                          autoComplete="off"
                        />
                        {detailEdit.pcOptions.length > 0 &&
                          detailEdit.catalogPassengercarId == null && (
                          <>
                            {filterPcByInput(detailEdit.pcOptions, detailEdit.generationInput).length >
                            0 ? (
                              <ul className="mt-1 max-h-40 overflow-y-auto border rounded-md bg-gray-50 text-sm">
                                {filterPcByInput(
                                  detailEdit.pcOptions,
                                  detailEdit.generationInput
                                ).map((p) => (
                                  <li key={p.id}>
                                    <button
                                      type="button"
                                      className="w-full text-left px-3 py-2 hover:bg-indigo-50"
                                      onClick={() => pickPassengercar(p, 'detail')}
                                    >
                                      {pcOptionLabel(p)}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="mt-1 text-xs text-gray-500">Нет совпадений в списке</p>
                            )}
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Поколение *</label>
                        <input
                          type="text"
                          value={detailEdit.generationInput}
                          onChange={(e) =>
                            setDetailEdit((prev) => ({ ...prev, generationInput: e.target.value }))
                          }
                          disabled={!detailGenerationEnabled}
                          className="w-full px-3 py-2 border rounded-md disabled:bg-gray-100"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Двигатель</label>
                      {detailUsingManufacturerCatalog && detailEdit.catalogPassengercarId ? (
                        <>
                          <input
                            type="text"
                            value={detailEdit.engineText}
                            onChange={(e) => onCatalogEngineInputChange(e, 'detail')}
                            disabled={!detailEngineTxEnabled || childLoading}
                            className="w-full px-3 py-2 border rounded-md disabled:bg-gray-100"
                            placeholder="Начните вводить или выберите из списка"
                            autoComplete="off"
                          />
                          {detailEdit.engineOptions.length > 0 && detailEdit.catalogEngineId == null && (
                            <>
                              {filterEnginesByInput(
                                detailEdit.engineOptions,
                                detailEdit.engineText
                              ).length > 0 ? (
                                <ul className="mt-1 max-h-40 overflow-y-auto border rounded-md bg-gray-50 text-sm">
                                  {filterEnginesByInput(
                                    detailEdit.engineOptions,
                                    detailEdit.engineText
                                  ).map((en) => (
                                    <li key={en.id}>
                                      <button
                                        type="button"
                                        className="w-full text-left px-3 py-2 hover:bg-indigo-50"
                                        onClick={() => pickCatalogEngine(en, 'detail')}
                                      >
                                        {engineOptionLabel(en)}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="mt-1 text-xs text-gray-500">Нет совпадений в списке</p>
                              )}
                            </>
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
                          className="w-full px-3 py-2 border rounded-md disabled:bg-gray-100"
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Коробка передач</label>
                      {detailUsingManufacturerCatalog && detailEdit.catalogPassengercarId ? (
                        <>
                          <input
                            type="text"
                            value={detailEdit.transmissionText}
                            onChange={(e) => onCatalogTransmissionInputChange(e, 'detail')}
                            disabled={!detailEngineTxEnabled || childLoading}
                            className="w-full px-3 py-2 border rounded-md disabled:bg-gray-100"
                            placeholder="Начните вводить или выберите из списка"
                            autoComplete="off"
                          />
                          {detailEdit.transmissionOptions.length > 0 &&
                            !detailEdit.catalogTransmissionKey && (
                            <>
                              {filterTransmissionsByInput(
                                detailEdit.transmissionOptions,
                                detailEdit.transmissionText
                              ).length > 0 ? (
                                <ul className="mt-1 max-h-40 overflow-y-auto border rounded-md bg-gray-50 text-sm">
                                  {filterTransmissionsByInput(
                                    detailEdit.transmissionOptions,
                                    detailEdit.transmissionText
                                  ).map((tx, idx) => (
                                    <li key={transmissionOptionKey(tx, idx)}>
                                      <button
                                        type="button"
                                        className="w-full text-left px-3 py-2 hover:bg-indigo-50"
                                        onClick={() => pickCatalogTransmission(tx, idx, 'detail')}
                                      >
                                        {transmissionDisplay(tx)}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="mt-1 text-xs text-gray-500">Нет совпадений в списке</p>
                              )}
                            </>
                          )}
                        </>
                      ) : (
                        <input
                          type="text"
                          value={detailEdit.transmissionText}
                          onChange={(e) =>
                            setDetailEdit((prev) => ({ ...prev, transmissionText: e.target.value }))
                          }
                          disabled={!detailEngineTxEnabled}
                          className="w-full px-3 py-2 border rounded-md disabled:bg-gray-100"
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">VIN</label>
                      <input
                        type="text"
                        value={detailEdit.vin}
                        onChange={(e) =>
                          setDetailEdit((prev) => ({
                            ...prev,
                            vin: e.target.value.toUpperCase(),
                          }))
                        }
                        className="w-full px-3 py-2 border rounded-md uppercase"
                        maxLength={17}
                        placeholder="17 символов"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Пробег (км)</label>
                      <input
                        type="number"
                        value={detailEdit.mileage}
                        onChange={(e) =>
                          setDetailEdit((prev) => ({ ...prev, mileage: e.target.value }))
                        }
                        className="w-full px-3 py-2 border rounded-md"
                        min="0"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Цена автомобиля</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={detailEdit.price}
                        onChange={(e) =>
                          setDetailEdit((prev) => ({ ...prev, price: e.target.value }))
                        }
                        className="w-full px-3 py-2 border rounded-md"
                        placeholder="Необязательно"
                      />
                    </div>
                  </div>
                  {Array.isArray(detailVehicle?.photos) && detailVehicle.photos.length > 0 && (
                    <div>
                      <span className="text-xs text-gray-500 block mb-2">Фото</span>
                      <div className="flex flex-wrap gap-2">
                        {detailVehicle.photos.map((ph) => (
                          <img
                            key={ph.id ?? ph.photo_path}
                            src={normalizeImageUrl(ph.photo_path)}
                            alt=""
                            className="w-24 h-24 object-cover rounded-lg border"
                          />
                        ))}
                      </div>
                    </div>
                  )}
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
              <p className="text-sm text-gray-600 mb-4">
                Заполните поля по шагам. Марку можно выбрать из подсказок или ввести вручную.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Марка *</label>
                  <input
                    type="text"
                    value={create.brandInput}
                    onChange={(e) => onBrandInputChange(e, 'create')}
                    required
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="Начните вводить или выберите из списка"
                    autoComplete="off"
                  />
                  {brandSearchLoading && (
                    <div className="text-xs text-gray-500 mt-1">Поиск марок…</div>
                  )}
                  {create.manufacturerOptions.length > 0 &&
                    create.catalogManufacturerId == null && (
                    <>
                      {filterManufacturersByInput(create.manufacturerOptions, create.brandInput).length >
                        0 ? (
                        <ul className="mt-1 max-h-40 overflow-y-auto border rounded-md bg-gray-50 text-sm">
                          {filterManufacturersByInput(
                            create.manufacturerOptions,
                            create.brandInput
                          ).map((m) => (
                            <li key={m.id}>
                              <button
                                type="button"
                                className="w-full text-left px-3 py-2 hover:bg-indigo-50"
                                onClick={() => pickManufacturer(m, 'create')}
                              >
                                {m.description || m.matchcode || m.id}
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-xs text-gray-500">Нет совпадений в списке</p>
                      )}
                    </>
                  )}
                </div>

                {usingManufacturerCatalog ? (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Модель *</label>
                    <input
                      type="text"
                      value={create.modelInput}
                      onChange={(e) => onCatalogModelInputChange(e, 'create')}
                      disabled={!modelEnabled || childLoading}
                      required
                      className="w-full px-3 py-2 border rounded-md disabled:bg-gray-100"
                      placeholder="Начните вводить или выберите из списка"
                      autoComplete="off"
                    />
                    {create.modelOptions.length > 0 && create.catalogModelId == null && (
                      <>
                        {filterModelsByInput(create.modelOptions, create.modelInput).length > 0 ? (
                          <ul className="mt-1 max-h-40 overflow-y-auto border rounded-md bg-gray-50 text-sm">
                            {filterModelsByInput(create.modelOptions, create.modelInput).map((m) => (
                              <li key={m.id}>
                                <button
                                  type="button"
                                  className="w-full text-left px-3 py-2 hover:bg-indigo-50"
                                  onClick={() => pickCatalogModel(m, 'create')}
                                >
                                  {modelOptionLabel(m)}
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-1 text-xs text-gray-500">Нет совпадений в списке</p>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Модель *</label>
                    <input
                      type="text"
                      value={create.modelInput}
                      onChange={(e) =>
                        setCreate((prev) => ({ ...prev, modelInput: e.target.value }))
                      }
                      disabled={!modelEnabled}
                      required
                      className="w-full px-3 py-2 border rounded-md disabled:bg-gray-100"
                      placeholder="После ввода марки вне справочника"
                    />
                  </div>
                )}

                {usingManufacturerCatalog ? (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Поколение *</label>
                    <input
                      type="text"
                      value={create.generationInput}
                      onChange={(e) => onPassengercarInputChange(e, 'create')}
                      disabled={!generationEnabled || childLoading}
                      required
                      className="w-full px-3 py-2 border rounded-md disabled:bg-gray-100"
                      placeholder="Начните вводить или выберите из списка"
                      autoComplete="off"
                    />
                    {create.pcOptions.length > 0 && create.catalogPassengercarId == null && (
                      <>
                        {filterPcByInput(create.pcOptions, create.generationInput).length > 0 ? (
                          <ul className="mt-1 max-h-40 overflow-y-auto border rounded-md bg-gray-50 text-sm">
                            {filterPcByInput(create.pcOptions, create.generationInput).map((p) => (
                              <li key={p.id}>
                                <button
                                  type="button"
                                  className="w-full text-left px-3 py-2 hover:bg-indigo-50"
                                  onClick={() => pickPassengercar(p, 'create')}
                                >
                                  {pcOptionLabel(p)}
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-1 text-xs text-gray-500">Нет совпадений в списке</p>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Поколение *</label>
                    <input
                      type="text"
                      value={create.generationInput}
                      onChange={(e) =>
                        setCreate((prev) => ({ ...prev, generationInput: e.target.value }))
                      }
                      disabled={!generationEnabled}
                      required
                      className="w-full px-3 py-2 border rounded-md disabled:bg-gray-100"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Двигатель</label>
                  {usingManufacturerCatalog && create.catalogPassengercarId ? (
                    <>
                      <input
                        type="text"
                        value={create.engineText}
                        onChange={(e) => onCatalogEngineInputChange(e, 'create')}
                        disabled={!engineTxEnabled || childLoading}
                        className="w-full px-3 py-2 border rounded-md disabled:bg-gray-100"
                        placeholder="Начните вводить или выберите из списка"
                        autoComplete="off"
                      />
                      {create.engineOptions.length > 0 && create.catalogEngineId == null && (
                        <>
                          {filterEnginesByInput(create.engineOptions, create.engineText).length >
                          0 ? (
                            <ul className="mt-1 max-h-40 overflow-y-auto border rounded-md bg-gray-50 text-sm">
                              {filterEnginesByInput(create.engineOptions, create.engineText).map(
                                (en) => (
                                  <li key={en.id}>
                                    <button
                                      type="button"
                                      className="w-full text-left px-3 py-2 hover:bg-indigo-50"
                                      onClick={() => pickCatalogEngine(en, 'create')}
                                    >
                                      {engineOptionLabel(en)}
                                    </button>
                                  </li>
                                )
                              )}
                            </ul>
                          ) : (
                            <p className="mt-1 text-xs text-gray-500">Нет совпадений в списке</p>
                          )}
                        </>
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
                      className="w-full px-3 py-2 border rounded-md disabled:bg-gray-100"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Коробка передач</label>
                  {usingManufacturerCatalog && create.catalogPassengercarId ? (
                    <>
                      <input
                        type="text"
                        value={create.transmissionText}
                        onChange={(e) => onCatalogTransmissionInputChange(e, 'create')}
                        disabled={!engineTxEnabled || childLoading}
                        className="w-full px-3 py-2 border rounded-md disabled:bg-gray-100"
                        placeholder="Начните вводить или выберите из списка"
                        autoComplete="off"
                      />
                      {create.transmissionOptions.length > 0 && !create.catalogTransmissionKey && (
                        <>
                          {filterTransmissionsByInput(
                            create.transmissionOptions,
                            create.transmissionText
                          ).length > 0 ? (
                            <ul className="mt-1 max-h-40 overflow-y-auto border rounded-md bg-gray-50 text-sm">
                              {filterTransmissionsByInput(
                                create.transmissionOptions,
                                create.transmissionText
                              ).map((tx, idx) => (
                                <li key={transmissionOptionKey(tx, idx)}>
                                  <button
                                    type="button"
                                    className="w-full text-left px-3 py-2 hover:bg-indigo-50"
                                    onClick={() => pickCatalogTransmission(tx, idx, 'create')}
                                  >
                                    {transmissionDisplay(tx)}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-1 text-xs text-gray-500">Нет совпадений в списке</p>
                          )}
                        </>
                      )}
                    </>
                  ) : (
                    <input
                      type="text"
                      value={create.transmissionText}
                      onChange={(e) =>
                        setCreate((prev) => ({ ...prev, transmissionText: e.target.value }))
                      }
                      disabled={!engineTxEnabled}
                      className="w-full px-3 py-2 border rounded-md disabled:bg-gray-100"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">VIN</label>
                  <input
                    type="text"
                    value={create.vin}
                    onChange={(e) =>
                      setCreate((prev) => ({
                        ...prev,
                        vin: e.target.value.toUpperCase(),
                      }))
                    }
                    disabled={!vinEnabled}
                    className="w-full px-3 py-2 border rounded-md uppercase disabled:bg-gray-100"
                    placeholder="17 символов"
                    maxLength={17}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Пробег (км)</label>
                  <input
                    type="number"
                    value={create.mileage}
                    onChange={(e) =>
                      setCreate((prev) => ({ ...prev, mileage: e.target.value }))
                    }
                    disabled={!vinEnabled}
                    className="w-full px-3 py-2 border rounded-md disabled:bg-gray-100"
                    min="0"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Цена автомобиля</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={create.price}
                    onChange={(e) => setCreate((prev) => ({ ...prev, price: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="Необязательно"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Фото (до {MAX_VEHICLE_PHOTOS})
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleVehiclePhotosAdd}
                    className="block w-full text-sm text-gray-600"
                  />
                  {(create.vehiclePhotos?.length || 0) > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {create.vehiclePhotos.map((ph, idx) => (
                        <div key={`${ph.tempPath}-${idx}`} className="relative w-20 h-20 border rounded overflow-hidden">
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
