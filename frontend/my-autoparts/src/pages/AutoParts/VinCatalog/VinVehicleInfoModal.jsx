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

export default function VinVehicleInfoModal({ open, onClose, vehicle, vin }) {
  const title = candidateLabel(vehicle) || vehicle?.display_name || 'Автомобиль';
  const rows = useMemo(() => buildVehicleInfoRows(vehicle), [vehicle]);
  const vinText = String(vin || vehicle?.vin || '').trim();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Информация об автомобиле"
      size="sm"
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
            {rows.map((row) => (
              <div key={row.label} className="grid grid-cols-[45%_55%] gap-3 px-4 py-2.5">
                <dt className="min-w-0 text-sm text-ink-muted">{row.label}</dt>
                <dd className="min-w-0 break-words text-sm font-medium text-ink">{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-ink-muted">Дополнительные параметры не переданы каталогом.</p>
        )}
      </div>
    </Modal>
  );
}
