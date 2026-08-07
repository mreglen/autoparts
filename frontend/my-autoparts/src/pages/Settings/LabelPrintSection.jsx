import { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { apiAxios } from '../../utils/apiClient';
import LabelStorageCellsPreview from '../../components/LabelPrint/LabelStorageCellsPreview';
import {
  warehousePillControlClass,
  warehousePrimaryButtonClass,
  warehouseSecondaryButtonClass,
} from '../../utils/warehouseListUi';

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

const TEST_LABEL_STORAGE_CELLS = [
  { nameShort: 'Стел', value: 'A-01' },
  { nameShort: 'Секц', value: '02' },
  { nameShort: 'Мест', value: '03' },
  { nameShort: 'Ряд', value: '04' },
  { nameShort: 'Уров', value: 'B2' },
  { nameShort: 'Полк', value: 'C5' },
];

function LabelPreview({ widthMm, heightMm }) {
  const frameRef = useRef(null);
  const frameSize = useElementSize(frameRef);

  const framePadding = 12;
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
    const availableW = Math.max(1, frameSize.width - framePadding * 2);
    const availableH = Math.max(1, frameSize.height - framePadding * 2);
    const k = Math.min(availableW / basePx.w, availableH / basePx.h);
    return clamp(k, 0.05, 10);
  }, [frameSize.width, frameSize.height, basePx.w, basePx.h]);

  return (
    <div
      ref={frameRef}
      className="w-full overflow-auto rounded-xl bg-gray-50 p-3 ring-1 ring-gray-200/80"
      style={{ height: 260 }}
    >
      <div
        className="box-border border border-black bg-white"
        style={{
          width: basePx.w,
          height: basePx.h,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          overflow: 'hidden',
        }}
      >
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
          <div className="flex h-full flex-col justify-between gap-1">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1 text-black">
                <div className="mb-1">
                  <div className="text-[8px] font-bold leading-tight">Бренд</div>
                  <div className="break-words text-[11px] font-semibold leading-tight">BOSCH</div>
                </div>
                <div className="mb-1">
                  <div className="text-[8px] font-bold leading-tight">Артикул</div>
                  <div className="break-words text-[11px] font-semibold leading-tight">0 986 479 123</div>
                </div>
                <div>
                  <div className="text-[8px] font-bold leading-tight">Наименование</div>
                  <div className="break-words text-[9px] font-semibold leading-tight">
                    Тормозные колодки передние
                  </div>
                </div>
              </div>

              <div className="flex w-[56px] shrink-0 flex-col items-center">
                <div className="h-[48px] w-[48px] bg-black" aria-label="QR placeholder" />
                <div className="mt-1 whitespace-nowrap text-center text-[8px] leading-tight text-black">
                  Цена: 1 250 ₽
                </div>
                <div className="mt-0.5 w-full text-center text-black">
                  <div className="text-[7px] font-bold leading-tight">Код</div>
                  <div className="break-all font-mono text-[8px] font-bold leading-tight">TVGP-AABBP</div>
                </div>
              </div>
            </div>

            <div className="w-full">
              <div className="mb-0.5 text-[8px] font-bold leading-tight text-black">Адресное хранение</div>
              <LabelStorageCellsPreview cells={TEST_LABEL_STORAGE_CELLS} widthMm={widthMm} fullWidth />
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
      await apiAxios.post(`/printers/id/${selectedPrinterId}/print-test-label`);
    } catch (e) {
      setSaveError(e?.response?.data?.detail || 'Ошибка печати пробной этикетки');
    } finally {
      setPrintingTest(false);
    }
  };

  return (
    <section className="space-y-4 rounded-2xl bg-white p-4 ring-1 ring-gray-200/80 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-bold text-gray-900">Этикетка</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handlePrintTestLabel}
            disabled={!selectedPrinterId || printingTest}
            className={warehouseSecondaryButtonClass}
          >
            {printingTest ? 'Печатаю…' : 'Пробная печать'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className={warehousePrimaryButtonClass}
          >
            {saving ? 'Сохраняю…' : 'Сохранить'}
          </button>
        </div>
      </div>

      {saveError ? (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200/80">
          {typeof saveError === 'string' ? saveError : saveError?.detail || 'Ошибка сохранения'}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block min-w-0 sm:col-span-3">
          <span className="mb-1.5 block text-xs font-medium text-gray-500">Принтер</span>
          <select
            value={selectedPrinterId}
            onChange={(e) => handleSelectPrinter(e.target.value)}
            disabled={loading}
            className={warehousePillControlClass}
          >
            <option value="">Выберите принтер</option>
            {connectedPrinters.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.is_default ? '(По умолчанию)' : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="block min-w-0">
          <span className="mb-1.5 block text-xs font-medium text-gray-500">Ширина, мм</span>
          <input
            type="number"
            min={10}
            step={1}
            value={widthMm}
            onChange={(e) => setWidthMm(e.target.value)}
            disabled={!isDirector || !selectedPrinterId}
            className={warehousePillControlClass}
          />
        </label>

        <label className="block min-w-0">
          <span className="mb-1.5 block text-xs font-medium text-gray-500">Высота, мм</span>
          <input
            type="number"
            min={10}
            step={1}
            value={heightMm}
            onChange={(e) => setHeightMm(e.target.value)}
            disabled={!isDirector || !selectedPrinterId}
            className={warehousePillControlClass}
          />
        </label>
      </div>

      <LabelPreview widthMm={widthMm} heightMm={heightMm} />
    </section>
  );
}
