import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/auth/LoginPage';
import UnauthorizedPage from './pages/auth/UnauthorizedPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import InventarioPage from './pages/inventario/InventarioPage';
import ClientesPage from './pages/clientes/ClientesPage';
import InmobiliariasPage from './pages/inmobiliarias/InmobiliariasPage';
import UsuariosSistemaPage from './pages/sistema/UsuariosSistemaPage';
import ReportesPage from './pages/reportes/ReportesPage';

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="inventario" element={<InventarioPage />} />
          <Route path="clientes" element={<ClientesPage />} />
          <Route path="reportes" element={<ReportesPage />} />
          <Route
            path="inmobiliarias"
            element={
              <ProtectedRoute roles={['admin']}>
                <InmobiliariasPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="sistema/usuarios"
            element={
              <ProtectedRoute roles={['admin']}>
                <UsuariosSistemaPage />
              </ProtectedRoute>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  </BrowserRouter>
);

export default App;
