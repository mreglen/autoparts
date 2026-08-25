import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

jest.mock('react-router-dom', () => ({
  Link: ({ children, to }) => <a href={to}>{children}</a>,
}), { virtual: true });

function ThrowingChild() {
  throw new Error('boom');
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it('shows retry UI when a child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Что-то пошло не так')).toBeInTheDocument();
    expect(screen.getByTestId('error-boundary-retry')).toHaveClass('min-h-11');
    expect(screen.getByRole('link', { name: 'На главную' })).toHaveAttribute('href', '/autoparts/new');
  });
});
