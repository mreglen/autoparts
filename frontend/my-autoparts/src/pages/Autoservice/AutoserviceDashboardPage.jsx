import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import { withBackTo } from '../../hooks/useHistoryBack';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import {
  EmptyState,
  PageHeader,
  SectionHeader,
  Skeleton,
} from '../../components/UI';
import RepairOrderViewModal, {
  OrderStatusBadge,
} from '../../components/Autoservice/RepairOrderViewModal';
import InspectionBookingAddModal from '../../components/Autoservice/InspectionBookingAddModal';
import { apiRequest } from '../../utils/apiClient';
import { getGreeting, getFirstName, MetricCard, PrimaryAction, QuickAction } from '../Dashboard/dashboardUi';
import { formatFinanceCurrency } from '../Finance/financeDisplay';
import { formatOrderClockRange, formatPersonNameWithInitials } from '../../utils/autoserviceOrderDisplay';
import {
  AUTOSERVICE_PERMISSION,
  hasAutoservicePermission,
} from '../../utils/autoservicePermissions';
import { MOBILE_PULL_REFRESH_EVENT } from '../../utils/mobileRouteRefresh';

const ICONS = {
  planner: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  orders: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  inspections: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ),
  clients: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  warehouse: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m8-14v10l-8 4M4 7l8 4m-8-4v10l8 4m0-10v10" />
    </svg>
  ),
  finance: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  reports: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
};

const PLUS_ICON = (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
  </svg>
);

function todayItemTimeLabel(item) {
  if (item?.kind === 'inspection') return item.preferred_time?.slice(0, 5) || '—';
  return formatOrderClockRange(item);
}

export default function AutoserviceDashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isReady, user } = useAuthReady();
  const permissionCodes = useSelector((state) => state.auth.permissionCodes);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState(null);
  const [viewOrder, setViewOrder] = useState(null);
  const [viewOrderLoading, setViewOrderLoading] = useState(false);
  const [viewBooking, setViewBooking] = useState(null);
  const [zones, setZones] = useState([]);
  const zonesRequestedRef = useRef(false);

  const can = useCallback(
    (code) => hasAutoservicePermission(user, permissionCodes, code),
    [user, permissionCodes],
  );
  const canSeeOrders = can(AUTOSERVICE_PERMISSION.orders) || can(AUTOSERVICE_PERMISSION.ordersOwn);
  const isOwnLevel = summary?.level === 'own';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest('/autoservice/dashboard/summary');
      setSummary(data || null);
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить сводку автосервиса');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isReady && user) load();
  }, [isReady, user, load]);

  useEffect(() => {
    const onPullRefresh = (event) => {
      if (event.detail?.pathname === '/dashboard/autoservice') load();
    };
    window.addEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
    return () => window.removeEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
  }, [load]);

  const openOrder = useCallback(async (orderId) => {
    if (!orderId) return;
    setViewOrderLoading(true);
    try {
      const order = await apiRequest(`/autoservice/repair-orders/${orderId}`);
      setViewOrder(order);
    } catch {
      setError('Не удалось загрузить заказ-наряд');
    } finally {
      setViewOrderLoading(false);
    }
  }, []);

  const openInspection = useCallback((item) => {
    if (!item?.id) return;
    setViewBooking({
      id: item.id,
      name: item.client_name || '',
      phone: item.client_phone || '',
      client_id: item.client_id ?? null,
      garage_vehicle_id: item.garage_vehicle_id ?? null,
      preferred_date: String(item.scheduled_at || '').slice(0, 10) || null,
      preferred_time: item.preferred_time || null,
      vehicle_make: item.vehicle_make || null,
      vehicle_model: item.vehicle_model || null,
      work_zone_id: item.work_zone_id ?? null,
      notes: item.notes || null,
      status: item.status,
    });
    if (!zonesRequestedRef.current) {
      zonesRequestedRef.current = true;
      apiRequest('/autoservice/work-zones')
        .then((data) => setZones(Array.isArray(data) ? data : []))
        .catch(() => setZones([]));
    }
  }, []);

  const primaryActions = useMemo(() => {
    const actions = [];
    if (canSeeOrders) {
      actions.push({ label: 'Заказ-наряд', href: '/autoservice/orders/new' });
    }
    if (can(AUTOSERVICE_PERMISSION.inspections)) {
      actions.push({ label: 'Запись на осмотр', href: '/autoservice/inspections?new=1' });
    }
    if (can(AUTOSERVICE_PERMISSION.clients)) {
      actions.push({ label: 'Клиент', href: '/autoservice/clients?new=1' });
    }
    return actions;
  }, [can, canSeeOrders]);

  const attentionTiles = useMemo(() => {
    if (!summary) return [];
    const tiles = [];
    if (summary.review_orders > 0) {
      tiles.push({
        label: 'На проверке',
        value: summary.review_orders,
        hint: textForReviewHint(summary.review_orders),
        href: '/autoservice/orders?view=review',
        accent: 'warning',
      });
    }
    if (summary.new_bookings > 0) {
      tiles.push({
        label: 'Новые записи на осмотр',
        value: summary.new_bookings,
        hint: 'Требуют подтверждения',
        href: '/autoservice/inspections',
        accent: 'warning',
      });
    }
    if (Number(summary.debt_total) > 0) {
      tiles.push({
        label: 'Долги клиентов',
        value: formatFinanceCurrency(summary.debt_total),
        hint: `${summary.debtors_count} ${plural(summary.debtors_count, 'клиент', 'клиента', 'клиентов')}`,
        href: '/autoservice/clients',
        accent: 'warning',
      });
    }
    if (summary.in_progress_orders != null) {
      tiles.push({
        label: 'В работе',
        value: summary.in_progress_orders,
        hint: isOwnLevel ? 'Мои заказы' : `${summary.active_orders ?? 0} активных`,
        href: '/autoservice/orders',
        accent: 'brand',
      });
    }
    if (summary.revenue_30d != null) {
      tiles.push({
        label: 'Выручка за 30 дней',
        value: formatFinanceCurrency(summary.revenue_30d),
        hint: 'Платежи по заказ-нарядам',
        href: '/autoservice/finance',
        accent: 'success',
      });
    }
    return tiles;
  }, [summary, isOwnLevel]);

  const todayItems = summary?.today || [];

  const quickActions = useMemo(() => {
    const actions = [];
    if (can(AUTOSERVICE_PERMISSION.planner)) {
      actions.push({
        label: 'Планировщик',
        description: 'График рабочих зон',
        href: '/autoservice/planner',
        icon: ICONS.planner,
        tone: 'brand',
      });
    }
    if (canSeeOrders) {
      actions.push({
        label: 'Заказ-наряды',
        description: 'Активные и история',
        href: '/autoservice/orders',
        icon: ICONS.orders,
        tone: 'sky',
      });
    }
    if (can(AUTOSERVICE_PERMISSION.inspections)) {
      actions.push({
        label: 'Записи',
        description: 'Брони на осмотр',
        href: '/autoservice/inspections',
        icon: ICONS.inspections,
        tone: 'success',
      });
    }
    if (can(AUTOSERVICE_PERMISSION.clients)) {
      actions.push({
        label: 'Клиенты',
        description: 'База клиентов',
        href: '/autoservice/clients',
        icon: ICONS.clients,
        tone: 'accent',
      });
    }
    if (can(AUTOSERVICE_PERMISSION.warehouse)) {
      actions.push({
        label: 'Склад',
        description: 'Остатки запчастей',
        href: '/autoservice/warehouse',
        icon: ICONS.warehouse,
        tone: 'success',
      });
    }
    if (can(AUTOSERVICE_PERMISSION.finance)) {
      actions.push({
        label: 'Финансы',
        description: 'Платежи за период',
        href: '/autoservice/finance',
        icon: ICONS.finance,
        tone: 'brand',
      });
    }
    if (can(AUTOSERVICE_PERMISSION.reports)) {
      actions.push({
        label: 'Отчёты',
        description: 'Экономика и зарплаты',
        href: '/autoservice/reports',
        icon: ICONS.reports,
        tone: 'sky',
      });
    }
    return actions;
  }, [can, canSeeOrders]);

  const firstName = getFirstName(user);
  const payroll = summary?.payroll_month;

  if (!isReady) return <AuthLoadingScreen />;

  if (loading) {
    return (
      <div className="w-full min-w-0 space-y-6 pb-12 lg:mt-5 lg:space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56 sm:h-9" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex gap-2.5">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-11 w-36" />)}
        </div>
        <section className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-sg-lg border border-line bg-surface p-5 shadow-sg">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="mt-3 h-8 w-32" />
              <Skeleton className="mt-2 h-4 w-40" />
            </div>
          ))}
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full min-w-0 lg:mt-5">
        <EmptyState
          illustration="error"
          title={error}
          description="Проверьте подключение и попробуйте ещё раз."
          actionLabel="Попробовать снова"
          onAction={load}
        />
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6 pb-12 lg:mt-5 lg:space-y-8">
      <PageHeader
        className="mb-0"
        title={`${getGreeting()}${firstName ? `, ${firstName}` : ''}`}
        subtitle="Рабочий стол автосервиса"
      />

      {primaryActions.length > 0 && (
        <section className="flex flex-wrap gap-2.5 max-lg:flex-col sm:flex-row">
          {primaryActions.map((action) => (
            <PrimaryAction
              key={action.href}
              label={`${action.label}`}
              href={action.href}
              icon={PLUS_ICON}
            />
          ))}
        </section>
      )}

      {attentionTiles.length > 0 && (
        <section className="space-y-3">
          <SectionHeader title="Требует внимания" />
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3">
            {attentionTiles.map((tile) => (
              <MetricCard key={tile.label} {...tile} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <SectionHeader
          title={isOwnLevel ? 'Мои заказы сегодня' : 'Сегодня'}
          subtitle={todayItems.length > 0 ? `${todayItems.length} записей` : undefined}
        />
        {todayItems.length === 0 ? (
          <EmptyState
            illustration="success"
            title="Записей нет"
            description="На сегодня ничего не запланировано"
          />
        ) : (
          <div className="divide-y divide-gray-100">
            {todayItems.map((item) => (
              <button
                key={`${item.kind || 'order'}-${item.id}`}
                type="button"
                onClick={() => {
                  if (item.kind === 'inspection') {
                    openInspection(item);
                  } else {
                    openOrder(item.id);
                  }
                }}
                className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-gray-50/80"
              >
                <span className="w-16 shrink-0 text-sm font-semibold tabular-nums text-ink">
                  {todayItemTimeLabel(item)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">
                    {item.kind === 'inspection'
                      ? formatPersonNameWithInitials(item.client_name) || 'Осмотр'
                      : (item.vehicle && item.vehicle !== '—' ? item.vehicle : 'Авто')}
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-ink-muted">
                    {item.kind === 'inspection'
                      ? `Осмотр${item.client_phone ? ` · ${item.client_phone}` : ''}`
                      : formatPersonNameWithInitials(item.client_name)}
                    {item.work_zone_name ? ` · ${item.work_zone_name}` : ''}
                  </span>
                </span>
                {item.kind === 'inspection' ? (
                  <span className="shrink-0 rounded-full bg-success-50 px-2.5 py-1 text-xs font-semibold text-success-700">
                    Осмотр
                  </span>
                ) : (
                  <OrderStatusBadge status={item.status} className="shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}
        {viewOrderLoading ? (
          <p className="text-xs text-ink-muted">Открываем заказ-наряд…</p>
        ) : null}
      </section>

      {payroll ? (
        <section className="space-y-3">
          <SectionHeader title="Моя зарплата" />
          <MetricCard
            label={`Начислено за ${payroll.month}.${payroll.year}`}
            value={formatFinanceCurrency(payroll.total)}
            hint={`${payroll.completed_orders} ${plural(payroll.completed_orders, 'закрытый заказ', 'закрытых заказа', 'закрытых заказов')}`}
            href="/autoservice/payroll"
            accent="success"
          />
        </section>
      ) : null}

      {quickActions.length > 0 && (
        <section className="space-y-3">
          <SectionHeader title="Разделы" />
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            {quickActions.map((action) => (
              <QuickAction key={action.href} {...action} />
            ))}
          </div>
        </section>
      )}

      <RepairOrderViewModal
        order={viewOrder}
        enablePayment={viewOrder?.status !== 'review'}
        onOrderChange={(updated) => {
          setViewOrder(updated);
          load();
        }}
        onClose={() => setViewOrder(null)}
        onEdit={(order) => {
          setViewOrder(null);
          navigate(`/autoservice/orders/${order.id}/edit`);
        }}
      />
      <InspectionBookingAddModal
        open={Boolean(viewBooking)}
        onClose={() => setViewBooking(null)}
        zones={zones}
        initialBooking={viewBooking}
        onSaved={() => {
          setViewBooking(null);
          load();
        }}
        onDeleted={() => {
          setViewBooking(null);
          load();
        }}
        onCreateOrder={(booking) => {
          setViewBooking(null);
          navigate('/autoservice/orders/new', {
            state: withBackTo(location, {
              scheduledAtLocal: `${booking.preferred_date}T${booking.preferred_time?.slice(0, 5) || '10:00'}`,
              workZoneId: booking.work_zone_id,
              clientId: booking.client_id,
              vehicleId: booking.garage_vehicle_id,
              clientName: booking.name,
              clientPhone: booking.phone,
              vehicleMake: booking.vehicle_make || booking.vehicle?.make,
              vehicleModel: booking.vehicle_model || booking.vehicle?.model,
              inspectionBookingId: booking.id,
            }),
          });
        }}
      />
    </div>
  );
}

function plural(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

function textForReviewHint(count) {
  return `${count} ${plural(count, 'заявка ждёт', 'заявки ждут', 'заявок ждут')}`;
}
