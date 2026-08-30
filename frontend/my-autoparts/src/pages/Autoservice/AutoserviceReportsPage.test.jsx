import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { apiRequest } from '../../utils/apiClient';

const mockNavigate = jest.fn();
const mockSetSearchParams = jest.fn();
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

jest.mock('../../utils/apiClient', () => ({
  apiRequest: jest.fn(),
  apiAxios: {
    get: jest.fn(() => Promise.resolve({ data: new Blob(['xlsx']) })),
  },
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [mockSearchParams, mockSetSearchParams],
}), { virtual: true });

jest.mock('../../components/Autoservice/RepairOrderViewModal', () => ({
  __esModule: true,
  default: () => null,
  OrderStatusBadge: () => null,
  REPAIR_ORDER_STATUS_LABELS: {},
  vehicleLabel: () => '',
}));

jest.mock('../../hooks/useDebouncedCallback', () => ({
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
      if (String(url).includes('/autoservice/reports/rossko-sales')) {
        return Promise.resolve(ROSSKO_REPORT);
      }
      if (String(url).includes('/autoservice/reports/order-economics')) {
        return Promise.resolve({
          summary: {
            count: 0,
            revenue: 0,
            parts_cost: 0,
            payroll_total: 0,
            net_profit: 0,
          },
          items: [],
        });
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
});
