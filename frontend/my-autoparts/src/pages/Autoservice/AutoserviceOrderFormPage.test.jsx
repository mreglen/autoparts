import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { AddClientModal, SearchableSelect } from './AutoserviceOrderFormPage';

jest.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/autoservice/orders/new', state: null }),
  useNavigate: () => jest.fn(),
  useParams: () => ({}),
}), { virtual: true });

const baseProps = {
  value: '',
  onChange: jest.fn(),
  options: [{ value: '1', label: 'Иван · +7 900 000-00-00' }],
  placeholder: 'Поиск клиента',
  remoteSearch: true,
  onInputChange: jest.fn(),
};

test('keeps the client search focused and open while remote results are loading', () => {
  const { rerender } = render(<SearchableSelect {...baseProps} searching={false} />);
  const input = screen.getByPlaceholderText('Поиск клиента');

  act(() => input.focus());
  fireEvent.change(input, { target: { value: 'Ива' } });

  expect(input).toHaveFocus();
  expect(input).toHaveValue('Ива');
  expect(baseProps.onInputChange).toHaveBeenLastCalledWith('Ива');
  expect(screen.getByRole('list')).toBeInTheDocument();

  rerender(
    <SearchableSelect
      {...baseProps}
      searching
      options={[{ value: '1', label: 'Иван Иванов · +7 900 000-00-00' }]}
    />,
  );

  expect(input).toHaveFocus();
  expect(input).toBeEnabled();
  expect(input).toHaveValue('Ива');
  expect(screen.getByRole('list')).toHaveAttribute('aria-busy', 'true');
  expect(screen.getByText('Поиск клиентов…')).toBeInTheDocument();
});

test('prefills the add-client name from the current search query', () => {
  render(
    <AddClientModal
      initialName="Иванов Иван Иванович"
      onClose={jest.fn()}
      onCreated={jest.fn()}
    />,
  );

  expect(screen.getByPlaceholderText('Иванов Иван Иванович')).toHaveValue('Иванов Иван Иванович');
});
