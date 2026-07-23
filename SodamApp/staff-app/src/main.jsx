import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// PWA 설치 프롬프트 조기 캡처 — React 마운트 전에 발화해도 InstallBanner/InstallGuide에서 사용
window.__deferredA2HS = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__deferredA2HS = e;
  window.dispatchEvent(new Event('a2hs-ready'));
});
window.addEventListener('appinstalled', () => {
  window.__deferredA2HS = null;
  window.dispatchEvent(new Event('a2hs-installed'));
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register Service Worker with auto-update
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');

      // Check for updates every 30 seconds
      setInterval(() => {
        registration.update();
      }, 30 * 1000);

      // When new SW is waiting, activate it immediately
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'activated') {
            // New version is active — reload to use it
            window.location.reload();
          }
        });
      });
    } catch { /* SW registration failed */ }
  });

  // Listen for SW messages (version update notification)
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'SW_UPDATED') {
      window.location.reload();
    }
  });
}
