import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { I18nProvider } from './lib/i18n'
import { ErrorBoundary } from './components/ErrorBoundary'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <I18nProvider>
        <App />
      </I18nProvider>
    </ErrorBoundary>
  </StrictMode>,
)
