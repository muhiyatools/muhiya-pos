import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { TenantProvider } from './context/TenantContext'
import { ToastProvider } from './context/ToastContext'
import { ProtectedRoute, PublicOnly } from './components/ProtectedRoute'
import Layout from './components/Layout'
import POSLayout from './components/POSLayout'
import OfflineGuard from './components/OfflineGuard'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import POS from './pages/POS'
import ProductsPage from './pages/ProductsPage'
import OrdersPage from './pages/OrdersPage'
import CategoriesPage from './pages/CategoriesPage'
import FinancePage from './pages/Finance'
import UsersPage from './pages/UsersPage'
import SettingsPage from './pages/SettingsPage'
import BranchesPage from './pages/BranchesPage'
import StockTransfersPage from './pages/StockTransfersPage'
import SuppliersPage from './pages/SuppliersPage'
import ReturnsPage from './pages/ReturnsPage'
import ReportsPage from './pages/ReportsPage'
import PromoCodesPage from './pages/PromoCodesPage'

/** Wrap a page in OfflineGuard — shows offline message when no internet */
const OG = ({ children }: { children: React.ReactNode }) => <OfflineGuard>{children}</OfflineGuard>

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TenantProvider>
          <ToastProvider>
            <Routes>
              <Route path="/login" element={<PublicOnly><Auth /></PublicOnly>} />
              <Route element={<ProtectedRoute><POSLayout /></ProtectedRoute>}>
                <Route path="/pos" element={<POS />} />
              </Route>
              <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route index element={<OG><Dashboard /></OG>} />
                <Route path="products" element={<OG><ProductsPage /></OG>} />
                <Route path="categories" element={<OG><CategoriesPage /></OG>} />
                <Route path="stock-transfers" element={<OG><StockTransfersPage /></OG>} />
                <Route path="branches" element={<OG><BranchesPage /></OG>} />
                <Route path="warehouses" element={<Navigate to="/branches" replace />} />
                <Route path="suppliers" element={<OG><SuppliersPage /></OG>} />
                <Route path="purchase-orders" element={<Navigate to="/suppliers" replace />} />
                <Route path="orders" element={<OG><OrdersPage /></OG>} />
                <Route path="returns" element={<OG><ReturnsPage /></OG>} />
                <Route path="promo-codes" element={<OG><PromoCodesPage /></OG>} />
                <Route path="finance" element={<OG><FinancePage /></OG>} />
                <Route path="reports" element={<OG><ReportsPage /></OG>} />
                <Route path="users-roles" element={<OG><UsersPage /></OG>} />
                <Route path="settings" element={<OG><SettingsPage /></OG>} />
                <Route path="employees" element={<Navigate to="/finance" replace />} />
                <Route path="shifts" element={<Navigate to="/finance" replace />} />
                <Route path="activity-log" element={<Navigate to="/" replace />} />
                <Route path="stats" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </ToastProvider>
        </TenantProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
