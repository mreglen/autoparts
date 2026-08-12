import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import RosskoReducer from '../../../redux/slices/RosskoSlice';

const mockNavigate = jest.fn();
let mockPathname = '/autoparts/used';
let mockSearchParams = new URLSearchParams('q=bmw');

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: mockPathname }),
  useSearchParams: () => [mockSearchParams],
}), { virtual: true });

jest.mock('../../../components/VinScanner/VinScanModal', () => ({
  __esModule: true,
  default: ({ open, onConfirm, onClose }) => (
    open ? (
      <div>
        <span>VIN scan modal</span>
        <button type="button" onClick={() => onConfirm('JHMGD18908S212467')}>Confirm VIN</button>
        <button type="button" onClick={onClose}>Close scan</button>
      </div>
    ) : null
  ),
}));

// eslint-disable-next-line import/first
import Search from './Search';

function renderSearch() {
  const store = configureStore({
    reducer: {
      publicInfo: (state = { showNewAutoparts: true }) => state,
      rossko: RosskoReducer,
    },
  });

  return render(
    <Provider store={store}>
      <Search />
    </Provider>,
  );
}

describe('Search clear button', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockPathname = '/autoparts/used';
    mockSearchParams = new URLSearchParams('q=bmw');
  });

  it('renders clear button when search has text', () => {
    renderSearch();
    expect(screen.getByLabelText('Очистить поиск')).toBeInTheDocument();
  });

  it('hides clear button when search is empty', () => {
    mockSearchParams = new URLSearchParams('');
    renderSearch();
    expect(screen.queryByLabelText('Очистить поиск')).not.toBeInTheDocument();
  });

  it('clears used catalog query while preserving other params', () => {
    mockSearchParams = new URLSearchParams('q=bmw&sort=price_asc');
    renderSearch();
    fireEvent.click(screen.getByLabelText('Очистить поиск'));
    expect(mockNavigate).toHaveBeenCalledWith('/autoparts/used?sort=price_asc', { replace: true });
    expect(screen.getByRole('searchbox')).toHaveValue('');
  });

  it('clears new catalog query on clear click', () => {
    mockPathname = '/autoparts/new';
    mockSearchParams = new URLSearchParams('q=mann');
    renderSearch();
    fireEvent.click(screen.getByLabelText('Очистить поиск'));
    expect(mockNavigate).toHaveBeenCalledWith('/autoparts/new', { replace: true });
    expect(screen.getByRole('searchbox')).toHaveValue('');
  });

  it('opens VIN scan modal from camera button', () => {
    renderSearch();
    fireEvent.click(screen.getByLabelText('Распознать VIN'));
    expect(screen.getByText('VIN scan modal')).toBeInTheDocument();
  });

  it('navigates to VIN catalog after scan confirm', () => {
    renderSearch();
    fireEvent.click(screen.getByLabelText('Распознать VIN'));
    fireEvent.click(screen.getByText('Confirm VIN'));
    expect(mockNavigate).toHaveBeenCalledWith('/autoparts/vin?vin=JHMGD18908S212467');
    expect(screen.getByRole('searchbox')).toHaveValue('JHMGD18908S212467');
  });
});
