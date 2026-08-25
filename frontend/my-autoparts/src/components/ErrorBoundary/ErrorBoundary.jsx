import React from 'react';
import { Link } from 'react-router-dom';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    if (typeof this.props.onError === 'function') {
      this.props.onError(error, info);
    }
  }

  handleRetry = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 py-8 text-center">
          <h1 className="text-xl font-semibold text-ink">Что-то пошло не так</h1>
          <p className="mt-2 max-w-md text-sm text-ink-muted">
            Попробуйте обновить страницу. Если ошибка повторяется, вернитесь на главную.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={this.handleRetry}
              data-testid="error-boundary-retry"
              className="min-h-11 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white"
            >
              Повторить
            </button>
            <Link
              to="/autoparts/new"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-gray-300 px-5 text-sm font-semibold text-ink"
            >
              На главную
            </Link>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
