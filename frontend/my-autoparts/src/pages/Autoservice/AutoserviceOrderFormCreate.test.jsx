import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { apiRequest } from '../../utils/apiClient';
import { repairOrderFormCacheKey, writeRepairOrderFormDraft } from '../../utils/repairOrderFormDraft';
import { saveRepairOrderPurchaseDraft } from '../../utils/repairOrderPurchaseDraft';
import AutoserviceOrderFormPage from './AutoserviceOrderFormPage';

vi.mock('../../hooks/useAuthReady', () => ({
  useAuthReady: () => ({ isReady: true, isAuthenticated: true, user: {}, token: 't' }),
}));

vi.mock('../../utils/apiClient', () => ({
  apiRequest: vi.fn(),
}));

const editedOrder = {
  id: 56,
  order_number: '56',
  status: 'pending',
  client_id: 5,
  scheduled_at: '2026-10-20T10:00:00',
  scheduled_end_at: '2026-10-20T12:00:00',
  client_comment: 'заметка из заказ-наряда 56',
  staff_comment: '',
  works: [],
  client_parts: [],
  shop_parts: [],
  deliveries: [],
};

const Go = ({ to, state, children }) => {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(to, { state })}>
      {children}
    </button>
  );
};

const renderForm = (initialEntry) => render(
  <Provider
    store={configureStore({
      reducer: {
        auth: (state = { user: { is_employee: false }, permissionCodes: [] }) => state,
        clientMarkup: (state = { percent: 0 }) => state,
      },
    })}
  >
    <MemoryRouter initialEntries={[initialEntry]}>
      <Go to="/autoservice/orders/new">пустой новый</Go>
      <Go to="/autoservice/orders/new" state={{ draftToken: 'old-slot' }}>продолжить черновик</Go>
      <Go to="/autoservice/orders/new" state={{ draftToken: '' }}>продолжить старый</Go>
      <Go to="/autoservice/orders/new" state={{ fromPurchaseImport: true }}>из подбора запчастей</Go>
      <Routes>
        <Route path="/autoservice/orders/new" element={<AutoserviceOrderFormPage />} />
        <Route path="/autoservice/orders/:orderId/edit" element={<AutoserviceOrderFormPage />} />
      </Routes>
    </MemoryRouter>
  </Provider>,
);

describe('новый заказ-наряд: никаких данных из прошлой формы', () => {
  beforeEach(() => {
    sessionStorage.clear();
    apiRequest.mockReset();
    apiRequest.mockImplementation((url) => {
      if (url.startsWith('/autoservice/repair-orders/56')) return Promise.resolve(editedOrder);
      if (url.startsWith('/autoservice/clients')) return Promise.resolve([{ id: 5, name: 'Иван Старый' }]);
      if (url.startsWith('/autoservice/garage/vehicles')) return Promise.resolve([]);
      if (url.startsWith('/autoservice/works')) return Promise.resolve([]);
      return Promise.resolve([]);
    });
    writeRepairOrderFormDraft('create', null, 'old-slot', {
      comment: 'старый черновик',
      pendingClientName: 'Иван Старый',
    });
    sessionStorage.setItem(
      repairOrderFormCacheKey('create'),
      JSON.stringify({ form: { comment: 'общий черновик из прошлого слота' }, savedAt: Date.now() }),
    );
    saveRepairOrderPurchaseDraft({
      groups: [{ orderType: 'rossko', itemIds: [1], items: [{ id: 1, name: 'Фильтр старый', quantity: 1, price: 100 }] }],
    });
  });

  it('кнопка «Новый заказ-наряд» открывает пустую форму', async () => {
    renderForm({ pathname: '/autoservice/orders/56/edit', state: { backTo: '/autoservice/orders' } });
    await screen.findByDisplayValue(/заметка из заказ-наряда 56/);

    fireEvent.click(screen.getByText('пустой новый'));

    await waitFor(() => {
      expect(screen.queryByDisplayValue(/заметка из заказ-наряда 56/)).toBeNull();
    });
    expect(screen.queryByDisplayValue('старый черновик')).toBeNull();
    expect(screen.queryByDisplayValue('общий черновик из прошлого слота')).toBeNull();
    expect(screen.queryByText(/Фильтр старый/)).toBeNull();
    expect(screen.queryByDisplayValue(/Иван Старый/)).toBeNull();
  });

  it('черновик из «Черновиков» открывается, когда его явно позвали', async () => {
    renderForm({ pathname: '/autoservice/orders/56/edit', state: { backTo: '/autoservice/orders' } });
    await screen.findByDisplayValue(/заметка из заказ-наряда 56/);

    fireEvent.click(screen.getByText('продолжить черновик'));
    expect(await screen.findByDisplayValue('старый черновик')).toBeTruthy();

    fireEvent.click(screen.getByText('продолжить старый'));
    expect(await screen.findByDisplayValue('общий черновик из прошлого слота')).toBeTruthy();
  });

  it('позиции подбора подгружаются только при импорте из подбора', async () => {
    renderForm({ pathname: '/autoservice/orders/new', state: { backTo: '/autoservice/orders' } });
    await waitFor(() => {
      expect(screen.queryByText(/Фильтр старый/)).toBeNull();
    });

    fireEvent.click(screen.getByText('из подбора запчастей'));

    expect(await screen.findByText(/Фильтр старый/)).toBeTruthy();
  });
});
