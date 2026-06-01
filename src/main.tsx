import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { initThemeStore } from './store/useThemeStore.ts'

// تهيئة التيم وتحميله من قاعدة البيانات
const themeStore = initThemeStore()

function AppWithTheme({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    themeStore.loadFromDB()
  }, [])

  return <>{children}</>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AppWithTheme>
        <App />
      </AppWithTheme>
    </ErrorBoundary>
  </StrictMode>,
)
