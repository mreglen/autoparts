import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { apiRequest } from '../../utils/apiClient';
import AutoserviceInspectionsPage from './AutoserviceInspectionsPage';

vi.mock('../../hooks/useAuthReady', () => ({
  useAuthReady: () => ({ isReady: true, isAuthenticated: true, user: {}, token: 't' }),
}));

vi.mock('../../utils/apiClient', () => ({
  apiRequest: vi.fn(),
}));

const bookings = [
  {
    id: 1,
    name: 'Иван Петров',
    phone: '+79000000001',
    status: 'new',
    source: 'staff',
    preferred_date: '2026-10-30',
    preferred_time: '14:00:00',
    created_at: '2026-10-20T09:00:00',
  },
];

const renderPage = () => render(
  <Provider
    store={configureStore({
      reducer: { auth: (state = { user: { is_employee: true }, permissionCodes: [] }) => state },
    })}
  >
    <MemoryRouter>
      <AutoserviceInspectionsPage />
    </MemoryRouter>
  </Provider>,
);

describe('записи: сортировка по дате', () => {
  beforeEach(() => {
    localStorage.clear();
    apiRequest.mockReset();
    apiRequest.mockImplementation((url) => {
      if (url.startsWith('/autoservice/inspection-bookings')) return Promise.resolve(bookings);
      return Promise.resolve([]);
    });
  });

  const bookingsUrls = () => apiRequest.mock.calls
    .filter(([url]) => url.startsWith('/autoservice/inspection-bookings'))
    .map(([url]) => url);

  const dateHeaderCell = () => screen.getByRole('columnheader', { name: 'Дата' });
  const dateSortButton = () => within(dateHeaderCell()).getByRole('button');

  it('сначала лист по дате подачи, стрелка над колонкой «Дата»', async () => {
    renderPage();
    await screen.findAllByText('Иван Петров');

    expect(bookingsUrls()[0]).toContain('sort_by=created_at');
    expect(bookingsUrls()[0]).toContain('sort_dir=desc');
    expect(dateHeaderCell().getAttribute('aria-sort')).toBe('none');
  });

  it('клик по «Дата» сортирует по дате визита, повторный клик разворачивает', async () => {
    renderPage();
    await screen.findAllByText('Иван Петров');

    fireEvent.click(dateSortButton());
    await waitFor(() => {
      expect(bookingsUrls().at(-1)).toContain('sort_by=preferred_date');
    });
    expect(bookingsUrls().at(-1)).toContain('sort_dir=desc');
    expect(dateHeaderCell().getAttribute('aria-sort')).toBe('descending');

    fireEvent.click(dateSortButton());
    await waitFor(() => {
      expect(bookingsUrls().at(-1)).toContain('sort_dir=asc');
    });
    expect(dateHeaderCell().getAttribute('aria-sort')).toBe('ascending');
    expect(JSON.parse(localStorage.getItem('sgPageFilters:autoservice-inspections')).sort)
      .toEqual({ by: 'preferred_date', dir: 'asc' });
  });

  it('выбранная сортировка восстанавливается при следующем заходе', async () => {
    localStorage.setItem(
      'sgPageFilters:autoservice-inspections',
      JSON.stringify({ sort: { by: 'preferred_date', dir: 'asc' } }),
    );

    renderPage();
    await screen.findAllByText('Иван Петров');

    expect(bookingsUrls()[0]).toContain('sort_by=preferred_date');
    expect(bookingsUrls()[0]).toContain('sort_dir=asc');
    expect(dateHeaderCell().getAttribute('aria-sort')).toBe('ascending');
  });
});
