import React, { useState, useEffect, useCallback } from 'react';
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

function KpiCard({ label, value, sub, accent = 'indigo', onClick }) {
  const accents = {
    indigo: 'from-indigo-600 to-blue-700',
    emerald: 'from-emerald-600 to-teal-700',
    amber: 'from-amber-500 to-orange-600',
    slate: 'from-slate-700 to-slate-900',
  };
  const inner = (
    <div
      className={`rounded-xl bg-gradient-to-br ${accents[accent] || accents.indigo} p-5 text-white shadow-lg ${
        onClick ? 'cursor-pointer hover:shadow-xl transition-shadow' : ''
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-white/80">{label}</p>
      <p className="mt-2 text-2xl sm:text-3xl font-bold leading-tight break-words">{value}</p>
      {sub ? <p className="mt-2 text-sm text-white/75">{sub}</p> : null}
    </div>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="w-full text-left">
        {inner}
      </button>
    );
  }
  return inner;
}

function MetricTile({ label, value, hint, color = 'gray' }) {
  const colors = {
    blue: 'bg-blue-50 border-blue-100 text-blue-700',
    yellow: 'bg-amber-50 border-amber-100 text-amber-800',
    green: 'bg-green-50 border-green-100 text-green-800',
    purple: 'bg-purple-50 border-purple-100 text-purple-800',
    red: 'bg-red-50 border-red-100 text-red-800',
    gray: 'bg-gray-50 border-gray-100 text-gray-700',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color] || colors.gray}`}>
      <p className="text-xs font-semibold uppercase opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-gray-600">{hint}</p> : null}
    </div>
  );
}

function Section({ title, icon, children, action }) {
  return (
    <section className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          {icon ? <div className="p-2 rounded-lg bg-gray-100 text-gray-600">{icon}</div> : null}
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { isReady, user } = useAuthReady();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const canAccess = Boolean(user?.is_admin || user?.is_seller || user?.is_employee);

  useEffect(() => {
    if (!isReady) return;
    if (!canAccess) navigate('/', { replace: true });
  }, [isReady, canAccess, navigate]);

  const loadDashboard = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const results = await Promise.allSettled([
        apiAxios.get('/products/'),
        apiAxios.get('/stock-outs/sales'),
        apiAxios.get('/stock-outs/'),
        apiAxios.get('/stock-ins/'),
      ]);

      const pick = (idx, fallback = []) =>
        results[idx].status === 'fulfilled' ? results[idx].value.data : fallback;

      const products = pick(0);
      const sales = pick(1);
      const stockOuts = pick(2);
      const stockIns = pick(3);

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
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isReady && canAccess) loadDashboard();
  }, [isReady, canAccess, loadDashboard]);

  if (!isReady) return <AuthLoadingScreen />;
  if (!canAccess) return null;

  if (loading) {
    return (
      <div className="mt-4 sm:mt-5 px-4 sm:px-0 space-y-6">
        <div className="h-10 w-48 bg-gray-200 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-gray-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mt-8 text-center">
        <p className="text-red-600 mb-4">{error || 'Нет данных'}</p>
        <button
          type="button"
          onClick={loadDashboard}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Повторить
        </button>
      </div>
    );
  }

  const { sales, stockOuts, stockIns } = data;

  return (
    <div className="mt-4 sm:mt-5 px-4 sm:px-0 pb-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Обзор</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">
            Склад и фактические продажи
          </p>
        </div>
        <button
          type="button"
          onClick={loadDashboard}
          className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100"
        >
          Обновить
        </button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          label="Выручка, всего"
          value={formatCurrency(sales.totalSales)}
          sub={`${sales.warehouseSalesCount} продаж · в т.ч. Авито ${sales.avitoCount}`}
          accent="indigo"
          onClick={() => navigate('/warehouse-sales')}
        />
        <KpiCard
          label="За 30 дней"
          value={formatCurrency(sales.revenue30d)}
          sub={`За 7 дней: ${formatCurrency(sales.revenue7d)} (${sales.count7d} продаж)`}
          accent="emerald"
        />
        <KpiCard
          label="Склад"
          value={formatCurrency(data.totalWarehouseValue)}
          sub={`${data.totalWarehouseQuantity.toLocaleString('ru-RU')} шт. · ${data.totalProducts} позиций`}
          accent="amber"
          onClick={() => navigate('/my-parts')}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Продажи по каналам */}
        <div className="lg:col-span-2">
          <Section
            title="Продажи со склада"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            }
            action={
              <Link to="/warehouse-sales" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
                Все продажи →
              </Link>
            }
          >
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <MetricTile label="Ручные" value={formatCurrency(sales.warehouseRevenue)} hint={`${sales.warehouseCount} операций`} color="green" />
              <MetricTile label="Авито" value={formatCurrency(sales.avitoRevenue)} hint={`${sales.avitoCount} в журнале`} color="blue" />
              <MetricTile label="7 дней" value={formatCurrency(sales.revenue7d)} hint={`${sales.count7d} продаж`} color="purple" />
              <MetricTile label="Списания 30д" value={stockOuts.writeoffs30d} hint="без продажи" color="red" />
            </div>

            {sales.recentSales.length === 0 ? (
              <p className="text-gray-500 text-sm py-4 text-center">Пока нет зафиксированных продаж</p>
            ) : (
              <ResponsiveDataView
                isEmpty={false}
                renderDesktop={() => (
              <div className="overflow-x-auto -mx-1">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 uppercase border-b">
                      <th className="pb-2 pr-3 font-semibold">Дата</th>
                      <th className="pb-2 pr-3 font-semibold">Запчасть</th>
                      <th className="pb-2 pr-3 font-semibold text-center">Кол-во</th>
                      <th className="pb-2 pr-3 font-semibold">Канал</th>
                      <th className="pb-2 font-semibold text-right">Сумма</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sales.recentSales.map((sale) => (
                      <tr key={sale.id} className="hover:bg-gray-50">
                        <td className="py-2.5 pr-3 text-gray-600 whitespace-nowrap">{formatShortDate(sale.movement_date)}</td>
                        <td className="py-2.5 pr-3">
                          <div className="font-medium text-gray-900 line-clamp-1">
                            {sale.product?.brand ? `${sale.product.brand} · ` : ''}
                            {sale.product?.article || sale.product?.name || `#${sale.product_id}`}
                          </div>
                        </td>
                        <td className="py-2.5 pr-3 text-center">{sale.quantity}</td>
                        <td className="py-2.5 pr-3">
                          {isAvitoSale(sale) ? (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Авито</span>
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">Склад</span>
                          )}
                        </td>
                        <td className="py-2.5 text-right font-semibold text-gray-900 whitespace-nowrap">
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
                      className="rounded-xl border border-gray-100 bg-gray-50/80 p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs text-gray-500">{formatShortDate(sale.movement_date)}</p>
                          <p className="mt-1 font-semibold text-gray-900">
                            {sale.product?.brand ? `${sale.product.brand} · ` : ''}
                            {sale.product?.article || sale.product?.name || `#${sale.product_id}`}
                          </p>
                        </div>
                        <p className="shrink-0 text-base font-bold text-gray-900">
                          {formatCurrency(saleLineTotal(sale))}
                        </p>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-sm">
                        <span className="text-gray-600">{sale.quantity} шт.</span>
                        {isAvitoSale(sale) ? (
                          <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                            Авито
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                            Склад
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                }
              />
            )}
          </Section>
        </div>

        {/* Склад */}
        <Section
          title="Склад"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          }
          action={
            <Link to="/stock-out" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
              Расходы →
            </Link>
          }
        >
          <div className="space-y-3">
            <MetricTile label="Позиций" value={data.totalProducts} color="gray" />
            <MetricTile label="Единиц на складе" value={data.totalWarehouseQuantity.toLocaleString('ru-RU')} color="green" />
            <MetricTile label="Поступления за 30 д" value={stockIns.count30d} hint={`${stockIns.qty30d} шт. принято`} color="blue" />
            <MetricTile label="Нулевой остаток" value={data.zeroStock} hint="нужно пополнить или списать" color="red" />
          </div>
        </Section>
      </div>
    </div>
  );
}
