
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import "./styles/index.css";

  // Global error handler to show errors on blank screen
  window.addEventListener('error', (event) => {
    const root = document.getElementById('root');
    if (root && !root.innerHTML) {
      root.innerHTML = `<div style="padding:20px;font-family:monospace;background:#fff;color:#d00">
        <h2>Error de JavaScript</h2>
        <p>${event.message}</p>
        <p>${event.filename}:${event.lineno}</p>
      </div>`;
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const root = document.getElementById('root');
    if (root && !root.innerHTML) {
      root.innerHTML = `<div style="padding:20px;font-family:monospace;background:#fff;color:#d00">
        <h2>Error de Promesa</h2>
        <p>${event.reason}</p>
      </div>`;
    }
  });

  createRoot(document.getElementById("root")!).render(<App />);
