import { readCachedPalette } from './app/config/appearance';


  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";

  document.documentElement.dataset.palette = readCachedPalette();
  createRoot(document.getElementById("root")!).render(<App />);

// HTTPS production builds can reopen the previously loaded application offline.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/inventory-sw.js').then(async () => {
      const registration = await navigator.serviceWorker.ready;
      registration.active?.postMessage({ type:'CACHE_SHELL', urls: ['/', ...performance.getEntriesByType('resource').map(entry => entry.name)] });
    }).catch(() => { /* Draft status remains authoritative if shell caching fails. */ });
  });
}
