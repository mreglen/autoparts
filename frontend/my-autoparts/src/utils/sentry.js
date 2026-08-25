import * as Sentry from '@sentry/react';

const EXTENSION_NOISE = /(chrome-extension|moz-extension|safari-extension)/i;

export function initSentry() {
  const dsn = process.env.REACT_APP_SENTRY_DSN;
  if (!dsn) return;

  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  if (hostname === 'localhost' || hostname === '127.0.0.1') return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    beforeSend(event) {
      const message = event?.exception?.values?.[0]?.value || '';
      if (EXTENSION_NOISE.test(message)) return null;
      return event;
    },
  });
}

export function captureBoundaryError(error, info) {
  if (!process.env.REACT_APP_SENTRY_DSN) return;
  Sentry.captureException(error, {
    extra: {
      componentStack: info?.componentStack,
    },
  });
}

export { Sentry };
