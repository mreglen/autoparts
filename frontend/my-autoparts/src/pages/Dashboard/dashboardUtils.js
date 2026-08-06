import { getAvitoDisplayTotal } from '../Sales/avitoOrderDisplay';

const AVITO_INACTIVE = new Set(['closed', 'canceled', 'cancelled', 'rejected', 'refused']);

export function parseDashboardDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isWithinLastDays(date, days) {
  if (!date) return false;
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - days);
  return date >= cutoff;
}

export function saleLineTotal(sale) {
  return (parseFloat(sale.sale_price) || 0) * (parseInt(sale.quantity, 10) || 0);
}

export function isAvitoSale(sale) {
  return (
    sale.sale_channel === 'avito' ||
    sale.avito_order_id ||
    (sale.reason && String(sale.reason).toLowerCase().includes('авито'))
  );
}

export function isAvitoOrderActive(order) {
  const code = String(order.avito_status_code || '').toLowerCase().trim();
  if (!code) return true;
  return !AVITO_INACTIVE.has(code);
}

export function computeProductStats(products) {
  const list = Array.isArray(products) ? products : [];
  let totalValue = 0;
  let totalQty = 0;
  let zeroStock = 0;
  let lowStock = 0;

  list.forEach((p) => {
    const qty = parseInt(p.quantity, 10) || 0;
    const price = parseFloat(p.price) || 0;
    totalQty += qty;
    totalValue += price * qty;
    if (qty <= 0) zeroStock += 1;
    else if (qty <= 2) lowStock += 1;
  });

  return {
    totalProducts: list.length,
    totalWarehouseValue: totalValue,
    totalWarehouseQuantity: totalQty,
    zeroStock,
    lowStock,
  };
}

export function computeWarehouseSalesStats(sales) {
  const list = Array.isArray(sales) ? sales : [];
  let totalRevenue = 0;
  let revenue7d = 0;
  let revenue30d = 0;
  let count7d = 0;
  let avitoRevenue = 0;
  let warehouseRevenue = 0;
  let avitoCount = 0;
  let warehouseCount = 0;

  list.forEach((sale) => {
    const amount = saleLineTotal(sale);
    if (amount <= 0) return;

    totalRevenue += amount;
    const date = parseDashboardDate(sale.movement_date);
    if (isWithinLastDays(date, 7)) {
      revenue7d += amount;
      count7d += 1;
    }
    if (isWithinLastDays(date, 30)) {
      revenue30d += amount;
    }

    if (isAvitoSale(sale)) {
      avitoRevenue += amount;
      avitoCount += 1;
    } else {
      warehouseRevenue += amount;
      warehouseCount += 1;
    }
  });

  const sorted = [...list].sort((a, b) => {
    const da = parseDashboardDate(a.movement_date)?.getTime() || 0;
    const db = parseDashboardDate(b.movement_date)?.getTime() || 0;
    return db - da;
  });

  return {
    warehouseSalesCount: list.filter((s) => saleLineTotal(s) > 0).length,
    totalSales: totalRevenue,
    revenue7d,
    revenue30d,
    count7d,
    avitoRevenue,
    warehouseRevenue,
    avitoCount,
    warehouseCount,
    recentSales: sorted.filter((s) => saleLineTotal(s) > 0).slice(0, 6),
  };
}

export function computeAvitoStats(orders) {
  const list = Array.isArray(orders) ? orders : [];
  let active = 0;
  let closed = 0;
  let pipelineSum = 0;

  list.forEach((order) => {
    const code = String(order.avito_status_code || '').toLowerCase().trim();
    if (code === 'closed') {
      closed += 1;
    } else if (isAvitoOrderActive(order)) {
      active += 1;
      pipelineSum += getAvitoDisplayTotal(order);
    }
  });

  const recentActive = list
    .filter(isAvitoOrderActive)
    .slice(0, 5);

  return {
    total: list.length,
    active,
    closed,
    pipelineSum,
    recentActive,
  };
}

export function computeGarageUsedStats(orders) {
  const list = Array.isArray(orders) ? orders : [];
  const byStatus = {};
  list.forEach((o) => {
    const code = o.status_code || 'unknown';
    byStatus[code] = (byStatus[code] || 0) + 1;
  });
  const active = list.filter(
    (o) => !['closed', 'cancelled', 'canceled', 'delivered'].includes(o.status_code)
  ).length;
  return { total: list.length, active, byStatus };
}

export function computeStockOutStats(stockOuts) {
  const list = Array.isArray(stockOuts) ? stockOuts : [];
  let writeoffs30d = 0;
  list.forEach((row) => {
    const isSale =
      (parseFloat(row.sale_price) || 0) > 0 ||
      row.sale_channel === 'avito' ||
      row.avito_order_id;
    if (isSale) return;
    const date = parseDashboardDate(row.movement_date);
    if (isWithinLastDays(date, 30)) writeoffs30d += 1;
  });
  return { writeoffs30d, total: list.length };
}

export function computeStockInStats(stockIns) {
  const list = Array.isArray(stockIns) ? stockIns : [];
  let count30d = 0;
  let qty30d = 0;
  list.forEach((row) => {
    const date = parseDashboardDate(row.created_at || row.movement_date);
    if (!isWithinLastDays(date, 30)) return;
    count30d += 1;
    qty30d += parseInt(row.quantity, 10) || 0;
  });
  return { count30d, qty30d, total: list.length };
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

export function formatShortDate(value) {
  const d = parseDashboardDate(value);
  if (!d) return '—';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

const TASKS_SECTION_HIDDEN_PREFIX = 'dashboard_tasks_section_hidden';

export function isDashboardTasksSectionHidden(userId) {
  if (!userId || typeof localStorage === 'undefined') return false;
  return localStorage.getItem(`${TASKS_SECTION_HIDDEN_PREFIX}_${userId}`) === '1';
}

export function setDashboardTasksSectionHidden(userId, hidden) {
  if (!userId || typeof localStorage === 'undefined') return;
  if (hidden) {
    localStorage.setItem(`${TASKS_SECTION_HIDDEN_PREFIX}_${userId}`, '1');
  } else {
    localStorage.removeItem(`${TASKS_SECTION_HIDDEN_PREFIX}_${userId}`);
  }
}
