import { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { apiAxios } from '../../utils/apiClient';

const MM_TO_PX = 96 / 25.4;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function useElementSize(ref) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };

    update();

    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return size;
}

function LabelPreview({ widthMm, heightMm }) {
  const frameRef = useRef(null);
  const frameSize = useElementSize(frameRef);

  const framePadding = 12; // px (p-3)
  const designMm = useMemo(() => ({ w: 58, h: 38 }), []);

  const basePx = useMemo(() => {
    const w = Math.max(1, Number(widthMm) || 0) * MM_TO_PX;
    const h = Math.max(1, Number(heightMm) || 0) * MM_TO_PX;
    return { w, h };
  }, [widthMm, heightMm]);

  const contentScale = useMemo(() => {
    const w = Math.max(1, Number(widthMm) || 0);
    const h = Math.max(1, Number(heightMm) || 0);
    return clamp(Math.min(w / designMm.w, h / designMm.h), 0.05, 10);
  }, [widthMm, heightMm, designMm.h, designMm.w]);

  const scale = useMemo(() => {
    if (!frameSize.width || !frameSize.height) return 1;
    // Предпросмотр должен вмещаться целиком и по возможности занимать максимум места:
    // допускаем увеличение, но всё равно держим в рамках контейнера.
    const availableW = Math.max(1, frameSize.width - framePadding * 2);
    const availableH = Math.max(1, frameSize.height - framePadding * 2);
    const k = Math.min(availableW / basePx.w, availableH / basePx.h);
    return clamp(k, 0.05, 10);
  }, [frameSize.width, frameSize.height, basePx.w, basePx.h]);

  return (
    <div
      ref={frameRef}
      className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-auto"
      style={{ height: 260 }}
    >
      <div
        className="bg-white border border-black box-border"
        style={{
          width: basePx.w,
          height: basePx.h,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          overflow: 'hidden',
        }}
      >
        {/* Масштабируем контент под указанные размеры */}
        <div
          style={{
            width: `${designMm.w * MM_TO_PX}px`,
            height: `${designMm.h * MM_TO_PX}px`,
            transform: `scale(${contentScale})`,
            transformOrigin: 'top left',
            padding: 8,
            boxSizing: 'border-box',
          }}
        >
          <div className="flex items-start gap-3 h-full">
            <div className="flex-1 min-w-0 text-black">
              <div className="mb-1.5">
                <div className="text-[8px] font-bold leading-tight">Бренд</div>
                <div className="text-[11px] leading-tight break-words">BOSCH</div>
              </div>
              <div className="mb-1.5">
                <div className="text-[8px] font-bold leading-tight">Артикул</div>
                <div className="text-[11px] leading-tight break-words">0 986 479 123</div>
              </div>
              <div className="mb-1.5">
                <div className="text-[8px] font-bold leading-tight">Адресное хранение</div>
                <div className="text-[9px] leading-tight break-words">A-01-02-03</div>
              </div>
              <div className="mb-1.5">
                <div className="text-[8px] font-bold leading-tight">Наименование</div>
                <div className="text-[9px] leading-tight break-words">Тормозные колодки передние</div>
              </div>
            </div>

              <div className="shrink-0 flex flex-col items-center">
                <div className="w-[56px] h-[56px] bg-black" aria-label="QR placeholder" />
                <div className="mt-1 text-[9px] leading-tight text-black text-center whitespace-nowrap">Цена: 1 250 ₽</div>
                <div className="mt-0.5 text-[8px] leading-tight text-black text-center whitespace-nowrap">Код: INT-0000123</div>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LabelPrintSection() {
  const user = useSelector((state) => state.auth.user);
  const isDirector = Boolean(user?.is_director);

  const defaults = useMemo(() => ({ w: 58, h: 38 }), []);

  const [widthMm, setWidthMm] = useState(defaults.w);
  const [heightMm, setHeightMm] = useState(defaults.h);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [selectedPrinterId, setSelectedPrinterId] = useState('');
  const [connectedPrinters, setConnectedPrinters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [printingTest, setPrintingTest] = useState(false);

  const reloadFromPermissions = async () => {
    const myRes = await apiAxios.get('/printers/me/permissions');
    const perms = myRes.data || [];
    const current = (perms || []).find((p) => p?.is_current) || perms?.[0];
    const printerId = current?.printer_id ? String(current.printer_id) : '';
    setSelectedPrinterId(printerId);
    setWidthMm(Number(current?.label_width_mm ?? defaults.w));
    setHeightMm(Number(current?.label_height_mm ?? defaults.h));
  };

  useEffect(() => {
    const load = async () => {
      if (!user?.organization_id) return;
      setLoading(true);
      setSaveError(null);
      try {
        const [connectedRes, myRes] = await Promise.all([
          apiAxios.get('/printers/connected'),
          apiAxios.get('/printers/me/permissions'),
        ]);

        const connected = connectedRes.data || [];
        const perms = myRes.data || [];
        setConnectedPrinters(connected);

        const current = (perms || []).find((p) => p?.is_current) || perms?.[0];
        const printerId = current?.printer_id ? String(current.printer_id) : '';
        setSelectedPrinterId(printerId);

        setWidthMm(Number(current?.label_width_mm ?? defaults.w));
        setHeightMm(Number(current?.label_height_mm ?? defaults.h));
      } catch (e) {
        setSaveError(e?.response?.data?.detail || 'Ошибка при загрузке настроек печати');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.organization_id, defaults.h, defaults.w]);

  const canSave = isDirector && user?.organization_id && selectedPrinterId && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setSaveError(null);
    try {
      await apiAxios.put(`/printers/id/${selectedPrinterId}/label-settings`, {
        label_width_mm: Math.max(1, Math.round(Number(widthMm) || defaults.w)),
        label_height_mm: Math.max(1, Math.round(Number(heightMm) || defaults.h)),
      });
    } catch (e) {
      setSaveError(e?.response?.data?.detail || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectPrinter = async (printerId) => {
    setSelectedPrinterId(printerId);
    if (!printerId) return;
    setLoading(true);
    setSaveError(null);
    try {
      // Делает выбранный принтер текущим (is_current=true) для пользователя
      await apiAxios.post(`/printers/id/${printerId}/grant`);
      await reloadFromPermissions();
    } catch (e) {
      setSaveError(e?.response?.data?.detail || 'Ошибка при выборе принтера');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintTestLabel = async () => {
    if (!selectedPrinterId) return;
    setPrintingTest(true);
    setSaveError(null);
    try {
      // Сервер сгенерирует PDF по label_print.html и отправит агенту
      await apiAxios.post(`/printers/id/${selectedPrinterId}/print-test-label`);
    } catch (e) {
      setSaveError(e?.response?.data?.detail || 'Ошибка печати пробной этикетки');
    } finally {
      setPrintingTest(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 text-indigo-600 rounded-full p-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17h10M7 13h10M7 9h10M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-800">Печать (Этикетка)</h3>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handlePrintTestLabel}
            disabled={!selectedPrinterId || printingTest}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedPrinterId && !printingTest
                ? 'bg-white border border-gray-300 text-gray-800 hover:bg-gray-50'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }`}
          >
            {printingTest ? 'Печатаю…' : 'Печать пробной этикетки'}
          </button>

          <button
            onClick={handleSave}
            disabled={!canSave}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-medium transition-colors ${
              canSave ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }`}
          >
            {saving ? 'Сохраняю…' : 'Сохранить'}
          </button>
        </div>
      </div>

      {saveError && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {typeof saveError === 'string' ? saveError : (saveError?.detail || 'Ошибка сохранения')}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Принтер</label>
            <select
              value={selectedPrinterId}
              onChange={(e) => handleSelectPrinter(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100"
            >
              <option value="">Выберите принтер</option>
              {connectedPrinters.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.is_default ? '(По умолчанию)' : ''}
                </option>
              ))}
            </select>
            {!selectedPrinterId && (
              <div className="text-xs text-gray-500 mt-1">Выберите принтер в разделе "Печать (Принтеры)" или здесь.</div>
            )}
          </div>
      
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ширина (мм)</label>
              <input
                type="number"
                min={10}
                step={1}
                value={widthMm}
                onChange={(e) => setWidthMm(e.target.value)}
                disabled={!isDirector || !selectedPrinterId}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Высота (мм)</label>
              <input
                type="number"
                min={10}
                step={1}
                value={heightMm}
                onChange={(e) => setHeightMm(e.target.value)}
                disabled={!isDirector || !selectedPrinterId}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
              />
            </div>
          </div>
        </div>
      
        <div>
          <div className="text-sm font-medium text-gray-700 mb-2">Предпросмотр ({widthMm}×{heightMm}mm)</div>
          <LabelPreview widthMm={widthMm} heightMm={heightMm} />
        </div>
      </div>
    </div>
  );
}

