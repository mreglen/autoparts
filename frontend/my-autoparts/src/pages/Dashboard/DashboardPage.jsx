import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import { apiAxios } from '../../utils/apiClient';
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

function MetricCard({ label, value, hint, href, accent = 'indigo' }) {
  const accents = {
    indigo: 'from-indigo-500/10 to-indigo-600/5 ring-indigo-500/10',
    emerald: 'from-emerald-500/10 to-emerald-600/5 ring-emerald-500/10',
    amber: 'from-amber-500/10 to-amber-600/5 ring-amber-500/10',
  };

  const className = `group block rounded-2xl bg-gradient-to-br ${accents[accent]} p-5 ring-1 transition-all hover:shadow-md hover:-translate-y-0.5`;

  const content = (
    <>
      <p className="text-sm font-medium text-gray-600">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 tabular-nums">{value}</p>
      {hint ? <p className="mt-2 text-sm text-gray-500">{hint}</p> : null}
    </>
  );

  if (href) {
    return (
      <Link to={href} className={className}>
        {content}
      </Link>
    );
  }
  return <div className={className}>{content}</div>;
}

const TASK_STYLES = {
  high: {
    ring: 'ring-red-200/80',
    bg: 'bg-red-50/80',
    dot: 'bg-red-500',
    badge: 'bg-red-100 text-red-700',
  },
  medium: {
    ring: 'ring-amber-200/80',
    bg: 'bg-amber-50/80',
    dot: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-800',
  },
  low: {
    ring: 'ring-gray-200',
    bg: 'bg-gray-50/80',
    dot: 'bg-gray-400',
    badge: 'bg-gray-100 text-gray-700',
  },
};

function TaskCard({ task, onNavigate }) {
  const style = TASK_STYLES[task.severity] || TASK_STYLES.low;

  return (
    <button
      type="button"
      onClick={() => onNavigate(task.url)}
      className={`flex w-full items-center gap-4 rounded-xl p-4 text-left ring-1 transition-all hover:shadow-sm ${style.ring} ${style.bg}`}
    >
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-gray-900">{task.title}</span>
        {task.hint ? (
          <span className="mt-0.5 block text-sm text-gray-600">{task.hint}</span>
        ) : null}
      </span>
      <span className={`shrink-0 rounded-full px-2.5 py-1 text-sm font-bold tabular-nums ${style.badge}`}>
        {task.count}
      </span>
    </button>
  );
}

function QuickAction({ label, description, href, icon }) {
  return (
    <Link
      to={href}
      className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-indigo-200 hover:bg-indigo-50/40 hover:shadow-sm"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-gray-900">{label}</span>
        <span className="mt-0.5 block text-xs text-gray-500">{description}</span>
      </span>
    </Link>
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
      });
    }
    actions.push({
      label: 'Сообщения',
      description: 'Чаты с покупателями',
      href: '/chats',
      icon: ICONS.chats,
    });
    if (canViewParts) {
      actions.push({
        label: 'Запчасти',
        description: 'Склад и остатки',
        href: '/my-parts',
        icon: ICONS.parts,
      });
    }
    if (canViewFinance) {
      actions.push({
        label: 'Продажи',
        description: 'История продаж',
        href: '/warehouse-sales',
        icon: ICONS.sales,
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
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-0 space-y-6">
        <div className="h-10 w-56 rounded-lg bg-gray-100 animate-pulse" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
        <div className="h-40 rounded-2xl bg-gray-100 animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-gray-600">{error || 'Нет данных'}</p>
        <button
          type="button"
          onClick={loadDashboard}
          className="mt-4 text-sm font-medium text-indigo-600 hover:text-indigo-800"
        >
          Попробовать снова
        </button>
      </div>
    );
  }

  const { sales } = data;
  const recentSales = sales?.recentSales?.slice(0, 4) || [];

  return (
    <div className="mx-auto max-w-4xl px-4 pb-12 pt-2 sm:px-0 sm:pt-4 space-y-8">
      {showOnboarding && (
        <SellerOnboardingPanel onboarding={onboarding} loading={onboardingLoading} />
      )}

      <header>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
          {getGreeting()}
          {firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Краткий обзор магазина на сегодня
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {canViewFinance && sales ? (
          <>
            <MetricCard
              label="Выручка за 30 дней"
              value={formatCurrency(sales.revenue30d)}
              hint={`За 7 дней: ${formatCurrency(sales.revenue7d)}`}
              href="/warehouse-sales"
              accent="indigo"
            />
            <MetricCard
              label="На складе"
              value={`${data.totalWarehouseQuantity.toLocaleString('ru-RU')} шт.`}
              hint={`${data.totalProducts} позиций · ${formatCurrency(data.totalWarehouseValue)}`}
              href="/my-parts"
              accent="emerald"
            />
            <MetricCard
              label="Нужно внимание"
              value={tasks.length}
              hint={tasks.length === 0 ? 'Всё в порядке' : `${urgentTasks.length} срочных`}
              accent="amber"
            />
          </>
        ) : (
          <>
            <MetricCard
              label="На складе"
              value={`${data.totalWarehouseQuantity.toLocaleString('ru-RU')} шт.`}
              hint={`${data.totalProducts} позиций`}
              href={canViewParts ? '/my-parts' : undefined}
              accent="emerald"
            />
            {data.lowStock > 0 ? (
              <MetricCard
                label="Мало на складе"
                value={data.lowStock}
                hint="1–2 шт. на позицию"
                href={canViewParts ? '/my-parts?stock=low' : undefined}
                accent="amber"
              />
            ) : (
              <MetricCard
                label="Задачи"
                value={tasks.length}
                hint={tasks.length === 0 ? 'Всё в порядке' : 'Требуют действий'}
                accent="amber"
              />
            )}
          </>
        )}
      </section>

      {quickActions.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Быстрые действия
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {quickActions.map((action) => (
              <QuickAction key={action.href} {...action} />
            ))}
          </div>
        </section>
      )}

      <section>
        {tasksSectionHidden ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <span className="text-sm text-gray-600">
              Блок «Требует внимания» скрыт
              {tasks.length > 0 ? ` · ${tasks.length} задач` : ''}
            </span>
            <button
              type="button"
              onClick={() => toggleTasksSection(false)}
              className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-indigo-600 shadow-sm ring-1 ring-gray-200 hover:bg-indigo-50"
            >
              Показать
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900">Требует внимания</h2>
              <div className="flex items-center gap-3">
                {tasks.length > 0 && (
                  <span className="text-sm text-gray-500">{tasks.length} задач</span>
                )}
                <button
                  type="button"
                  onClick={() => toggleTasksSection(true)}
                  className="rounded-lg px-2.5 py-1 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
                >
                  Скрыть
                </button>
              </div>
            </div>

            {tasksLoading ? (
              <div className="mt-4 space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : tasks.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/50 px-5 py-8 text-center">
                <p className="text-base font-medium text-emerald-900">Всё в порядке</p>
                <p className="mt-1 text-sm text-emerald-700/80">Срочных задач нет — можно спокойно работать</p>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {urgentTasks.map((task) => (
                  <TaskCard key={task.id} task={task} onNavigate={navigate} />
                ))}
                {otherTasks.map((task) => (
                  <TaskCard key={task.id} task={task} onNavigate={navigate} />
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {canViewFinance && recentSales.length > 0 && (
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-900">Последние продажи</h2>
            <Link to="/warehouse-sales" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
              Все →
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-gray-100">
            {recentSales.map((sale) => (
              <li key={sale.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {sale.product?.brand ? `${sale.product.brand} · ` : ''}
                    {sale.product?.article || sale.product?.name || `#${sale.product_id}`}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {formatShortDate(sale.movement_date)} · {sale.quantity} шт.
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">
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
