import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { 
  fetchAvailablePrinters, 
  sendPrintJob, 
  selectAvailablePrinters, 
  selectFetchingPrinters, 
  selectSendingPrint, 
  selectPrintersError,
  clearError 
} from '../../../redux/slices/PrinterSlice';

const PrintReceiptModal = ({ 
  isOpen, 
  onClose, 
  selectedPart,
  productStorageCells = []  // Добавили проп для ячеек
}) => {
  const dispatch = useDispatch();
  const printers = useSelector(selectAvailablePrinters);
  const loading = useSelector(selectFetchingPrinters);
  const error = useSelector(selectPrintersError);
  const printing = useSelector(selectSendingPrint);
  
  const [printerSettings, setPrinterSettings] = useState({
    printer: '',
    height: '30',  // По умолчанию 30mm
    width: '38',   // По умолчанию 38mm
    copies: '1'
  });
  const [showPreview, setShowPreview] = useState(false);

  // Fetch available printers when modal opens
  useEffect(() => {
    if (isOpen) {
      dispatch(fetchAvailablePrinters());
    }
    
    // Cleanup on close
    return () => {
      dispatch(clearError());
    };
  }, [isOpen, dispatch]);

  if (!isOpen) return null;

  const handleSettingChange = (field, value) => {
    setPrinterSettings(prev => ({ ...prev, [field]: value }));
  };

  const handlePrint = async () => {
    if (!printerSettings.printer) {
      alert('Выберите принтер');
      return;
    }

    // Generate receipt content
    const receiptContent = generateReceiptContent();
    
    // Dispatch the print job action
    const result = await dispatch(sendPrintJob({
      printerId: printerSettings.printer,
      content: receiptContent,
      copies: parseInt(printerSettings.copies),
      settings: {
        height: printerSettings.height,
        width: printerSettings.width
      }
    })).unwrap();
    
    if (result) {
      alert(`Задача печати отправлена!\nID задачи: ${result.job_id}`);
      onClose();
    }
  };

  const generateReceiptContent = () => {
    if (!selectedPart) return '';
    
    // Генерируем ОЧЕНЬ компактный текст для термопринтера Clabel
    // Используем только одну строку на поле, чтобы уместить всё на 30mm
    let receipt = '';
    
    const lines = [];
    
    // Бренд + Артикул в одной строке (экономим место)
    if (selectedPart.brand || selectedPart.article) {
      const brandArticle = [selectedPart.brand || '', selectedPart.article || '']
        .filter(Boolean)
        .join(' ');
      lines.push(brandArticle);
    }
    
    // Наименование (коротко)
    if (selectedPart.name) {
      // Обрезаем длинные названия до 25 символов
      const shortName = selectedPart.name.length > 25 
        ? selectedPart.name.substring(0, 22) + '...' 
        : selectedPart.name;
      lines.push(shortName);
    }
    
    // Адрес хранения (ячейки через точку с запятой, коротко)
    if (productStorageCells && productStorageCells.length > 0) {
      const cellsText = productStorageCells
        .map(cell => cell.value || cell.id || '')
        .filter(value => value)
        .join(';');
      if (cellsText) {
        // Обрезаем если слишком длинный
        const shortCells = cellsText.length > 20 
          ? cellsText.substring(0, 17) + '...' 
          : cellsText;
        lines.push(shortCells);
      }
    }
    
    // Внутренний код + Цена в одной строке (экономим место)
    const codeAndPrice = [];
    if (selectedPart.internal_code) {
      const codeText = typeof selectedPart.internal_code === 'object'
        ? (selectedPart.internal_code.code || selectedPart.internal_code.id || '')
        : selectedPart.internal_code;
      if (codeText) {
        codeAndPrice.push(codeText);
      }
    }
    if (selectedPart.price != null) {
      codeAndPrice.push(`${parseFloat(selectedPart.price).toFixed(2)}₽`);
    }
    if (codeAndPrice.length > 0) {
      lines.push(codeAndPrice.join(' '));
    }
    
    // Формируем итоговый текст - только переносы строк, без возврата каретки
    receipt = lines.join('\n');
    
    return receipt;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl">
        <div className="p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            Печать чека
          </h2>

          {selectedPart && (
            <div className="text-sm text-gray-600 mb-4">
              <div><strong>Бренд:</strong> {selectedPart.brand || '—'}</div>
              <div><strong>Артикул:</strong> {selectedPart.article || '—'}</div>
              <div><strong>Наименование:</strong> {selectedPart.name || '—'}</div>
              {selectedPart.storage_location && (
                <div><strong>Хранение:</strong> 
                  {typeof selectedPart.storage_location === 'object' 
                    ? (selectedPart.storage_location.address || selectedPart.storage_location.id || '—') 
                    : selectedPart.storage_location}
                </div>
              )}
              {selectedPart.internal_code && (
                <div><strong>Код:</strong> 
                  {typeof selectedPart.internal_code === 'object' 
                    ? (selectedPart.internal_code.code || selectedPart.internal_code.id || '—') 
                    : selectedPart.internal_code}
                </div>
              )}
              <div><strong>Цена:</strong> {selectedPart.price != null ? `${parseFloat(selectedPart.price).toFixed(2)} ₽` : '—'}</div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left column - Settings */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Выбор принтера
                </label>
                {loading ? (
                  <div className="text-sm text-gray-500">Загрузка списка принтеров...</div>
                ) : error ? (
                  <div className="text-sm text-red-600">{error}</div>
                ) : printers.length === 0 ? (
                  <div className="text-sm text-orange-600">
                    Принтеры не найдены или у вас нет доступа.
                    Выберите принтер в настройках организации и убедитесь, что агент запущен.
                    <button 
                      onClick={() => dispatch(fetchAvailablePrinters())}
                      className="ml-2 text-indigo-600 underline hover:text-indigo-800"
                    >
                      Обновить
                    </button>
                  </div>
                ) : (
                  <select
                    value={printerSettings.printer}
                    onChange={(e) => handleSettingChange('printer', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Выберите принтер</option>
                    {printers.map((printer) => (
                      <option key={printer.id} value={printer.id}>
                        {printer.name} {printer.is_default ? '(По умолчанию)' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Высота чека (мм)
                </label>
                <input
                  type="number"
                  min="1"
                  value={printerSettings.height}
                  onChange={(e) => handleSettingChange('height', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ширина чека (мм)
                </label>
                <input
                  type="number"
                  min="1"
                  value={printerSettings.width}
                  onChange={(e) => handleSettingChange('width', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Количество копий
                </label>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={printerSettings.copies}
                  onChange={(e) => handleSettingChange('copies', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div className="pt-4">
                <button
                  onClick={handlePrint}
                  disabled={!printerSettings.printer || printing}
                  className={`w-full px-4 py-2 rounded-md font-medium transition ${
                    !printerSettings.printer || printing
                      ? 'bg-indigo-400 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  {printing ? 'Отправка...' : 'Распечатать'}
                </button>
              </div>
            </div>

            {/* Right column - Preview */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Предпросмотр чека
              </label>
              <div className="border border-gray-300 rounded-md p-4 bg-white">
                <div 
                  className="mx-auto bg-white overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
                  style={{ 
                    width: `${printerSettings.width}mm`,
                    minHeight: `${printerSettings.height}mm`,
                    maxWidth: '100%'
                  }}
                  onClick={() => setShowPreview(true)}
                >
                  {/* Receipt Preview Content - Ultra Compact */}
                  <div className="text-[9px] leading-tight space-y-0 p-1">
                    {selectedPart?.brand && (
                      <div className="font-semibold text-[10px] leading-none mb-0.5">{selectedPart.brand}</div>
                    )}
                    {selectedPart?.article && (
                      <div className="text-[9px] leading-none mb-0.5">{selectedPart.article}</div>
                    )}
                    {selectedPart?.name && (
                      <div className="text-[9px] truncate leading-none mb-0.5">{selectedPart.name}</div>
                    )}
                    {productStorageCells && productStorageCells.length > 0 && (
                      <div className="text-[9px] text-gray-600 truncate leading-none mb-0.5">
                        {productStorageCells
                          .map(cell => cell.value || cell.id || '')
                          .filter(value => value)
                          .join(';')}
                      </div>
                    )}
                    {selectedPart?.internal_code && (
                      <div className="text-[9px] text-gray-600 leading-none mb-0.5">
                        {typeof selectedPart.internal_code === 'object' 
                          ? (selectedPart.internal_code.code || selectedPart.internal_code.id || '') 
                          : selectedPart.internal_code}
                      </div>
                    )}
                    {selectedPart?.price != null && (
                      <div className="font-bold text-[10px] leading-none mt-0.5">
                        {parseFloat(selectedPart.price).toFixed(2)}₽
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <p className="text-xs text-gray-500 mt-2">
                * Размеры и вид предпросмотра являются приблизительными
              </p>
              <p className="text-xs text-indigo-600 mt-1 cursor-pointer hover:text-indigo-800" onClick={() => setShowPreview(true)}>
                ↗ Нажмите для увеличения
              </p>
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>

      {/* Full-screen Preview Modal - Similar to MediaModal */}
      {showPreview && selectedPart && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center"
          onClick={() => setShowPreview(false)}
        >
          {/* Close button */}
          <button
            onClick={() => setShowPreview(false)}
            className="absolute top-4 right-4 text-white text-4xl hover:text-gray-300 z-10"
          >
            ×
          </button>

          {/* Enlarged Preview Content */}
          <div 
            className="max-w-full max-h-full p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div 
              className="bg-white mx-auto overflow-hidden shadow-2xl rounded-lg"
              style={{ 
                width: `${printerSettings.width}mm`,
                minHeight: `${printerSettings.height}mm`,
                transform: 'scale(2)',
                transformOrigin: 'center center'
              }}
            >
              {/* Receipt Preview Content - Ultra Compact (Enlarged) */}
              <div className="text-[9px] leading-tight space-y-0 p-1">
                {selectedPart?.brand && (
                  <div className="font-semibold text-[10px] leading-none mb-0.5">{selectedPart.brand}</div>
                )}
                {selectedPart?.article && (
                  <div className="text-[9px] leading-none mb-0.5">{selectedPart.article}</div>
                )}
                {selectedPart?.name && (
                  <div className="text-[9px] truncate leading-none mb-0.5">{selectedPart.name}</div>
                )}
                {productStorageCells && productStorageCells.length > 0 && (
                  <div className="text-[9px] text-gray-600 truncate leading-none mb-0.5">
                    {productStorageCells
                      .map(cell => cell.value || cell.id || '')
                      .filter(value => value)
                      .join(';')}
                  </div>
                )}
                {selectedPart?.internal_code && (
                  <div className="text-[9px] text-gray-600 leading-none mb-0.5">
                    {typeof selectedPart.internal_code === 'object' 
                      ? (selectedPart.internal_code.code || selectedPart.internal_code.id || '') 
                      : selectedPart.internal_code}
                  </div>
                )}
                {selectedPart?.price != null && (
                  <div className="font-bold text-[10px] leading-none mt-0.5">
                    {parseFloat(selectedPart.price).toFixed(2)}₽
                  </div>
                )}
              </div>
            </div>
            
            {/* Info text */}
            <div className="text-white text-center mt-4 text-lg">
              Предпросмотр печати (масштаб 2x)
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrintReceiptModal;
