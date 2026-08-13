import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import { apiAxios } from '../../utils/apiClient';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  SectionHeader,
  Skeleton,
} from '../../components/UI';
import {
  computeProductStats,
  computeWarehouseSalesStats,
  formatCurrency,
  formatShortDate,
  isDashboardTasksSectionHidden,
  saleLineTotal,
  setDashboardTasksSectionHidden,
} from './dashboardUtils';
import SellerOnboardingPanel from './SellerOnboardingPanel';
import { warehousePageClass } from '../../utils/warehouseListUi';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Доброе утро';
  if (hour < 18) return 'Добрый день';
  return 'Добрый вечер';
}

function getFirstName(user) {
  const raw = (user?.name || user?.username || '').trim();
  if (!raw) return null;
  return raw.split(/\s+/)[0];
}

function MetricCard({ label, value, hint, href, accent = 'brand' }) {
  const accents = {
    brand: {
      card: 'border-brand-100 bg-brand-50/50',
      value: 'text-brand-800',
    },
    success: {
      card: 'border-success-100 bg-success-50/50',
      value: 'text-success-700',
    },
    warning: {
      card: 'border-warning-100 bg-warning-50/50',
      value: 'text-warning-700',
    },
  };
  const tone = accents[accent] || accents.brand;

  const content = (
    <>
      <p className="text-sm font-medium text-ink-muted">{label}</p>
      <p className={`mt-3 text-2xl font-bold tabular-nums tracking-tight sm:text-[1.75rem] ${tone.value}`}>
        {value}
      </p>
      {hint ? <p className="mt-2 text-sm text-ink-faint">{hint}</p> : null}
    </>
  );

  if (href) {
    return (
      <Card as={Link} to={href} hover padding="md" className={`block ${tone.card}`}>
        {content}
      </Card>
    );
  }
  return <Card padding="md" className={tone.card}>{content}</Card>;
}

const TASK_TONE = {
  high: 'danger',
  medium: 'warning',
  low: 'neutral',
};

const TASK_DOT = {
  high: 'bg-danger-600',
  medium: 'bg-warning-600',
  low: 'bg-ink-faint',
};

function TaskRow({ task, onNavigate }) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(task.url)}
      className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-gray-50/80"
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${TASK_DOT[task.severity] || TASK_DOT.low}`} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{task.title}</span>
        {task.hint ? (
          <span className="mt-0.5 block text-sm text-ink-muted">{task.hint}</span>
        ) : null}
      </span>
      <Badge tone={TASK_TONE[task.severity] || 'neutral'} className="tabular-nums">
        {task.count}
      </Badge>
    </button>
  );
}

const ACTION_TONES = {
  brand: 'bg-brand-50 text-brand-600',
  sky: 'bg-sky-50 text-sky-600',
  success: 'bg-success-50 text-success-600',
  accent: 'bg-accent-50 text-accent-600',
};

function QuickAction({ label, description, href, icon, tone = 'brand' }) {
  return (
    <Card as={Link} to={href} hover padding="sm" className="flex items-center gap-3">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${ACTION_TONES[tone] || ACTION_TONES.brand}`}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        <span className="mt-0.5 block text-xs text-ink-muted">{description}</span>
      </span>
    </Card>
  );
}

const ICONS = {
  orders: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    </svg>
  ),
  chats: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  parts: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  sales: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { isReady, user } = useAuthReady();
  const permissionCodes = useSelector((state) => state.auth.permissionCodes);
  const [loading, setLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [onboarding, setOnboarding] = useState(null);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [tasksSectionHidden, setTasksSectionHidden] = useState(false);

  const canAccess = Boolean(user?.is_admin || user?.is_seller || user?.is_employee);
  const showOnboarding = Boolean(user?.is_seller || user?.is_director);
  const canViewFinance = Boolean(
    user?.is_admin
    || user?.is_seller
    || (user?.is_employee && permissionCodes?.includes('finance.reports'))
  );
  const canViewSales = Boolean(
    user?.is_admin
    || user?.is_seller
    || (user?.is_employee && permissionCodes?.includes('sales.orders'))
  );
  const canViewParts = Boolean(
    user?.is_admin
    || user?.is_seller
    || (user?.is_employee && permissionCodes?.includes('my-parts'))
  );

  useEffect(() => {
    if (!isReady) return;
    if (!canAccess) navigate('/', { replace: true });
  }, [isReady, canAccess, navigate]);

  useEffect(() => {
    if (!user?.id) return;
    setTasksSectionHidden(isDashboardTasksSectionHidden(user.id));
  }, [user?.id]);

  const loadDashboard = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setTasksLoading(true);
    setOnboardingLoading(showOnboarding);
    setError(null);

    try {
      const requests = [
        apiAxios.get('/products/'),
        apiAxios.get('/dashboard/tasks'),
      ];
      if (canViewFinance) {
        requests.push(apiAxios.get('/stock-outs/sales'));
      }
      if (showOnboarding) {
        requests.push(apiAxios.get('/dashboard/onboarding'));
      }

      const results = await Promise.allSettled(requests);

      let idx = 0;
      const products = results[idx].status === 'fulfilled' ? results[idx].value.data : [];
      idx += 1;

      const tasksResult = results[idx];
      idx += 1;
      if (tasksResult.status === 'fulfilled') {
        setTasks(tasksResult.value.data?.tasks || []);
      } else {
        setTasks([]);
      }
      setTasksLoading(false);

      let sales = null;
      if (canViewFinance) {
        const salesResult = results[idx];
        idx += 1;
        if (salesResult.status === 'fulfilled') {
          sales = computeWarehouseSalesStats(salesResult.value.data);
        }
      }

      if (showOnboarding) {
        const onboardingResult = results[idx];
        if (onboardingResult?.status === 'fulfilled') {
          setOnboarding(onboardingResult.value.data);
        } else {
          setOnboarding(null);
        }
      } else {
        setOnboarding(null);
      }
      setOnboardingLoading(false);

      setData({
        ...computeProductStats(products),
        sales,
      });
    } catch (e) {
      console.error(e);
      setError('Не удалось загрузить обзор');
      setTasks([]);
      setTasksLoading(false);
      setOnboarding(null);
      setOnboardingLoading(false);
    } finally {
      setLoading(false);
    }
  }, [user, showOnboarding, canViewFinance]);

  useEffect(() => {
    if (isReady && canAccess) loadDashboard();
  }, [isReady, canAccess, loadDashboard]);

  const quickActions = useMemo(() => {
    const actions = [];
    if (canViewSales) {
      actions.push({
        label: 'Заказы',
        description: 'Новые и в работе',
        href: '/sales/orders',
        icon: ICONS.orders,
        tone: 'brand',
      });
    }
    actions.push({
      label: 'Сообщения',
      description: 'Чаты с покупателями',
      href: '/chats',
      icon: ICONS.chats,
      tone: 'sky',
    });
    if (canViewParts) {
      actions.push({
        label: 'Запчасти',
        description: 'Склад и остатки',
        href: '/my-parts',
        icon: ICONS.parts,
        tone: 'success',
      });
    }
    if (canViewFinance) {
      actions.push({
        label: 'Продажи',
        description: 'История продаж',
        href: '/warehouse-sales',
        icon: ICONS.sales,
        tone: 'accent',
      });
    }
    return actions;
  }, [canViewSales, canViewParts, canViewFinance]);

  const firstName = getFirstName(user);

  const urgentTasks = useMemo(
    () => (tasks || []).filter((task) => task.severity === 'high'),
    [tasks],
  );
  const otherTasks = useMemo(
    () => (tasks || []).filter((task) => task.severity !== 'high'),
    [tasks],
  );

  const toggleTasksSection = useCallback((hidden) => {
    if (!user?.id) return;
    setDashboardTasksSectionHidden(user.id, hidden);
    setTasksSectionHidden(hidden);
  }, [user?.id]);

  if (!isReady) return <AuthLoadingScreen />;
  if (!canAccess) return null;

  if (loading) {
    return (
      <div className={`${warehousePageClass} w-full min-w-0 space-y-8 pb-12`}>
        <div className="space-y-2">
          <Skeleton className="h-8 w-56 sm:h-9" />
          <Skeleton className="h-4 w-64" />
        </div>
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        <section className="space-y-3">
          <Skeleton className="h-6 w-44" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 py-2">
                <Skeleton className="h-2 w-2 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/5" />
                  <Skeleton className="h-3 w-2/5" />
                </div>
                <Skeleton className="h-6 w-10 rounded-full" />
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={`${warehousePageClass} w-full min-w-0`}>
        <EmptyState
          illustration="error"
          title={error || 'Нет данных'}
          description="Не удалось загрузить обзор магазина. Попробуйте ещё раз."
          actionLabel="Попробовать снова"
          onAction={loadDashboard}
        />
      </div>
    );
  }

  const { sales } = data;
  const recentSales = sales?.recentSales?.slice(0, 4) || [];

  return (
    <div className={`${warehousePageClass} w-full min-w-0 space-y-8 pb-12`}>
      {showOnboarding && (
        <SellerOnboardingPanel onboarding={onboarding} loading={onboardingLoading} />
      )}

      <PageHeader
        className="mb-0"
        title={`${getGreeting()}${firstName ? `, ${firstName}` : ''}`}
        subtitle="Краткий обзор магазина на сегодня"
      />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {canViewFinance && sales ? (
          <>
            <MetricCard
              label="Выручка за 30 дней"
              value={formatCurrency(sales.revenue30d)}
              hint={`За 7 дней: ${formatCurrency(sales.revenue7d)}`}
              href="/warehouse-sales"
              accent="brand"
            />
            <MetricCard
              label="На складе"
              value={`${data.totalWarehouseQuantity.toLocaleString('ru-RU')} шт.`}
              hint={`${data.totalProducts} позиций · ${formatCurrency(data.totalWarehouseValue)}`}
              href="/my-parts"
              accent="success"
            />
            <MetricCard
              label="Нужно внимание"
              value={tasks.length}
              hint={tasks.length === 0 ? 'Всё в порядке' : `${urgentTasks.length} срочных`}
              accent={tasks.length === 0 ? 'success' : 'warning'}
            />
          </>
        ) : (
          <>
            <MetricCard
              label="На складе"
              value={`${data.totalWarehouseQuantity.toLocaleString('ru-RU')} шт.`}
              hint={`${data.totalProducts} позиций`}
              href={canViewParts ? '/my-parts' : undefined}
              accent="success"
            />
            {data.lowStock > 0 ? (
              <MetricCard
                label="Мало на складе"
                value={data.lowStock}
                hint="1–2 шт. на позицию"
                href={canViewParts ? '/my-parts?stock=low' : undefined}
                accent="warning"
              />
            ) : (
              <MetricCard
                label="Задачи"
                value={tasks.length}
                hint={tasks.length === 0 ? 'Всё в порядке' : 'Требуют действий'}
                accent={tasks.length === 0 ? 'success' : 'warning'}
              />
            )}
          </>
        )}
      </section>

      {quickActions.length > 0 && (
        <section className="space-y-3">
          <SectionHeader title="Быстрые действия" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {quickActions.map((action) => (
              <QuickAction key={action.href} {...action} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        {tasksSectionHidden ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-100 px-4 py-3">
            <span className="text-sm text-ink-muted">
              Блок «Требует внимания» скрыт
              {tasks.length > 0 ? ` · ${tasks.length} задач` : ''}
            </span>
            <Button size="sm" variant="secondary" onClick={() => toggleTasksSection(false)}>
              Показать
            </Button>
          </div>
        ) : (
          <>
            <SectionHeader
              title="Требует внимания"
              subtitle={tasks.length > 0 ? `${tasks.length} задач` : undefined}
              action={(
                <Button size="sm" variant="ghost" onClick={() => toggleTasksSection(true)}>
                  Скрыть
                </Button>
              )}
            />

            {tasksLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : tasks.length === 0 ? (
              <EmptyState
                illustration="success"
                title="Всё в порядке"
                description="Срочных задач нет — можно спокойно работать"
              />
            ) : (
              <div className="divide-y divide-gray-100">
                {urgentTasks.map((task) => (
                  <TaskRow key={task.id} task={task} onNavigate={navigate} />
                ))}
                {otherTasks.map((task) => (
                  <TaskRow key={task.id} task={task} onNavigate={navigate} />
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {canViewFinance && recentSales.length > 0 && (
        <section className="space-y-3">
          <SectionHeader
            title="Последние продажи"
            action={(
              <Button as={Link} to="/warehouse-sales" variant="ghost" size="sm">
                Все
              </Button>
            )}
          />
          <ul className="divide-y divide-gray-100">
            {recentSales.map((sale) => (
              <li key={sale.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {sale.product?.brand ? `${sale.product.brand} · ` : ''}
                    {sale.product?.article || sale.product?.name || `#${sale.product_id}`}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {formatShortDate(sale.movement_date)} · {sale.quantity} шт.
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums text-success-700">
                  {formatCurrency(saleLineTotal(sale))}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
