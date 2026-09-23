import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import { EmptyState, PageHeader, SectionHeader, Skeleton } from '../../components/UI';
import { OrderStatusBadge } from '../../components/Autoservice/RepairOrderViewModal';
import { apiRequest } from '../../utils/apiClient';
import { getGreeting, getFirstName, MetricCard, QuickAction } from '../Dashboard/dashboardUi';
import { formatFinanceCurrency } from '../Finance/financeDisplay';
import { formatOrderClockRange, formatPersonNameWithInitials } from '../../utils/autoserviceOrderDisplay';
import {
  getWeekStart,
  plannerItemCoversDay,
  sortDayOrders,
  toIsoDate,
} from '../../utils/autoservicePlannerLayout';
import {
  AUTOSERVICE_PERMISSION,
  canReviewRepairOrders,
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

function todayItemTimeLabel(item) {
  if (item?.kind === 'inspection') return item.preferred_time?.slice(0, 5) || '—';
  return formatOrderClockRange(item);
}

export default function AutoserviceDashboardPage() {
  const navigate = useNavigate();
  const { isReady, user } = useAuthReady();
  const permissionCodes = useSelector((state) => state.auth.permissionCodes);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeOrders, setActiveOrders] = useState([]);
  const [plannerData, setPlannerData] = useState(null);
  const [revenue30d, setRevenue30d] = useState(null);
  const [reviewCount, setReviewCount] = useState(0);

  const can = useCallback(
    (code) => hasAutoservicePermission(user, permissionCodes, code),
    [user, permissionCodes],
  );
  const canReview = canReviewRepairOrders(user, permissionCodes);
  const canSeeFinance = can(AUTOSERVICE_PERMISSION.finance);
  const canSeeOrders = can(AUTOSERVICE_PERMISSION.orders) || can(AUTOSERVICE_PERMISSION.ordersOwn);

  const today = useMemo(() => new Date(), []);
  const todayIso = toIsoDate(today);
  const weekStartIso = toIsoDate(getWeekStart(today));

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const from = new Date(today);
    from.setDate(from.getDate() - 29);
    const receiptsParams = new URLSearchParams({
      date_from: toIsoDate(from),
      date_to: todayIso,
    });
    const canSeePlanner = can(AUTOSERVICE_PERMISSION.planner);
    const results = await Promise.allSettled([
      canSeeOrders
        ? apiRequest('/autoservice/repair-orders?scope=active')
        : Promise.resolve(null),
      canSeePlanner
        ? apiRequest(`/autoservice/planner/week?week_start=${weekStartIso}`)
        : Promise.resolve(null),
      canSeeFinance
        ? apiRequest(`/autoservice/finance/receipts?${receiptsParams.toString()}`)
        : Promise.resolve(null),
      canReview
        ? apiRequest('/autoservice/repair-orders?scope=review')
        : Promise.resolve(null),
    ]);

    const [ordersRes, plannerRes, receiptsRes, reviewRes] = results;
    const requested = [
      canSeeOrders ? ordersRes : null,
      canSeePlanner ? plannerRes : null,
    ].filter(Boolean);
    if (requested.length > 0 && requested.every((r) => r.status === 'rejected')) {
      setError('Не удалось загрузить сводку автосервиса');
      setLoading(false);
      return;
    }
    setActiveOrders(
      ordersRes.status === 'fulfilled' && Array.isArray(ordersRes.value) ? ordersRes.value : [],
    );
    setPlannerData(plannerRes.status === 'fulfilled' ? plannerRes.value || null : null);
    setRevenue30d(
      receiptsRes.status === 'fulfilled' ? receiptsRes.value?.total_amount ?? null : null,
    );
    setReviewCount(
      reviewRes.status === 'fulfilled' && Array.isArray(reviewRes.value)
        ? reviewRes.value.length
        : 0,
    );
    setLoading(false);
  }, [today, todayIso, weekStartIso, can, canSeeOrders, canSeeFinance, canReview]);

  useEffect(() => {
    if (isReady && user) load();
  }, [isReady, user, load]);

  useEffect(() => {
    const onPullRefresh = (event) => {
      if (event.detail?.pathname === '/dashboard') load();
    };
    window.addEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
    return () => window.removeEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
  }, [load]);

  const todayItems = useMemo(() => {
    const seen = new Set();
    const items = [];
    for (const zone of plannerData?.zones || []) {
      for (const day of zone.days || []) {
        for (const item of day.orders || []) {
          const key = `${item.kind || 'order'}-${item.id}`;
          if (seen.has(key) || !plannerItemCoversDay(item, todayIso)) continue;
          seen.add(key);
          items.push({ ...item, zoneName: zone.name });
        }
      }
    }
    return sortDayOrders(items);
  }, [plannerData, todayIso]);

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
    if (canSeeFinance) {
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
  }, [can, canSeeOrders, canSeeFinance]);

  const firstName = getFirstName(user);

  if (!isReady) return <AuthLoadingScreen />;

  if (loading) {
    return (
      <div className="w-full min-w-0 space-y-6 pb-12 lg:mt-5 lg:space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56 sm:h-9" />
          <Skeleton className="h-4 w-64" />
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
        <section className="space-y-3">
          <Skeleton className="h-6 w-40" />
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-sg-lg border border-line bg-surface p-4 shadow-sg">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-36" />
                </div>
              </div>
            ))}
          </div>
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
        subtitle="Сводка автосервиса на сегодня"
      />

      <section className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3">
        <MetricCard
          label="Заказ-наряды в работе"
          value={activeOrders.length}
          hint={canReview && reviewCount > 0 ? `+ ${reviewCount} на проверке` : 'Активные заказы'}
          href={canSeeOrders ? '/autoservice/orders' : undefined}
          accent="brand"
        />
        <MetricCard
          label="Записей сегодня"
          value={todayItems.length}
          hint={todayItems.length === 0 ? 'Свободный день' : 'Заказы и осмотры'}
          href={can(AUTOSERVICE_PERMISSION.planner) ? '/autoservice/planner' : undefined}
          accent="success"
        />
        {canSeeFinance ? (
          <MetricCard
            label="Выручка за 30 дней"
            value={formatFinanceCurrency(revenue30d ?? 0)}
            hint="Платежи автосервиса"
            href="/autoservice/finance"
            accent="brand"
            className="max-lg:col-span-2"
          />
        ) : null}
      </section>

      {quickActions.length > 0 && (
        <section className="space-y-3">
          <SectionHeader title="Быстрые действия" />
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            {quickActions.map((action) => (
              <QuickAction key={action.href} {...action} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <SectionHeader
          title="Сегодня"
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
                onClick={() => navigate('/autoservice/planner')}
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
                    {item.zoneName ? ` · ${item.zoneName}` : ''}
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
      </section>
    </div>
  );
}
