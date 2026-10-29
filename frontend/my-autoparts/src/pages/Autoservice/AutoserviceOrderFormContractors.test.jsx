import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { apiRequest } from '../../utils/apiClient';
import AutoserviceOrderFormPage from './AutoserviceOrderFormPage';

vi.mock('../../hooks/useAuthReady', () => ({
  useAuthReady: () => ({ isReady: true, isAuthenticated: true, user: {}, token: 't' }),
}));

vi.mock('../../utils/apiClient', () => ({
  apiRequest: vi.fn(),
}));

const orderWithWork = {
  id: 56,
  order_number: '56',
  status: 'pending',
  client_id: 5,
  scheduled_at: '2026-10-20T10:00:00',
  scheduled_end_at: '2026-10-20T12:00:00',
  client_comment: '',
  staff_comment: '',
  work_zone_id: null,
  discount_percent: 0,
  works: [
    {
      id: 1,
      position: 1,
      title: 'Замена стартера',
      qty: 1,
      unit_price: '3000.00',
      line_sum: '3000.00',
      executors: [{ employee_id: 1, employee: { name: 'Иванов' }, percent: '50.00' }],
      contractors: [],
    },
  ],
  client_parts: [],
  shop_parts: [],
  deliveries: [],
};

let savedBodies;

const renderForm = () => render(
  <Provider
    store={configureStore({
      reducer: {
        auth: (state = { user: { is_employee: false }, permissionCodes: [] }) => state,
        clientMarkup: (state = { percent: 0 }) => state,
        contractors: (state = { contractorOptions: [] }) => state,
      },
    })}
  >
    <MemoryRouter initialEntries={[{ pathname: '/autoservice/orders/56/edit', state: { backTo: '/autoservice/orders' } }]}>
      <Routes>
        <Route path="/autoservice/orders/new" element={<AutoserviceOrderFormPage />} />
        <Route path="/autoservice/orders/:orderId/edit" element={<AutoserviceOrderFormPage />} />
      </Routes>
    </MemoryRouter>
  </Provider>,
);

beforeEach(() => {
  sessionStorage.clear();
  savedBodies = [];
  apiRequest.mockReset();
  apiRequest.mockImplementation((url, options = {}) => {
    if (url.startsWith('/autoservice/repair-orders/56')) {
      if (options.body) savedBodies.push(JSON.parse(options.body));
      return Promise.resolve(orderWithWork);
    }
    if (url.startsWith('/autoservice/clients')) return Promise.resolve([{ id: 5, name: 'Иван' }]);
    if (url.startsWith('/autoservice/garage/vehicles')) return Promise.resolve([]);
    if (url.startsWith('/autoservice/works')) return Promise.resolve([]);
    if (url.includes('service-employees-options')) {
      return Promise.resolve([{ id: 1, name: 'Иванов', work_percent: 50 }]);
    }
    if (url.includes('contractors-options')) {
      return Promise.resolve([{ id: 7, name: 'Урал Стартер' }, { id: 8, name: 'Расточка Блок' }]);
    }
    if (url.includes('work-zones-meta')) return Promise.resolve({ work_zones: [] });
    return Promise.resolve([]);
  });
});

const openAssignModal = async () => {
  renderForm();
  await screen.findByDisplayValue('Замена стартера');
  fireEvent.click(screen.getByTitle('Сотрудники и подрядчики по работе'));
  await screen.findByText('Исполнители по работе');
};

describe('назначение подрядчиков в заказ-наряде', () => {
  it('показывает два раздела со счётчиками и без назначенного подрядчика', async () => {
    await openAssignModal();

    expect(screen.getByRole('heading', { name: 'Сотрудники' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Подрядчики' })).toBeInTheDocument();
    expect(screen.getByText('1 выбрано')).toBeInTheDocument();
    expect(screen.getAllByText('не выбрано')).toHaveLength(1);
  });

  it('назначает подрядчика с фиксированной суммой и сохраняет её в payload', async () => {
    await openAssignModal();

    expect(screen.getAllByText('1 выбрано')).toHaveLength(1);
    fireEvent.click(screen.getByRole('checkbox', { name: /Расточка Блок/ }));
    expect(screen.getAllByText('1 выбрано')).toHaveLength(2);
    expect(screen.queryByText('не выбрано')).toBeNull();

    fireEvent.change(screen.getByLabelText('Сумма подрядчику'), { target: { value: '1500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Готово' }));

    expect(await screen.findByText(/Расточка Блок/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить и закрыть' }));

    await waitFor(() => {
      expect(savedBodies.length).toBeGreaterThan(0);
    });
    const body = savedBodies[savedBodies.length - 1];
    expect(body.works[0].contractors).toEqual([{ contractor_id: 8, amount: 1500 }]);
    expect(body.works[0].executors).toEqual([{ employee_id: 1, percent: 50 }]);
  });

  it('сумма подрядчика не влияет на проценты сотрудников', async () => {
    await openAssignModal();

    fireEvent.click(screen.getByRole('checkbox', { name: /Урал Стартер/ }));
    fireEvent.change(screen.getByLabelText('Сумма подрядчику'), { target: { value: '9000' } });

    expect(screen.getByText(/Всего подрядчикам 9 000,00 ₽/)).toBeInTheDocument();
    expect(screen.getByText(/^Всего 50,00% · доступно ещё 50,00%$/)).toBeInTheDocument();
    expect(screen.queryByText(/не может превышать 100%/)).toBeNull();
  });

  it('снимает подрядчика по повторному клику', async () => {
    await openAssignModal();

    const checkbox = screen.getByRole('checkbox', { name: /Урал Стартер/ });
    fireEvent.click(checkbox);
    expect(screen.getAllByText('1 выбрано')).toHaveLength(2);
    fireEvent.click(checkbox);

    expect(screen.getAllByText('1 выбрано')).toHaveLength(1);
    expect(screen.getAllByText('не выбрано')).toHaveLength(1);
    expect(screen.queryByLabelText('Сумма подрядчику')).toBeNull();
  });

  it('работы с назначенными людьми показываются в строке работы', async () => {
    renderForm();
    await screen.findByDisplayValue('Замена стартера');

    expect(screen.queryByText('Пока нет работ')).toBeNull();
    expect(screen.getByTitle('Сотрудники и подрядчики по работе')).toHaveTextContent('Иванов');
  });
});
