import { useMemo } from 'react';
import Modal from '../../../components/UI/Modal';
import { candidateLabel } from '../../../utils/laximoVinCandidate';

const GENERIC_LABELS = new Set(['unknown', 'n/a', 'неизвестно']);

function isBlank(value) {
  const text = String(value ?? '').trim();
  return !text || GENERIC_LABELS.has(text.toLowerCase());
}

function buildVehicleInfoRows(vehicle) {
  const rows = [];
  const seen = new Set();
  (Array.isArray(vehicle?.attributes_raw) ? vehicle.attributes_raw : []).forEach((attr) => {
    const label = String(attr?.name || attr?.key || '').trim();
    const value = String(attr?.value ?? '').trim();
    if (!label || isBlank(value)) return;
    const dedupe = `${label.toLowerCase()}|${value}`;
    if (seen.has(dedupe)) return;
    seen.add(dedupe);
    rows.push({ label, value });
  });
  return rows;
}

function isColorLabel(label) {
  return /цвет/i.test(label);
}

function resolveSwatchColor(value) {
  const text = String(value || '').trim();
  if (/^[0-9a-f]{3}$/i.test(text) || /^[0-9a-f]{6}$/i.test(text)) return `#${text}`;
  if (/^[0-9a-f]{4}$/i.test(text)) {
    return `#${text.split('').map((c) => c + c).join('').slice(0, 6)}`;
  }
  const named = {
    'чёрный': '#000', 'черный': '#000', 'белый': '#fff', 'серый': '#9ca3af', 'серебристый': '#c0c0c0',
    'красный': '#dc2626', 'синий': '#2563eb', 'голубой': '#38bdf8', 'зелёный': '#16a34a', 'зеленый': '#16a34a',
    'жёлтый': '#eab308', 'желтый': '#eab308', 'оранжевый': '#f97316', 'коричневый': '#92400e',
    'бежевый': '#d6c7a8', 'бордовый': '#7f1d1d', 'фиолетовый': '#7c3aed', 'розовый': '#ec4899',
  };
  return named[text.toLowerCase()] || null;
}

export default function VinVehicleInfoModal({ open, onClose, vehicle, vin }) {
  const title = candidateLabel(vehicle) || vehicle?.display_name || 'Автомобиль';
  const rows = useMemo(() => buildVehicleInfoRows(vehicle), [vehicle]);
  const vinText = String(vin || vehicle?.vin || '').trim();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Информация об автомобиле"
      size="lg"
    >
      <div className="space-y-4">
        <div>
          <p className="text-base font-semibold text-ink">{title}</p>
          {vinText ? (
            <p className="mt-0.5 font-mono text-xs text-ink-muted">VIN/Frame: {vinText}</p>
          ) : null}
        </div>

        {rows.length ? (
          <dl className="divide-y divide-line-soft rounded-lg border border-line-soft">
            {rows.map((row) => {
              const swatch = isColorLabel(row.label) ? resolveSwatchColor(row.value) : null;
              return (
                <div key={row.label} className="grid grid-cols-[45%_55%] gap-3 px-4 py-2.5">
                  <dt className="min-w-0 text-sm text-ink-muted">{row.label}</dt>
                  <dd className="min-w-0 break-words text-sm font-medium text-ink">
                    {swatch ? (
                      <span className="inline-flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="inline-block h-4 w-4 shrink-0 rounded-full border border-line"
                          style={{ backgroundColor: swatch }}
                        />
                        <span>{row.value}</span>
                      </span>
                    ) : row.value}
                  </dd>
                </div>
              );
            })}
          </dl>
        ) : (
          <p className="text-sm text-ink-muted">Дополнительные параметры не переданы каталогом.</p>
        )}
      </div>
    </Modal>
  );
}
