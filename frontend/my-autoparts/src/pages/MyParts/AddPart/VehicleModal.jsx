import { useDispatch, useSelector } from 'react-redux';
import { useEffect, useState } from 'react';
import { fetchVehicles, createVehicle } from '../../../redux/slices/ProductSlice'; // 👈 импорт createVehicle

const VehicleModal = ({ isOpen, onClose, onSelectVehicle, selectedVehicle = null }) => {
  const dispatch = useDispatch();
  const { vehicles, vehiclesLoading, error } = useSelector(state => state.products);

  const [mode, setMode] = useState('select');
  const [formData, setFormData] = useState({
    brand: '',
    model: '',
    generation: '',
    engine: '',
    transmission: '',
    vin: '',
    mileage: '',
  });

  useEffect(() => {
    if (isOpen && mode === 'select') {
      dispatch(fetchVehicles());
    }
  }, [isOpen, mode, dispatch]);

  const handleSelect = (vehicle) => {
    onSelectVehicle(vehicle);
    onClose();
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (formData.vin && formData.vin.length !== 17) {
      alert('VIN должен содержать ровно 17 символов');
      return;
    }

    // Отправляем на бэкенд
    const result = await dispatch(createVehicle(formData));

    if (createVehicle.fulfilled.match(result)) {
      // Передаём реальный объект из БД (с id)
      onSelectVehicle(result.payload);
      onClose();
      setFormData({
        brand: '',
        model: '',
        generation: '',
        engine: '',
        transmission: '',
        vin: '',
        mileage: '',
      });
    } else {
      // Ошибка уже в state.error, можно показать alert
      alert(result.payload || 'Не удалось создать автомобиль');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold">
            {mode === 'select' ? 'Выберите автомобиль' : 'Добавить автомобиль'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
        </div>

        <div className="p-4">
          {mode === 'select' ? (
            <div>
              <div className="flex justify-end mb-4">
                <button
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
                      className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition"
                      onClick={() => handleSelect(vehicle)}
                    >
                      <div className="font-medium">{vehicle.brand} {vehicle.model}</div>
                      <div className="text-sm text-gray-600">
                        {vehicle.generation} • {vehicle.engine} • {vehicle.transmission}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-2">
                        {vehicle.vin && <span>VIN: {vehicle.vin}</span>}
                        {vehicle.mileage && <span>Пробег: {vehicle.mileage.toLocaleString()} км</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleCreate}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Марка */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Марка *
                  </label>
                  <input
                    type="text"
                    name="brand"
                    value={formData.brand}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="Toyota, BMW..."
                  />
                </div>

                {/* Модель */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Модель *
                  </label>
                  <input
                    type="text"
                    name="model"
                    value={formData.model}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="Camry, X5..."
                  />
                </div>

                {/* Поколение (год) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Поколение (год) *
                  </label>
                  <input
                    type="text"
                    name="generation"
                    value={formData.generation}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="2018-2023"
                  />
                </div>

                {/* Двигатель */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Двигатель *
                  </label>
                  <input
                    type="text"
                    name="engine"
                    value={formData.engine}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="2.5L, 1.6L..."
                  />
                </div>

                {/* Коробка передач - ТЕКСТОВОЕ ПОЛЕ */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Коробка передач *
                  </label>
                  <input
                    type="text"
                    name="transmission"
                    value={formData.transmission}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="АКПП, МКПП, вариатор..."
                  />
                </div>

                {/* VIN */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    VIN (опционально)
                  </label>
                  <input
                    type="text"
                    name="vin"
                    value={formData.vin}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-md uppercase"
                    placeholder="17 символов"
                    maxLength={17}
                  />
                </div>

                {/* Пробег */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Пробег (км, опционально)
                  </label>
                  <input
                    type="number"
                    name="mileage"
                    value={formData.mileage}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="150000"
                    min="0"
                  />
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
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
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