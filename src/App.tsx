import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage       from './pages/HomePage.js';
import ProductPage    from './pages/ProductPage.js';
import SuccessPage    from './pages/SuccessPage.js';
import NotFoundPage   from './pages/NotFoundPage.js';
import AdminLoginPage from './pages/admin/AdminLoginPage.js';
import AdminLayout    from './components/admin/AdminLayout.js';
import AdminOrdersPage   from './pages/admin/AdminOrdersPage.js';
import AdminProductsPage from './pages/admin/AdminProductsPage.js';
import AdminLogsPage     from './pages/admin/AdminLogsPage.js';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"              element={<HomePage />} />
        <Route path="/product/:id"  element={<ProductPage />} />
        <Route path="/success"      element={<SuccessPage />} />
        <Route path="/admin/login"  element={<AdminLoginPage />} />
        <Route path="/admin"        element={<AdminLayout />}>
          <Route index              element={<AdminOrdersPage />} />
          <Route path="orders"      element={<AdminOrdersPage />} />
          <Route path="products"    element={<AdminProductsPage />} />
          <Route path="logs"        element={<AdminLogsPage />} />
        </Route>
        <Route path="*"             element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
