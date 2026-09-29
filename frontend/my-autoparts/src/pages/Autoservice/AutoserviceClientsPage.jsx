import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import { useDebouncedValue } from '../../hooks/useDebouncedCallback';
import AutoserviceClientAddModal from '../../components/Autoservice/AutoserviceClientAddModal';
import AutoserviceLiveSearchField from '../../components/Autoservice/AutoserviceLiveSearchField';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import { Skeleton } from '../../components/UI';
import Toast from '../../components/UI/Toast';
import { MOBILE_PULL_REFRESH_EVENT } from '../../utils/mobileRouteRefresh';
import {
  autoserviceListTableClass,
  autoserviceListTableWrapClass,
  autoserviceListTheadRowClass,
  autoserviceListThClass,
  autoserviceListTbodyClass,
  autoserviceListTrClickableClass,
  autoserviceListTdClass,
} from '../../utils/warehouseListUi';
import {
  AccountBadge,
  AddGuestVehicleModal,
  ClientProfileModal,
  EditGuestVehicleModal,
} from '../../components/Autoservice/ClientProfileModals';
import { apiRequest } from '../../utils/apiClient';
import { normalizeVinForLookupOrNull } from '../../utils/laximoVin';

function formatMoney(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return '0,00';
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function hiddenMatchHint(client, query) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return null;

  const hiddenFields = [
    { label: 'Email', value: client?.email },
    { label: 'Наименование', value: client?.legal_name },
    { label: 'ИНН', value: client?.inn },
    { label: 'КПП', value: client?.kpp },
    { label: client?.person_type === 'legal' ? 'Юр. адрес' : 'Адрес', value: client?.address },
    { label: client?.person_type === 'ie' ? 'ОГРНИП' : 'ОГРН', value: client?.ogrn },
  ];

  for (const field of hiddenFields) {
    const raw = String(field.value || '').trim();
    if (!raw) continue;
    if (normalizeSearchText(raw).includes(normalizedQuery)) {
      return `${field.label}: ${raw}`;
    }
  }
  return null;
}

function ClientMobileCard({ row, hint, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(row)}
      className="w-full py-3 text-left"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-ink">{row.name}</p>
          <p className="mt-0.5 truncate text-sm text-ink-muted">{row.phone || '—'}</p>
          {hint ? (
            <p className="mt-1 truncate text-xs text-brand-600" title={hint}>
              Найдено по: {hint}
            </p>
          ) : null}
        </div>
        <AccountBadge userId={row.user_id} />
      </div>
    </button>
  );
}



export default function AutoserviceClientsPage() {
  const navigate = useNavigate();
  const { isReady, user, isAuthenticated } = useAuthReady();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [q, setQ] = useState('');
  const qApplied = useDebouncedValue(q);
  const [vehiclesModalClient, setVehiclesModalClient] = useState(null);
  const [clientVehicles, setClientVehicles] = useState({});
  const [vehiclesLoadingId, setVehiclesLoadingId] = useState(null);
  const [editVehicle, setEditVehicle] = useState(null);
  const [addVehicleOpen, setAddVehicleOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('new') !== '1') return;
    setAddOpen(true);
    searchParams.delete('new');
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleVinClick = useCallback(async (rawVin) => {
    const vin = normalizeVinForLookupOrNull(rawVin);
    if (!vin) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(vin);
      }
    } catch {
      // no-op: clipboard may be unavailable in insecure context
    }
    setVehiclesModalClient(null);
    navigate(`/autoparts/vin?vin=${encodeURIComponent(vin)}`);
  }, [navigate]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (qApplied.trim()) params.set('q', qApplied.trim());
      const suffix = params.toString() ? `?${params.toString()}` : '';
      const data = await apiRequest(`/autoservice/clients${suffix}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || 'Не удалось загрузить клиентов');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [qApplied]);

  useEffect(() => {
    if (isReady && isAuthenticated) {
      load();
    }
  }, [isReady, isAuthenticated, load]);

  useEffect(() => {
    const onPullRefresh = (event) => {
      if (event.detail?.pathname === '/autoservice/clients') {
        load();
      }
    };
    window.addEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
    return () => window.removeEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
  }, [load]);

  const openClientVehicles = async (client) => {
    if (!client?.id) return;
    setVehiclesModalClient(client);
    if (clientVehicles[client.id]) return;
    setVehiclesLoadingId(client.id);
    try {
      const data = await apiRequest(`/autoservice/garage/vehicles?client_id=${client.id}`);
      setClientVehicles((prev) => ({ ...prev, [client.id]: Array.isArray(data) ? data : [] }));
    } catch {
      setClientVehicles((prev) => ({ ...prev, [client.id]: [] }));
    } finally {
      setVehiclesLoadingId(null);
    }
  };

  const closeClientVehicles = () => {
    setVehiclesModalClient(null);
  };

  if (!isReady) return <AuthLoadingScreen />;
  if (!isAuthenticated || !user) return null;

  return (
    <div className="w-full min-w-0">
      <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Клиенты</h1>
          <p className="mt-0.5 text-sm text-ink-muted">
            {loading
              ? 'Загрузка…'
              : qApplied.trim()
                ? `${rows.length} найдено`
                : `${rows.length} клиентов`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex min-h-11 items-center justify-center rounded-sg-sm bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          Добавить
        </button>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <AutoserviceLiveSearchField
          value={q}
          onChange={setQ}
          placeholder="Имя, телефон, авто, VIN, заказ-наряд, заявка, ИНН…"
          ariaLabel="Поиск клиентов"
        />
      </div>

      <Toast message={error} variant="error" onClose={() => setError(null)} />

      <div className={autoserviceListTableWrapClass}>
        <table className={autoserviceListTableClass}>
          <thead>
            <tr className={autoserviceListTheadRowClass}>
              <th className={`w-56 ${autoserviceListThClass}`}>Имя</th>
              <th className={`w-36 ${autoserviceListThClass}`}>Телефон</th>
              <th className={`w-28 ${autoserviceListThClass}`}>Аккаунт</th>
              <th className={`w-28 ${autoserviceListThClass} text-right`}>Долг</th>
            </tr>
          </thead>
          <tbody className={autoserviceListTbodyClass}>
            {loading ? (
              <tr>
                <td colSpan={4} className="py-12 text-center text-ink-muted">
                  Загрузка…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-12 text-center text-ink-muted">
                  {qApplied.trim() ? 'Ничего не найдено' : 'Клиентов пока нет'}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const hint = hiddenMatchHint(row, qApplied);
                return (
                  <tr
                    key={row.id}
                    className={autoserviceListTrClickableClass}
                    onClick={() => openClientVehicles(row)}
                  >
                    <td className={autoserviceListTdClass}>
                      <p className="truncate font-semibold text-ink">{row.name}</p>
                      {hint ? (
                        <p className="mt-0.5 truncate text-xs text-brand-600" title={hint}>
                          Найдено по: {hint}
                        </p>
                      ) : null}
                    </td>
                    <td className={`${autoserviceListTdClass} whitespace-nowrap tabular-nums text-ink-muted`}>
                      {row.phone || '—'}
                    </td>
                    <td className={autoserviceListTdClass}>
                      <AccountBadge userId={row.user_id} />
                    </td>
                    <td className={`${autoserviceListTdClass} whitespace-nowrap text-right tabular-nums ${Number(row.debt_amount) > 0 ? 'font-medium text-danger-600' : 'text-ink-muted'}`}>
                      {Number(row.debt_amount) > 0 ? `${formatMoney(row.debt_amount)} ₽` : '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="md:hidden">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={`client-sk-${i}`} className="h-20 w-full rounded-sg" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-muted">
            {qApplied.trim() ? 'Ничего не найдено' : 'Клиентов пока нет'}
          </p>
        ) : (
          <div className="divide-y divide-line-soft">
            {rows.map((row) => (
              <ClientMobileCard
                key={row.id}
                row={row}
                hint={hiddenMatchHint(row, qApplied)}
                onOpen={openClientVehicles}
              />
            ))}
          </div>
        )}
      </div>

      <AutoserviceClientAddModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(row) => {
          setRows((prev) => [row, ...prev.filter((r) => r.id !== row.id)]);
        }}
      />

      <ClientProfileModal
        open={Boolean(vehiclesModalClient)}
        client={vehiclesModalClient}
        vehicles={vehiclesModalClient ? clientVehicles[vehiclesModalClient.id] : []}
        loading={vehiclesModalClient ? vehiclesLoadingId === vehiclesModalClient.id : false}
        onClose={closeClientVehicles}
        onEditVehicle={setEditVehicle}
        onAddVehicle={() => setAddVehicleOpen(true)}
        onVinClick={handleVinClick}
        onSaved={(updated) => {
          setVehiclesModalClient(updated);
          setRows((prev) => prev.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)));
        }}
      />

      <AddGuestVehicleModal
        open={addVehicleOpen}
        clientId={vehiclesModalClient?.id}
        onClose={() => setAddVehicleOpen(false)}
        onCreated={(created) => {
          if (!created?.client_id) return;
          setClientVehicles((prev) => ({
            ...prev,
            [created.client_id]: [created, ...(prev[created.client_id] || [])],
          }));
        }}
      />

      <EditGuestVehicleModal
        open={Boolean(editVehicle)}
        vehicle={editVehicle}
        onClose={() => setEditVehicle(null)}
        onSaved={(updated) => {
          setClientVehicles((prev) => {
            const clientId = updated.client_id;
            const list = prev[clientId] || [];
            return {
              ...prev,
              [clientId]: list.map((v) => (v.id === updated.id ? updated : v)),
            };
          });
        }}
      />
    </div>
  );
}
