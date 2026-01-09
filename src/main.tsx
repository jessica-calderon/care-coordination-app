import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Global error handler for unhandled promise rejections (AbortError, etc.)
window.addEventListener('unhandledrejection', (event) => {
  // Silently handle AbortError - these are expected when requests are cancelled
  if (event.reason instanceof Error && event.reason.name === 'AbortError') {
    event.preventDefault();
    return;
  }
  // For other errors, let them bubble up but don't log to console
  event.preventDefault();
});

// Global error handler for uncaught errors
window.addEventListener('error', (event) => {
  // Silently handle AbortError
  if (event.error instanceof Error && event.error.name === 'AbortError') {
    event.preventDefault();
    return;
  }
  // For other errors, prevent default logging but allow error handling
  event.preventDefault();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
