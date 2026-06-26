import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import HomePage       from './pages/HomePage.js';
import ProductPage    from './pages/ProductPage.js';
import BasketPage     from './pages/BasketPage.js';
import SuccessPage    from './pages/SuccessPage.js';
import NotFoundPage   from './pages/NotFoundPage.js';
import AdminLoginPage from './pages/admin/AdminLoginPage.js';
import AdminLayout    from './components/admin/AdminLayout.js';
import AdminOrdersPage   from './pages/admin/AdminOrdersPage.js';
import AdminProductsPage from './pages/admin/AdminProductsPage.js';
import AdminLogsPage     from './pages/admin/AdminLogsPage.js';
import AdminSettingsPage from './pages/admin/AdminSettingsPage.js';
import { BasketProvider } from './context/BasketContext.js';
import { BasketBar } from './components/basket/BasketBar.js';

export default function App() {
  return (
    <BrowserRouter>
      <BasketProvider>
        <div className="pb-24 sm:pb-20">
          <Routes>
            <Route path="/"              element={<HomePage />} />
            <Route path="/product/:id"  element={<ProductPage />} />
            <Route path="/checkout"     element={<BasketPage />} />
            <Route path="/basket"       element={<Navigate to="/checkout" replace />} />
            <Route path="/success"      element={<SuccessPage />} />
            <Route path="/admin/login"  element={<AdminLoginPage />} />
            <Route path="/admin"        element={<AdminLayout />}>
              <Route index              element={<AdminOrdersPage />} />
              <Route path="orders"      element={<AdminOrdersPage />} />
              <Route path="products"    element={<AdminProductsPage />} />
              <Route path="logs"        element={<AdminLogsPage />} />
              <Route path="settings"    element={<AdminSettingsPage />} />
            </Route>
            <Route path="*"             element={<NotFoundPage />} />
          </Routes>
        </div>
        <BasketBar />
      </BasketProvider>
    </BrowserRouter>
  );
}
