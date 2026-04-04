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

const vehicleToDetailForm = (v) => ({
  brand: v?.brand || '',
  model: v?.model || '',
  generation: v?.generation || '',
  engine: v?.engine || '',
  transmission: v?.transmission || '',
  vin: (v?.vin || '').toUpperCase(),
  mileage: v?.mileage != null && v?.mileage !== '' ? String(v.mileage) : '',
  price:
    v?.price != null && v?.price !== ''
      ? String(v.price).replace('.', ',')
      : '',
});

const normalizeDetailForCompare = (f) => ({
  brand: (f.brand || '').trim(),
  model: (f.model || '').trim(),
  generation: (f.generation || '').trim(),
  engine: (f.engine || '').trim(),
  transmission: (f.transmission || '').trim(),
  vin: (f.vin || '').trim().toUpperCase(),
  mileage: (f.mileage || '').trim(),
  price: (f.price || '').trim().replace(',', '.'),
});

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
  const [detailEditForm, setDetailEditForm] = useState(() => vehicleToDetailForm({}));
  const [detailEditBaseline, setDetailEditBaseline] = useState(() => vehicleToDetailForm({}));
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
    const f = vehicleToDetailForm(detailVehicle);
    setDetailEditForm(f);
    setDetailEditBaseline({ ...f });
  }, [isOpen, stockInVehicleModal, mode, detailVehicle?.id]);

  useEffect(() => {
    if (isOpen && mode === 'create') {
      setCreate(emptyCreate());
    }
  }, [isOpen, mode]);

  const runBrandSearch = useCallback(
    async (q) => {
      const term = (q || '').trim();
      if (!term) {
        setCreate((prev) => ({ ...prev, manufacturerOptions: [] }));
        return;
      }
      setBrandSearchLoading(true);
      try {
        const rows = await dispatch(
          fetchVehicleCatalogManufacturers({ q: term, limit: 80 })
        ).unwrap();
        setCreate((prev) => ({ ...prev, manufacturerOptions: rows || [] }));
      } catch {
        setCreate((prev) => ({ ...prev, manufacturerOptions: [] }));
      } finally {
        setBrandSearchLoading(false);
      }
    },
    [dispatch]
  );

  useEffect(() => {
    if (mode !== 'create') return;
    const t = setTimeout(() => runBrandSearch(create.brandInput), 320);
    return () => clearTimeout(t);
  }, [create.brandInput, mode, runBrandSearch]);

  const pickManufacturer = (row) => {
    setCreate((prev) => ({
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
    }));
    setChildLoading(true);
    dispatch(fetchVehicleCatalogModels(row.id))
      .unwrap()
      .then((rows) => {
        setCreate((prev) => ({ ...prev, modelOptions: rows || [] }));
      })
      .catch(() =>
        setCreate((prev) => ({ ...prev, modelOptions: [] }))
      )
      .finally(() => setChildLoading(false));
  };

  const onBrandInputChange = (e) => {
    const v = e.target.value;
    setCreate((prev) => ({
      ...prev,
      brandInput: v,
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
    }));
  };

  const onCatalogModelChange = (e) => {
    const id = parseInt(e.target.value, 10);
    if (!id) return;
    setCreate((prev) => ({
      ...prev,
      catalogModelId: id,
      catalogPassengercarId: null,
      catalogEngineId: null,
      catalogTransmissionKey: '',
      generationInput: '',
      engineText: '',
      transmissionText: '',
      pcOptions: [],
      engineOptions: [],
      transmissionOptions: [],
    }));
    setChildLoading(true);
    dispatch(fetchVehicleCatalogPassengercars(id))
      .unwrap()
      .then((rows) => setCreate((prev) => ({ ...prev, pcOptions: rows || [] })))
      .catch(() => setCreate((prev) => ({ ...prev, pcOptions: [] })))
      .finally(() => setChildLoading(false));
  };

  const onPassengercarChange = (e) => {
    const id = parseInt(e.target.value, 10);
    if (!id) return;
    setCreate((prev) => ({
      ...prev,
      catalogPassengercarId: id,
      catalogEngineId: null,
      catalogTransmissionKey: '',
      engineText: '',
      transmissionText: '',
      engineOptions: [],
      transmissionOptions: [],
    }));
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
        setCreate((prev) => ({
          ...prev,
          engineOptions: engRows,
          transmissionOptions: txRows,
        }));
      })
      .finally(() => setChildLoading(false));
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
    return (
      JSON.stringify(normalizeDetailForCompare(detailEditForm)) !==
      JSON.stringify(normalizeDetailForCompare(detailEditBaseline))
    );
  }, [stockInVehicleModal, mode, detailVehicle?.id, detailEditForm, detailEditBaseline]);

  const handleStockInSaveDetail = async () => {
    if (!detailVehicle?.id) return;
    if (!detailEditForm.brand.trim() || !detailEditForm.model.trim()) {
      alert('Укажите марку и модель');
      return;
    }
    const vinVal = detailEditForm.vin.trim();
    if (vinVal && vinVal.length !== 17) {
      alert('VIN должен содержать ровно 17 символов');
      return;
    }
    const mileageStr = detailEditForm.mileage.trim();
    let mileage = null;
    if (mileageStr !== '') {
      const n = parseInt(mileageStr, 10);
      if (Number.isNaN(n)) {
        alert('Некорректный пробег');
        return;
      }
      mileage = n;
    }
    const priceStr = detailEditForm.price.trim().replace(',', '.');
    let price = null;
    if (priceStr !== '') {
      const n = parseFloat(priceStr);
      if (Number.isNaN(n)) {
        alert('Некорректная цена');
        return;
      }
      price = n;
    }

    setDetailSaveLoading(true);
    try {
      const result = await dispatch(
        updateVehicle({
          id: detailVehicle.id,
          brand: detailEditForm.brand.trim(),
          model: detailEditForm.model.trim(),
          generation: detailEditForm.generation.trim() || null,
          engine: detailEditForm.engine.trim() || null,
          transmission: detailEditForm.transmission.trim() || null,
          vin: vinVal ? vinVal : null,
          mileage: mileageStr === '' ? null : mileage,
          price,
        })
      );
      if (updateVehicle.fulfilled.match(result)) {
        const updated = result.payload;
        setDetailVehicle(updated);
        const f = vehicleToDetailForm(updated);
        setDetailEditForm(f);
        setDetailEditBaseline({ ...f });
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Марка</label>
                      <input
                        type="text"
                        value={detailEditForm.brand}
                        onChange={(e) =>
                          setDetailEditForm((prev) => ({ ...prev, brand: e.target.value }))
                        }
                        className="w-full px-3 py-2 border rounded-md text-sm font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Модель</label>
                      <input
                        type="text"
                        value={detailEditForm.model}
                        onChange={(e) =>
                          setDetailEditForm((prev) => ({ ...prev, model: e.target.value }))
                        }
                        className="w-full px-3 py-2 border rounded-md text-sm font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Поколение</label>
                      <input
                        type="text"
                        value={detailEditForm.generation}
                        onChange={(e) =>
                          setDetailEditForm((prev) => ({ ...prev, generation: e.target.value }))
                        }
                        className="w-full px-3 py-2 border rounded-md text-sm font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Двигатель</label>
                      <input
                        type="text"
                        value={detailEditForm.engine}
                        onChange={(e) =>
                          setDetailEditForm((prev) => ({ ...prev, engine: e.target.value }))
                        }
                        className="w-full px-3 py-2 border rounded-md text-sm font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">КПП</label>
                      <input
                        type="text"
                        value={detailEditForm.transmission}
                        onChange={(e) =>
                          setDetailEditForm((prev) => ({ ...prev, transmission: e.target.value }))
                        }
                        className="w-full px-3 py-2 border rounded-md text-sm font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">VIN</label>
                      <input
                        type="text"
                        value={detailEditForm.vin}
                        onChange={(e) =>
                          setDetailEditForm((prev) => ({
                            ...prev,
                            vin: e.target.value.toUpperCase(),
                          }))
                        }
                        className="w-full px-3 py-2 border rounded-md text-sm font-medium uppercase"
                        maxLength={17}
                        placeholder="17 символов"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Пробег (км)</label>
                      <input
                        type="number"
                        value={detailEditForm.mileage}
                        onChange={(e) =>
                          setDetailEditForm((prev) => ({ ...prev, mileage: e.target.value }))
                        }
                        className="w-full px-3 py-2 border rounded-md text-sm font-medium"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Цена</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={detailEditForm.price}
                        onChange={(e) =>
                          setDetailEditForm((prev) => ({ ...prev, price: e.target.value }))
                        }
                        className="w-full px-3 py-2 border rounded-md text-sm font-medium"
                        placeholder="₽"
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
                    onChange={onBrandInputChange}
                    required
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="Начните вводить или выберите из списка"
                    autoComplete="off"
                  />
                  {brandSearchLoading && (
                    <div className="text-xs text-gray-500 mt-1">Поиск марок…</div>
                  )}
                  {create.manufacturerOptions.length > 0 && (
                    <ul className="mt-1 max-h-40 overflow-y-auto border rounded-md bg-gray-50 text-sm">
                      {create.manufacturerOptions.map((m) => (
                        <li key={m.id}>
                          <button
                            type="button"
                            className="w-full text-left px-3 py-2 hover:bg-indigo-50"
                            onClick={() => pickManufacturer(m)}
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Модель *</label>
                    <select
                      className="w-full px-3 py-2 border rounded-md"
                      disabled={!modelEnabled || childLoading}
                      value={create.catalogModelId || ''}
                      onChange={onCatalogModelChange}
                      required
                    >
                      <option value="">— выберите модель —</option>
                      {create.modelOptions.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.description ||
                            [m.from_year, m.to_year].filter(Boolean).join('–') ||
                            m.id}
                        </option>
                      ))}
                    </select>
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
                    <select
                      className="w-full px-3 py-2 border rounded-md"
                      disabled={!generationEnabled || childLoading}
                      value={create.catalogPassengercarId || ''}
                      onChange={onPassengercarChange}
                      required
                    >
                      <option value="">— выберите поколение —</option>
                      {create.pcOptions.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.full_description || p.description || p.id}
                        </option>
                      ))}
                    </select>
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
                    <select
                      className="w-full px-3 py-2 border rounded-md"
                      disabled={!engineTxEnabled || childLoading}
                      value={create.catalogEngineId || ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        setCreate((prev) => ({
                          ...prev,
                          catalogEngineId: v ? parseInt(v, 10) : null,
                        }));
                      }}
                    >
                      <option value="">— из каталога —</option>
                      {create.engineOptions.map((en) => (
                        <option key={en.id} value={en.id}>
                          {en.sales_description || en.description || en.id}
                        </option>
                      ))}
                    </select>
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
                    <select
                      className="w-full px-3 py-2 border rounded-md"
                      disabled={!engineTxEnabled || childLoading}
                      value={create.catalogTransmissionKey}
                      onChange={(e) =>
                        setCreate((prev) => ({
                          ...prev,
                          catalogTransmissionKey: e.target.value,
                        }))
                      }
                    >
                      <option value="">— из каталога —</option>
                      {create.transmissionOptions.map((tx, idx) => {
                        const key = `${tx.title || ''}\t${tx.value}`.trim() || `tx-${idx}`;
                        return (
                          <option key={key} value={key}>
                            {tx.title ? `${tx.title}: ${tx.value}` : tx.value}
                          </option>
                        );
                      })}
                    </select>
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
