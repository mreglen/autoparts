import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { apiRequest } from '../../utils/apiClient';

const mockNavigate = vi.fn();
const mockSetSearchParams = vi.fn();
let mockSearchParams = new URLSearchParams('');

const ROSSKO_REPORT = {
  summary: {
    count: 1,
    sale_total: 1000,
    supplier_total: 700,
    acquiring_fee: 30,
    refund_total: 0,
    margin: 270,
    site_income: 18.9,
    organization_income: 251.1,
    pending_count: 0,
  },
  items: [
    {
      order_id: 42,
      rossko_order_id: 'RK-42',
      buyer_name: 'Иван Петров',
      operation_at: '2026-08-10T12:05:00Z',
      payment_method: 'sbp',
      payment_method_label: 'СБП',
      sale_total: 1000,
      supplier_total: 700,
      acquiring_fee: 30,
      refund_amount: 0,
      refund_at: null,
      margin: 270,
      site_income: 18.9,
      organization_income: 251.1,
      pending_acquiring: false,
      items: [
        {
          item_id: 1,
          brand: 'MANN',
          partnumber: 'W712/75',
          name: 'Фильтр масляный',
          quantity: 1,
          sale_total: 1000,
          supplier_total: 700,
          organization_income: 251.1,
        },
      ],
    },
  ],
};

const PAYROLL_REPORT = {
  year: 2026,
  month: 11,
  total: 3000,
  employees: [
    {
      employee_id: 7,
      name: 'Иванов',
      completed_orders: 1,
      total: 3000,
      orders: [
        {
          order_id: 119,
          order_number: '119',
          end_at: '2026-10-31',
          vehicle: { make: 'Hyundai', model: 'Creta', year: 2019, plate: 'A119BC' },
          amount: 3000,
          works: [
            {
              work_id: 1,
              title: 'Развал-схождение',
              accrual_type: 'work_percent',
              percent: 30,
              amount: 3000,
            },
          ],
        },
      ],
    },
  ],
};

const ECONOMICS_REPORT = {
  summary: {
    count: 1,
    revenue: 13723,
    parts_cost: 5000,
    payroll_total: 3000,
    net_profit: 5723,
    paid_amount: 0,
    debt_amount: 13723,
    unpaid_count: 1,
  },
  items: [
    {
      order_id: 99,
      order_number: '99',
      status: 'pending',
      client_name: 'Марат Тайота',
      client_phone: '+7 900 000-00-00',
      vehicle: { id: 5, make: 'Toyota', model: 'Land Cruiser', year: 2018, plate: 'A099BC' },
      scheduled_at: '2026-10-28T12:35:00',
      grand_total: 13723,
      parts_cost: 5000,
      payroll_total: 3000,
      net_profit: 5723,
      paid_amount: 0,
      remaining_amount: 13723,
      is_paid: false,
      payment_status: 'unpaid',
      is_preliminary: true,
      works_count: 2,
      shop_parts_count: 3,
    },
  ],
};

vi.mock('../../utils/apiClient', () => ({
  apiRequest: vi.fn(),
  apiAxios: {
    get: vi.fn(() => Promise.resolve({ data: new Blob(['xlsx']) })),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/autoservice/reports', search: '', hash: '', state: null }),
  useSearchParams: () => [mockSearchParams, mockSetSearchParams],
}), { virtual: true });

vi.mock('../../components/Autoservice/RepairOrderViewModal', () => ({
  __esModule: true,
  default: () => null,
  OrderStatusBadge: () => null,
  REPAIR_ORDER_STATUS_LABELS: {},
  vehicleLabel: () => '',
}));
vi.mock('../../hooks/useDebouncedCallback', () => ({
  useDebouncedCallback: (fn) => fn,
}));

// eslint-disable-next-line import/first
import AutoserviceReportsPage from './AutoserviceReportsPage';

function renderReportsPage(userOverrides = {}) {
  const store = configureStore({
    reducer: {
      auth: (state = {
        user: {
          is_director: false,
          can_see_rossko_sales_report: false,
          ...userOverrides,
        },
      }) => state,
    },
  });

  return render(
    <Provider store={store}>
      <AutoserviceReportsPage />
    </Provider>,
  );
}

describe('AutoserviceReportsPage Rossko sales tab', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockSetSearchParams.mockClear();
    mockSearchParams = new URLSearchParams('');
    apiRequest.mockImplementation((url) => {
      if (String(url).includes('/autoservice/reports/payroll')) {
        return Promise.resolve(PAYROLL_REPORT);
      }
      if (String(url).includes('/autoservice/reports/rossko-sales')) {
        return Promise.resolve(ROSSKO_REPORT);
      }
      if (String(url).includes('/autoservice/reports/order-economics')) {
        return Promise.resolve(ECONOMICS_REPORT);
      }
      if (String(url).includes('/autoservice/finance/receipts')) {
        return Promise.resolve({ total_amount: 0, count: 0, items: [] });
      }
      return Promise.resolve({});
    });
  });

  it('hides Rossko sales tab without server access flag', () => {
    renderReportsPage({ can_see_rossko_sales_report: false });
    expect(screen.queryByRole('tab', { name: 'Продажи Росско' })).not.toBeInTheDocument();
  });

  it('hides Rossko sales tab while the report section is disabled', () => {
    renderReportsPage({ can_see_rossko_sales_report: true });
    expect(screen.queryByRole('tab', { name: 'Продажи Росско' })).not.toBeInTheDocument();
  });

  it('redirects away from rossko-sales tab while the report section is disabled', async () => {
    mockSearchParams = new URLSearchParams('tab=rossko-sales');
    renderReportsPage({ can_see_rossko_sales_report: true });
    await waitFor(() => {
      expect(mockSetSearchParams).toHaveBeenCalledWith({}, { replace: true });
    });
    expect(screen.queryByText('доход организации за период')).not.toBeInTheDocument();
  });

  it('shows the repair order end date in the payroll report', async () => {
    mockSearchParams = new URLSearchParams('tab=payroll');
    renderReportsPage({ is_director: true });

    const toggles = await screen.findAllByRole('button', { name: /Иванов/ });
    fireEvent.click(toggles[0]);

    await waitFor(() => {
      expect(screen.getAllByText('Дата конца')).toHaveLength(2);
    });
    await waitFor(() => {
      expect(screen.getAllByText('31.10.2026')).toHaveLength(2);
    });
  });

  it('renders order economics as a warehouse-style table', async () => {
    mockSearchParams = new URLSearchParams('tab=economics');
    renderReportsPage({ is_director: true });

    const columns = await screen.findAllByRole('columnheader');
    expect(columns.map((th) => th.textContent)).toEqual([
      'Заказ',
      'Клиент',
      'Автомобиль',
      'Дата',
      'Сумма',
      'Запчасти',
      'Зарплата',
      'Прибыль',
      'Дебит',
      'Статус',
    ]);
  });

  it('leaves only the order status in the economics status column', async () => {
    mockSearchParams = new URLSearchParams('tab=economics');
    renderReportsPage({ is_director: true });

    // Метка «Предварительный расчёт» остаётся только в мобильной карточке.
    await waitFor(() => {
      expect(screen.getAllByText('Предварительный расчёт')).toHaveLength(1);
    });
  });

  it('keeps the order economics cards for mobile next to the table', async () => {
    mockSearchParams = new URLSearchParams('tab=economics');
    renderReportsPage({ is_director: true });

    await waitFor(() => {
      expect(screen.getAllByText('Марат Тайота')).toHaveLength(2);
    });
  });

  it('expands an order economics row into payment details', async () => {
    mockSearchParams = new URLSearchParams('tab=economics');
    renderReportsPage({ is_director: true });

    const rows = await screen.findAllByRole('button', { name: /№99/ });
    fireEvent.click(rows[0]);

    await waitFor(() => {
      expect(screen.getByText('Позиции запчастей')).toBeInTheDocument();
    });
  });

  it('hides the economics period and status pills behind the filters button', async () => {
    mockSearchParams = new URLSearchParams('tab=economics');
    renderReportsPage({ is_director: true });

    const filtersButton = await screen.findByRole('button', { name: 'Фильтры' });
    expect(filtersButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText('Период с')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Отменён' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Дебит' })).not.toBeInTheDocument();

    fireEvent.click(filtersButton);

    expect(filtersButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('Период с')).toBeInTheDocument();
    expect(screen.getByLabelText('Период по')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Отменён' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Дебит' })).toBeInTheDocument();
  });

  it('keeps the Excel export in the toolbar row next to the filters button', async () => {
    mockSearchParams = new URLSearchParams('tab=economics');
    renderReportsPage({ is_director: true });

    const exportButton = await screen.findByRole('button', { name: 'Экспорт в Excel' });

    expect(screen.getAllByRole('button', { name: 'Экспорт в Excel' })).toHaveLength(1);
    expect(exportButton.parentElement).toContainElement(screen.getByRole('button', { name: 'Фильтры' }));
  });

  it('hides the warehouse stock month and zero-quantity switch behind the filters button', async () => {
    mockSearchParams = new URLSearchParams('tab=warehouse-stock');
    renderReportsPage();

    const filtersButton = await screen.findByRole('button', { name: 'Фильтры' });
    expect(screen.queryByLabelText('Месяц')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Скрыть нулевые остатки')).not.toBeInTheDocument();

    fireEvent.click(filtersButton);

    expect(screen.getByLabelText('Месяц')).toBeInTheDocument();
    expect(screen.getByLabelText('Скрыть нулевые остатки')).toBeInTheDocument();
  });

  it('puts the warehouse stock Excel export in the same toolbar row', async () => {
    mockSearchParams = new URLSearchParams('tab=warehouse-stock');
    renderReportsPage();

    const exportButton = await screen.findByRole('button', { name: 'Экспорт в Excel' });

    expect(exportButton.parentElement).toContainElement(screen.getByRole('button', { name: 'Фильтры' }));
  });

  it('keeps the payroll Excel export in the toolbar row', async () => {
    mockSearchParams = new URLSearchParams('tab=payroll');
    renderReportsPage({ is_director: true });

    const exportButton = await screen.findByRole('button', { name: 'Экспорт в Excel' });

    expect(screen.queryByRole('button', { name: 'Фильтры' })).not.toBeInTheDocument();
    expect(exportButton.parentElement).toContainElement(screen.getByLabelText('Месяц'));
  });
});
