import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { HelmetProvider } from 'react-helmet-async';
import { store } from './redux/store';
import './index.css';
import App from './App';

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

// Register Service Worker for Push Notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('[SW] Service Worker registered:', registration.scope);
      })
      .catch(registrationError => {
        console.log('[SW] Service Worker registration failed:', registrationError);
      });
  });
}

// Listen for messages from Service Worker (e.g., notification clicks)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'NAVIGATE_TO_CHAT') {
      console.log('[SW] Navigate to chat:', event.data.chatId);
      // Dispatch a custom event that App.jsx can listen to
      window.dispatchEvent(new CustomEvent('navigateToChat', { 
        detail: { chatId: event.data.chatId } 
      }));
    }
  });
}

// Optional: Web vitals reporting
// import reportWebVitals from './reportWebVitals';
// reportWebVitals();