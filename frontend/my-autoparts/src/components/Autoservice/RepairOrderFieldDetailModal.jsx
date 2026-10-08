import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import Modal from '../UI/Modal';
import {
  formatShopPartUnit,
  priceWithMarkup,
  shopLineSum,
  shopPartDisplayName,
  shopPartPricingOptions,
} from '../../utils/repairOrderShopPartUtils';

const LazyClientProfileModal = lazy(() =>
  import('./ClientProfileModals').then((m) => ({ default: m.ClientProfileModal })),
);
const LazyEditGuestVehicleModal = lazy(() =>
  import('./ClientProfileModals').then((m) => ({ default: m.EditGuestVehicleModal })),
);

function formatMoney(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return '0,00';
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatRubles(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return '0';
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function workLineSum(qty, unitPrice) {
  return (Number(qty) || 0) * (Number(unitPrice) || 0);
}

function executorPayAmount(qty, unitPrice, percent) {
  return workLineSum(qty, unitPrice) * (Number(percent) || 0) / 100;
}

function WorkDetail({ work }) {
  const executors = work?.executors || [];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Наименование</p>
          <p className="text-sm text-ink">{work?.title || '—'}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Количество</p>
          <p className="text-sm text-ink">{work?.qty ?? '—'}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Цена за ед.</p>
          <p className="text-sm text-ink">{formatMoney(work?.unit_price || 0)} ₽</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Сумма</p>
          <p className="text-sm font-medium text-ink">{formatMoney(workLineSum(work?.qty, work?.unit_price))} ₽</p>
        </div>
      </div>
      {executors.length > 0 ? (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Исполнители</p>
          <ul className="space-y-1">
            {executors.map((ex, i) => (
              <li key={`${ex.employee_id || i}`} className="flex items-center justify-between text-sm">
                <span className="text-ink">{ex.name || ex.employee_id || '—'}</span>
                <span className="tabular-nums text-ink-soft">
                  {ex.percent ?? '0'}% · {formatMoney(executorPayAmount(work?.qty, work?.unit_price, ex.percent))} ₽
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ShopPartDetail({ part }) {
  const pricingOptions = useMemo(() => shopPartPricingOptions(part), [part]);
  const automaticClientUnit = priceWithMarkup(
    part?.unit_price,
    part?.markup_percent,
    { ...pricingOptions, clientUnitPriceOverride: null },
  );
  const clientUnit = part?.client_unit_price_override != null && part.client_unit_price_override !== ''
    ? part.client_unit_price_override
    : automaticClientUnit;
  const lineTotal = shopLineSum(part?.qty, part?.unit_price, part?.markup_percent, pricingOptions);
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Наименование</p>
        <p className="text-sm font-medium text-ink">{shopPartDisplayName(part) || part?.title || '—'}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Количество</p>
          <p className="text-sm text-ink">{part?.qty ?? '—'} {formatShopPartUnit(part?.unit || 'pcs')}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Цена закупки</p>
          <p className="text-sm text-ink">{formatMoney(part?.unit_price || 0)} ₽</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Наценка</p>
          <p className="text-sm text-ink">{part?.markup_percent ?? 0}%</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Цена клиенту</p>
          <p className="text-sm text-ink">{formatMoney(clientUnit)} ₽</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Сумма</p>
          <p className="text-sm font-medium text-ink">{formatRubles(lineTotal)} ₽</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Источник</p>
          <p className="text-sm text-ink">{part?.source || 'ручная'}</p>
        </div>
      </div>
      {part?.stock_max_qty != null ? (
        <p className="text-xs text-ink-muted">Доступно на складе не более {part.stock_max_qty} {formatShopPartUnit(part?.unit || 'pcs')}</p>
      ) : null}
    </div>
  );
}

function ExecutorsDetail({ work, employees }) {
  const executors = work?.executors || [];
  return (
    <div className="space-y-3">
      {executors.length === 0 ? (
        <p className="text-sm text-ink-muted">Исполнители не назначены</p>
      ) : (
        executors.map((ex, i) => {
          const employee = employees?.find((e) => String(e.id) === String(ex.employee_id));
          const pay = executorPayAmount(work?.qty, work?.unit_price, ex.percent);
          return (
            <div key={`${ex.employee_id || i}`} className="rounded-sg border border-line-soft bg-surface-muted/50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-ink">{employee?.name || ex.employee_id || '—'}</span>
                <span className="text-sm tabular-nums text-ink-soft">{ex.percent ?? '0'}%</span>
              </div>
              <p className="mt-1 text-sm text-ink-muted">Выплата: {formatMoney(pay)} ₽</p>
            </div>
          );
        })
      )}
    </div>
  );
}

export default function RepairOrderFieldDetailModal({
  open,
  item,
  clients,
  vehicles,
  serviceEmployees,
  onClose,
  onClientSaved,
  onVehicleSaved,
}) {
  const [clientVehicles, setClientVehicles] = useState(vehicles || []);

  useEffect(() => {
    setClientVehicles(vehicles || []);
  }, [vehicles]);

  const { type, data } = item || {};

  const selectedClient = useMemo(
    () => (clients || []).find((c) => String(c.id) === String(data?.clientId)),
    [clients, data?.clientId],
  );

  const selectedVehicle = useMemo(
    () => (vehicles || []).find((v) => String(v.id) === String(data?.vehicleId)),
    [vehicles, data?.vehicleId],
  );

  const handleClientSaved = (updated) => {
    onClientSaved?.(updated);
  };

  const handleVehicleSaved = (updated) => {
    onVehicleSaved?.(updated);
  };

  if (!open || !type) return null;

  if (type === 'client') {
    return (
      <Suspense fallback={null}>
        <LazyClientProfileModal
          open={open && Boolean(selectedClient)}
          client={selectedClient}
          vehicles={clientVehicles}
          loading={false}
          onClose={onClose}
          onEditVehicle={() => {}}
          onAddVehicle={() => {}}
          onVinClick={() => {}}
          onSaved={handleClientSaved}
        />
      </Suspense>
    );
  }

  if (type === 'vehicle') {
    return (
      <Suspense fallback={null}>
        <LazyEditGuestVehicleModal
          open={open && Boolean(selectedVehicle)}
          vehicle={selectedVehicle}
          onClose={onClose}
          onSaved={handleVehicleSaved}
        />
      </Suspense>
    );
  }

  const titleByType = {
    work: 'Работа',
    shopPart: 'Запчасть',
    executors: 'Исполнители по работе',
  };

  return (
    <Modal open={open} onClose={onClose} title={titleByType[type] || 'Детали'} size="sm">
      {type === 'work' ? <WorkDetail work={data?.work} /> : null}
      {type === 'shopPart' ? <ShopPartDetail part={data?.part} /> : null}
      {type === 'executors' ? <ExecutorsDetail work={data?.work} employees={serviceEmployees} /> : null}
    </Modal>
  );
}
