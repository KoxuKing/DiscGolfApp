import { Component, StrictMode, type PropsWithChildren } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import App from './App';
import './styles.css';

type ErrorBoundaryState = {
  error: Error | null;
};

class AppErrorBoundary extends Component<PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main className="app-shell">
          <section className="empty-history">
            <h1>App failed to start</h1>
            <p>{this.state.error.message || 'Unknown startup error'}</p>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

function clearNativeWebCache() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  });

  if ('caches' in window) {
    caches.keys().then((keys) => {
      keys.forEach((key) => caches.delete(key));
    });
  }
}

const isNativeApp = Capacitor.isNativePlatform();

if (isNativeApp) {
  clearNativeWebCache();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>
);

if (!isNativeApp && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // The app still works normally when the browser blocks service workers.
    });
  });
}
