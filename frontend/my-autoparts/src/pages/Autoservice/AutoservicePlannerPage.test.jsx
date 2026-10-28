import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { apiRequest } from '../../utils/apiClient';
import AutoservicePlannerPage from './AutoservicePlannerPage';

vi.mock('../../hooks/useAuthReady', () => ({
  useAuthReady: () => ({ isReady: true, isAuthenticated: true, user: {}, token: 't' }),
}));

vi.mock('../../hooks/usePlannerWorkZonePermissions', () => ({
  usePlannerWorkZonePermissions: () => ({
    loaded: true,
    fullAccess: true,
    canEditZone: () => true,
    anyEditable: true,
  }),
}));

vi.mock('../../utils/apiClient', () => ({
  apiRequest: vi.fn(),
}));

const weekResponse = {
  week_start: '2026-10-26',
  week_end: '2026-11-01',
  days: ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'].map(
    (date) => ({ date }),
  ),
  zones: [
    {
      id: 1,
      name: 'Подъёмник 1',
      sort_order: 1,
      is_unassigned: false,
      days: [
        {
          date: '2026-10-28',
          orders: [
            {
              id: 11,
              kind: 'order',
              order_number: '11',
              client_name: 'Иван Петров',
              client_phone: '+79000000001',
              vehicle: 'TOYOTA Camry',
              status: 'in_progress',
              scheduled_at: '2026-10-28T09:00:00',
              scheduled_end_at: '2026-10-28T12:00:00',
              vehicle_make: 'TOYOTA',
              vehicle_model: 'Camry',
              work_zone_id: 1,
              work_zone_name: 'Подъёмник 1',
            },
            {
              id: 12,
              kind: 'order',
              order_number: '12',
              client_name: 'Пётр Сидоров',
              client_phone: '+79000000002',
              vehicle: 'LADA Vesta',
              status: 'pending',
              scheduled_at: '2026-10-29T14:00:00',
              scheduled_end_at: '2026-10-29T16:00:00',
              vehicle_make: 'LADA',
              vehicle_model: 'Vesta',
              work_zone_id: 1,
              work_zone_name: 'Подъёмник 1',
            },
          ],
        },
      ],
    },
  ],
};

const searchHit = {
  id: 12,
  kind: 'order',
  order_number: '12',
  client_name: 'Пётр Сидоров',
  client_phone: '+79000000002',
  vehicle: 'LADA Vesta',
  status: 'pending',
  scheduled_at: '2026-10-29T14:00:00',
  scheduled_end_at: '2026-10-29T16:00:00',
  vehicle_make: 'LADA',
  vehicle_model: 'Vesta',
  work_zone_id: 1,
  work_zone_name: 'Подъёмник 1',
};

const renderPage = () => render(
  <Provider
    store={configureStore({
      reducer: { auth: (state = { user: { is_employee: true }, permissionCodes: [] }) => state },
    })}
  >
    <MemoryRouter>
      <AutoservicePlannerPage />
    </MemoryRouter>
  </Provider>,
);

describe('планировщик: поиск по клиенту и автомобилю', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    apiRequest.mockImplementation((url) => {
      if (url.startsWith('/autoservice/planner/week')) return Promise.resolve(weekResponse);
      if (url.startsWith('/autoservice/planner/search')) return Promise.resolve([searchHit]);
      return Promise.resolve([]);
    });
  });

  it('нет заголовка, есть поле поиска', async () => {
    renderPage();
    await screen.findByTitle(/Иван Петров/);
    expect(screen.queryByRole('heading', { name: 'Планировщик' })).toBeNull();
    expect(screen.getByLabelText('Поиск по планировщику')).toBeTruthy();
  });

  it('выпадающий список показывает клиента, авто и дату', async () => {
    renderPage();
    await screen.findByTitle(/Иван Петров/);
    fireEvent.change(screen.getByLabelText('Поиск по планировщику'), { target: { value: 'сидор' } });
    const row = await screen.findByRole('button', { name: /Пётр Сидоров/ });
    expect(within(row).getByText(/LADA Vesta/)).toBeTruthy();
    expect(within(row).getByText(/29\.10/)).toBeTruthy();
    expect(within(row).getByText(/14:00/)).toBeTruthy();
    expect(apiRequest.mock.calls.some(([url]) => url.startsWith('/autoservice/planner/search?q='))).toBe(true);
  });

  it('выбор результата затемняет остальное и подсвечивает нужную полосу', async () => {
    renderPage();
    await screen.findByTitle(/Иван Петров/);
    fireEvent.change(screen.getByLabelText('Поиск по планировщику'), { target: { value: 'сидор' } });
    fireEvent.click(await screen.findByText('Пётр Сидоров'));

    const highlighted = await screen.findByTitle(/№ 12 · Пётр Сидоров/);
    const faded = await screen.findByTitle(/№ 11 · Иван Петров/);
    expect(highlighted.className).toContain('ring-2');
    expect(faded.className).toContain('opacity-30');
    expect(
      screen.getAllByText('Подъёмник 1').some((el) => el.className.includes('opacity-45')),
    ).toBe(true);
  });

  it('клик по затемнённой полосе сбрасывает фильтр', async () => {
    renderPage();
    await screen.findByTitle(/Иван Петров/);
    fireEvent.change(screen.getByLabelText('Поиск по планировщику'), { target: { value: 'сидор' } });
    fireEvent.click(await screen.findByText('Пётр Сидоров'));
    fireEvent.click(await screen.findByTitle(/№ 11 · Иван Петров/));
    await waitFor(() => {
      expect(screen.getByLabelText('Поиск по планировщику').value).toBe('');
    });
    expect(screen.getByTitle(/№ 11 · Иван Петров/).className).not.toContain('opacity-30');
  });

  it('переход на другую неделю по результату поиска', async () => {
    renderPage();
    await screen.findByTitle(/Иван Петров/);
    apiRequest.mockImplementation((url) => {
      if (url.startsWith('/autoservice/planner/week')) return Promise.resolve(weekResponse);
      return Promise.resolve([{ ...searchHit, scheduled_at: '2026-12-10T11:00:00' }]);
    });
    fireEvent.change(screen.getByLabelText('Поиск по планировщику'), { target: { value: 'сидор' } });
    fireEvent.click(await screen.findByText('Пётр Сидоров'));
    await waitFor(() => {
      const weekStarts = apiRequest.mock.calls
        .filter(([url]) => url.startsWith('/autoservice/planner/week'))
        .map(([url]) => url.split('week_start=')[1]);
      expect(weekStarts[weekStarts.length - 1]).toBe('2026-12-07');
    });
  });

  it('клик по затемнённой ячейке сбрасывает фильтр и не открывает меню создания', async () => {
    const { container } = renderPage();
    await screen.findByTitle(/Иван Петров/);
    fireEvent.change(screen.getByLabelText('Поиск по планировщику'), { target: { value: 'сидор' } });
    fireEvent.click(await screen.findByText('Пётр Сидоров'));
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const cell = container.querySelector('div.border-r.border-line-soft');
    fireEvent.click(cell);
    await waitFor(() => {
      expect(screen.getByLabelText('Поиск по планировщику').value).toBe('');
    });
    expect(screen.queryByText('Запись на осмотр')).toBeNull();
  });
});

describe('планировщик: день записи на осмотр внутри полосы заказа', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    apiRequest.mockImplementation(() => Promise.resolve({
      ...weekResponse,
      zones: [
        {
          ...weekResponse.zones[0],
          days: [
            {
              date: '2026-10-28',
              orders: [
                {
                  ...weekResponse.zones[0].days[0].orders[0],
                  scheduled_end_at: '2026-10-30T12:00:00',
                  inspection_scheduled_at: '2026-10-29T14:00:00',
                },
              ],
            },
          ],
        },
      ],
    }));
  });

  it('зелёный сегмент не дублирует текст полосы, дата осмотра — в подсказке', async () => {
    renderPage();
    const bar = await screen.findByTitle(/Осмотр 29\.10 14:00/);
    expect(within(bar).getAllByText(/Иван/)).toHaveLength(1);
    expect(within(bar).getByText(/09:00/)).toBeTruthy();
  });
});

describe('планировщик: прокрутка к выбранному результату поиска', () => {
  const heightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
  const readRect = Element.prototype.getBoundingClientRect;
  const scroll = Element.prototype.scrollIntoView;

  beforeEach(() => {
    apiRequest.mockReset();
    apiRequest.mockImplementation((url) => {
      if (url.startsWith('/autoservice/planner/week')) return Promise.resolve(weekResponse);
      if (url.startsWith('/autoservice/planner/search')) return Promise.resolve([searchHit]);
      return Promise.resolve([]);
    });
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get: () => 40,
    });
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', heightDescriptor);
    Element.prototype.getBoundingClientRect = readRect;
    Element.prototype.scrollIntoView = scroll;
  });

  const pickFromSearch = async () => {
    renderPage();
    await screen.findByTitle(/Иван Петров/);
    fireEvent.change(screen.getByLabelText('Поиск по планировщику'), { target: { value: 'сидор' } });
    fireEvent.click(await screen.findByText('Пётр Сидоров'));
  };

  it('листает страницу к полосе и не трогает выпадающий список', async () => {
    await pickFromSearch();
    await waitFor(() => {
      expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({
        block: 'center',
        inline: 'nearest',
      });
    });
    expect(screen.getByText('Пётр Сидоров')).toBeTruthy();
  });

  it('скрывает выпадающий список, если полоса оказалась под ним', async () => {
    Element.prototype.getBoundingClientRect = function rect() {
      const result = {
        left: 0,
        right: 300,
        top: 60,
        bottom: 300,
        width: 300,
        height: 240,
      };
      if (this.getAttribute && this.getAttribute('data-planner-key')) {
        return { ...result, top: 100, bottom: 140, height: 40 };
      }
      return result;
    };
    await pickFromSearch();
    await waitFor(() => {
      expect(screen.queryByText('Пётр Сидоров')).toBeNull();
    });
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });
});
