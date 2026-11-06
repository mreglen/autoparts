import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { apiRequest } from '../../utils/apiClient';
import AutoserviceOrdersPage from './AutoserviceOrdersPage';

vi.mock('../../hooks/useAuthReady', () => ({
  useAuthReady: () => ({ isReady: true, isAuthenticated: true, user: {}, token: 't' }),
}));

vi.mock('../../utils/apiClient', () => ({
  apiRequest: vi.fn(),
}));

const orders = [
  {
    id: 123,
    order_number: '123',
    status: 'pending',
    scheduled_at: '2026-11-03T09:00:00',
    scheduled_end_at: null,
    client: { id: 1, name: 'Иван Петров', phone: '+79000000001' },
    vehicle: { id: 2, make: 'Ford', model: 'Focus', plate: 'А123ВС' },
    work_zone: null,
    works: [],
    shop_parts: [],
    deliveries: [],
    client_parts: [],
    grand_total: '8000.00',
    paid_amount: '0.00',
    remaining_amount: '8000.00',
    is_paid: false,
  },
];

const renderPage = () => render(
  <Provider
    store={configureStore({
      reducer: { auth: (state = { user: { is_employee: true }, permissionCodes: [] }) => state },
    })}
  >
    <MemoryRouter>
      <AutoserviceOrdersPage />
    </MemoryRouter>
  </Provider>,
);

const ordersUrls = () => apiRequest.mock.calls
  .map(([url]) => url)
  .filter((url) => url.startsWith('/autoservice/repair-orders?'));

const openPaymentFilter = async () => {
  fireEvent.click(screen.getAllByRole('button', { name: /Фильтры/ })[0]);
  fireEvent.click(screen.getAllByRole('button', { name: 'Фильтр по статусу оплаты' })[0]);
};

describe('заказ-наряды: фильтр по оплате', () => {
  beforeEach(() => {
    localStorage.clear();
    apiRequest.mockReset();
    apiRequest.mockImplementation((url) => {
      if (url === '/autoservice/repair-orders/work-zones-meta') return Promise.resolve({ work_zones: [] });
      if (url.startsWith('/autoservice/repair-orders')) {
        return Promise.resolve({ items: orders, total: orders.length, has_more: false });
      }
      return Promise.resolve([]);
    });
  });

  it('без выбранной оплаты параметр не уходит', async () => {
    renderPage();
    await screen.findAllByText('Иван Петров');

    expect(ordersUrls()[0]).not.toContain('payment=');
  });

  it('чекбокс «Не оплачено» добавляет payment=unpaid', async () => {
    renderPage();
    await screen.findAllByText('Иван Петров');
    await openPaymentFilter();

    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Не оплачено' })[0]);

    await waitFor(() => {
      expect(ordersUrls().at(-1)).toContain('payment=unpaid');
    });
  });

  it('несколько статусов оплаты уходят повторяющимся параметром', async () => {
    renderPage();
    await screen.findAllByText('Иван Петров');
    await openPaymentFilter();

    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Не оплачено' })[0]);
    await waitFor(() => {
      expect(ordersUrls().at(-1)).toContain('payment=unpaid');
    });
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Частично оплачено' })[0]);

    await waitFor(() => {
      expect(ordersUrls().at(-1)).toContain('payment=unpaid&payment=partial');
    });
  });

  it('фильтр оплаты переживает перезаход страницы', async () => {
    const view = renderPage();
    await screen.findAllByText('Иван Петров');
    await openPaymentFilter();
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Оплачено' })[0]);
    await waitFor(() => {
      expect(ordersUrls().at(-1)).toContain('payment=paid');
    });

    view.unmount();
    renderPage();
    await screen.findAllByText('Иван Петров');

    expect(ordersUrls().at(-1)).toContain('payment=paid');
  });
});
