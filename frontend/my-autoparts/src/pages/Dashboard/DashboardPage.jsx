import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import { apiAxios } from '../../utils/apiClient';
import {
  computeProductStats,
  computeWarehouseSalesStats,
  computeStockOutStats,
  computeStockInStats,
  formatCurrency,
  formatShortDate,
  saleLineTotal,
  isAvitoSale,
} from './dashboardUtils';
import ResponsiveDataView from '../../components/ResponsiveDataView/ResponsiveDataView';
import SellerOnboardingPanel from './SellerOnboardingPanel';

function StatCard({ label, value, note, href, onClick }) {
  const content = (
    <>
      <p className="text-[13px] text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-gray-900 tabular-nums">{value}</p>
      {note ? <p className="mt-1.5 text-xs text-gray-400 leading-snug">{note}</p> : null}
    </>
  );

  const className =
    'block rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-gray-300';

  if (href) {
    return (
      <Link to={href} className={className}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${className} w-full text-left`}>
        {content}
      </button>
    );
  }
  return <div className={className}>{content}</div>;
}

function Panel({ title, action, children, className = '' }) {
  return (
    <section className={`rounded-lg border border-gray-200 bg-white ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-gray-100">
          {title ? <h2 className="text-sm font-semibold text-gray-900">{title}</h2> : <span />}
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

function MiniStat({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-gray-900 tabular-nums">{value}</p>
    </div>
  );
}

const TASK_DOT = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-gray-300',
};

function AttentionTasksSection({ tasks, loading, onNavigate }) {
  if (loading) {
    return (
      <Panel title="Требует внимания">
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-11 rounded-md bg-gray-50 animate-pulse" />
          ))}
        </div>
      </Panel>
    );
  }

  if (!tasks?.length) {
    return (
      <Panel title="Требует внимания">
        <p className="text-sm text-gray-500">Срочных задач нет.</p>
      </Panel>
    );
  }

  return (
    <Panel title="Требует внимания">
      <ul className="divide-y divide-gray-100">
        {tasks.map((task) => (
          <li key={task.id}>
            <button
              type="button"
              onClick={() => onNavigate(task.url)}
              className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-gray-50 -mx-1 px-1 rounded-md"
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${TASK_DOT[task.severity] || TASK_DOT.low}`}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="text-sm text-gray-900">{task.title}</span>
                {task.hint ? (
                  <span className="ml-2 text-xs text-gray-400">{task.hint}</span>
                ) : null}
              </span>
              <span className="shrink-0 text-sm font-medium tabular-nums text-gray-700">
                {task.count}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

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

  const canAccess = Boolean(user?.is_admin || user?.is_seller || user?.is_employee);
  const showOnboarding = Boolean(user?.is_seller || user?.is_director);
  const canViewFinance = Boolean(
    user?.is_admin
    || user?.is_seller
    || (user?.is_employee && permissionCodes?.includes('finance.reports'))
  );

  useEffect(() => {
    if (!isReady) return;
    if (!canAccess) navigate('/', { replace: true });
  }, [isReady, canAccess, navigate]);

  const loadDashboard = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setTasksLoading(true);
    setOnboardingLoading(showOnboarding);
    setError(null);

    try {
      const requests = [
        apiAxios.get('/products/'),
        apiAxios.get('/stock-outs/sales'),
        apiAxios.get('/stock-outs/'),
        apiAxios.get('/stock-ins/'),
        apiAxios.get('/dashboard/tasks'),
      ];
      if (showOnboarding) {
        requests.push(apiAxios.get('/dashboard/onboarding'));
      }

      const results = await Promise.allSettled(requests);

      const pick = (idx, fallback = []) =>
        results[idx].status === 'fulfilled' ? results[idx].value.data : fallback;

      const products = pick(0);
      const sales = pick(1);
      const stockOuts = pick(2);
      const stockIns = pick(3);
      const tasksResult = results[4];
      const onboardingResult = showOnboarding ? results[5] : null;

      if (tasksResult.status === 'fulfilled') {
        setTasks(tasksResult.value.data?.tasks || []);
      } else {
        setTasks([]);
      }
      setTasksLoading(false);

      if (onboardingResult?.status === 'fulfilled') {
        setOnboarding(onboardingResult.value.data);
      } else {
        setOnboarding(null);
      }
      setOnboardingLoading(false);

      setData({
        products,
        ...computeProductStats(products),
        sales: computeWarehouseSalesStats(sales),
        stockOuts: computeStockOutStats(stockOuts),
        stockIns: computeStockInStats(stockIns),
      });
    } catch (e) {
      console.error(e);
      setError('Не удалось загрузить данные дашборда');
      setTasks([]);
      setTasksLoading(false);
      setOnboarding(null);
      setOnboardingLoading(false);
    } finally {
      setLoading(false);
    }
  }, [user, showOnboarding]);

  useEffect(() => {
    if (isReady && canAccess) loadDashboard();
  }, [isReady, canAccess, loadDashboard]);

  if (!isReady) return <AuthLoadingScreen />;
  if (!canAccess) return null;

  if (loading) {
    return (
      <div className="mt-4 sm:mt-6 px-4 sm:px-0 space-y-5 max-w-6xl">
        <div className="h-8 w-32 bg-gray-100 rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-56 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mt-12 text-center max-w-md mx-auto px-4">
        <p className="text-gray-600 mb-4">{error || 'Нет данных'}</p>
        <button
          type="button"
          onClick={loadDashboard}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
        >
          Попробовать снова
        </button>
      </div>
    );
  }

  const { sales, stockOuts, stockIns } = data;

  return (
    <div className="mt-4 sm:mt-6 px-4 sm:px-0 pb-12 max-w-6xl space-y-5">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-tight">Обзор</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {canViewFinance ? 'Продажи и склад' : 'Склад и задачи'}
          </p>
        </div>
        <button
          type="button"
          onClick={loadDashboard}
          className="text-sm text-gray-500 hover:text-gray-800 transition-colors shrink-0"
        >
          Обновить
        </button>
      </header>

      {showOnboarding && (
        <SellerOnboardingPanel onboarding={onboarding} loading={onboardingLoading} />
      )}

      {canViewFinance && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard
            label="Выручка"
            value={formatCurrency(sales.totalSales)}
            note={`${sales.warehouseSalesCount} продаж · Авито ${sales.avitoCount}`}
            onClick={() => navigate('/warehouse-sales')}
          />
          <StatCard
            label="За 30 дней"
            value={formatCurrency(sales.revenue30d)}
            note={`7 дней: ${formatCurrency(sales.revenue7d)}`}
          />
          <StatCard
            label="Склад"
            value={formatCurrency(data.totalWarehouseValue)}
            note={`${data.totalWarehouseQuantity.toLocaleString('ru-RU')} шт. · ${data.totalProducts} поз.`}
            href="/my-parts"
          />
        </div>
      )}

      {canViewFinance ? (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-3">
            <Panel
              title="Последние продажи"
              action={
                <Link to="/warehouse-sales" className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
                  Все →
                </Link>
              }
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5 pb-5 border-b border-gray-100">
                <MiniStat label="Ручные" value={formatCurrency(sales.warehouseRevenue)} />
                <MiniStat label="Авито" value={formatCurrency(sales.avitoRevenue)} />
                <MiniStat label="7 дней" value={formatCurrency(sales.revenue7d)} />
                <MiniStat label="Списания 30д" value={stockOuts.writeoffs30d} />
              </div>

              {sales.recentSales.length === 0 ? (
                <p className="text-sm text-gray-500 py-6 text-center">Продаж пока нет</p>
              ) : (
                <ResponsiveDataView
                  isEmpty={false}
                  renderDesktop={() => (
                    <div className="overflow-x-auto -mx-1">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                            <th className="pb-2 pr-4 font-normal">Дата</th>
                            <th className="pb-2 pr-4 font-normal">Запчасть</th>
                            <th className="pb-2 pr-4 font-normal text-center">Кол.</th>
                            <th className="pb-2 pr-4 font-normal">Канал</th>
                            <th className="pb-2 font-normal text-right">Сумма</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sales.recentSales.map((sale) => (
                            <tr key={sale.id} className="border-b border-gray-50 last:border-0">
                              <td className="py-2.5 pr-4 text-gray-500 whitespace-nowrap tabular-nums">
                                {formatShortDate(sale.movement_date)}
                              </td>
                              <td className="py-2.5 pr-4 text-gray-900">
                                <span className="line-clamp-1">
                                  {sale.product?.brand ? `${sale.product.brand} · ` : ''}
                                  {sale.product?.article || sale.product?.name || `#${sale.product_id}`}
                                </span>
                              </td>
                              <td className="py-2.5 pr-4 text-center tabular-nums text-gray-600">
                                {sale.quantity}
                              </td>
                              <td className="py-2.5 pr-4 text-xs text-gray-500">
                                {isAvitoSale(sale) ? 'Авито' : 'Склад'}
                              </td>
                              <td className="py-2.5 text-right font-medium tabular-nums text-gray-900">
                                {formatCurrency(saleLineTotal(sale))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  renderMobile={() =>
                    sales.recentSales.map((sale) => (
                      <div
                        key={sale.id}
                        className="flex items-start justify-between gap-3 py-3 border-b border-gray-100 last:border-0"
                      >
                        <div className="min-w-0">
                          <p className="text-sm text-gray-900 truncate">
                            {sale.product?.brand ? `${sale.product.brand} · ` : ''}
                            {sale.product?.article || sale.product?.name || `#${sale.product_id}`}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-400">
                            {formatShortDate(sale.movement_date)} · {sale.quantity} шт. ·{' '}
                            {isAvitoSale(sale) ? 'Авито' : 'Склад'}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-medium tabular-nums text-gray-900">
                          {formatCurrency(saleLineTotal(sale))}
                        </p>
                      </div>
                    ))
                  }
                />
              )}
            </Panel>
          </div>

          <div className="lg:col-span-2">
            <Panel
              title="Склад"
              action={
                <Link to="/stock-out" className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
                  Расходы →
                </Link>
              }
            >
              <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                <MiniStat label="Позиций" value={data.totalProducts} />
                <MiniStat label="Единиц" value={data.totalWarehouseQuantity.toLocaleString('ru-RU')} />
                <MiniStat label="Поступления 30д" value={stockIns.count30d} />
                <MiniStat label="Нулевой остаток" value={data.zeroStock} />
              </div>
            </Panel>
          </div>
        </div>
      ) : (
        <Panel
          title="Склад"
          action={
            <Link to="/my-parts" className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
              Мои запчасти →
            </Link>
          }
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MiniStat label="Позиций" value={data.totalProducts} />
            <MiniStat label="На складе" value={data.totalWarehouseQuantity.toLocaleString('ru-RU')} />
            <MiniStat label="Поступления 30д" value={stockIns.count30d} />
            <MiniStat label="Низкий остаток" value={data.lowStock} />
          </div>
        </Panel>
      )}

      <AttentionTasksSection
        tasks={tasks}
        loading={tasksLoading}
        onNavigate={(url) => navigate(url)}
      />
    </div>
  );
}
