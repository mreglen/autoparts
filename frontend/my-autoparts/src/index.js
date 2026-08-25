import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { HelmetProvider } from 'react-helmet-async';
import { store } from './redux/store';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { scheduleAppSplashHide } from './utils/appSplash';
import { appendNotificationHistory } from './utils/notificationHistory';
import { dispatchSwUpdateAvailable } from './utils/networkStatus';
import { initSentry } from './utils/sentry';

window.__sgSplashStart = Date.now();

initSentry();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Provider store={store}>
      <HelmetProvider>
        <App />
      </HelmetProvider>
    </Provider>
  </React.StrictMode>
);

requestAnimationFrame(() => {
  requestAnimationFrame(scheduleAppSplashHide);
});

function watchServiceWorkerUpdates(registration) {
  if (!registration) return;

  const notifyIfWaiting = () => {
    if (registration.waiting && navigator.serviceWorker.controller) {
      dispatchSwUpdateAvailable(registration);
    }
  };

  registration.addEventListener('updatefound', () => {
    const installing = registration.installing;
    if (!installing) return;
    installing.addEventListener('statechange', () => {
      if (installing.state === 'installed') {
        notifyIfWaiting();
      }
    });
  });

  notifyIfWaiting();
}

// Register Service Worker for Push Notifications + offline shell
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        console.log('[SW] Service Worker registered:', registration.scope);
        watchServiceWorkerUpdates(registration);
      })
      .catch((registrationError) => {
        console.log('[SW] Service Worker registration failed:', registrationError);
      });
  });
}

// Listen for messages from Service Worker (e.g., notification clicks)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'NAVIGATE_TO_CHAT') {
      console.log('[SW] Navigate to chat:', event.data.chatId);
      window.dispatchEvent(new CustomEvent('navigateToChat', {
        detail: {
          chatId: event.data.chatId,
          url: event.data.url,
        },
      }));
    }
    if (event.data && event.data.type === 'NOTIFICATION_RECEIVED') {
      appendNotificationHistory({
        title: event.data.title,
        body: event.data.body,
        url: event.data.url,
        at: event.data.at,
      });
    }
    if (event.data && event.data.type === 'NAVIGATE_TO_URL') {
      window.dispatchEvent(new CustomEvent('navigateToUrl', {
        detail: { url: event.data.url },
      }));
    }
  });
}

if (typeof window !== 'undefined') {
  const initWebVitals = () => reportWebVitals();
  if (document.readyState === 'complete') {
    initWebVitals();
  } else {
    window.addEventListener('load', initWebVitals, { once: true });
  }
}
