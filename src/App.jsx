import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from './firebase/config'
import { useAuth } from './context/AuthContext'
import { CarritoProvider } from './context/CarritoContext'

import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/cliente/Dashboard'
import Catalogo from './pages/cliente/Catalogo'
import Checkout from './pages/cliente/Checkout'
import Datos from './pages/cliente/Datos'
import MisPedidos from './pages/cliente/MisPedidos'
import FotosVideos from './pages/cliente/FotosVideos'
import Novedades from './pages/cliente/Novedades'
import AdminLayout from './components/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminUsuarios from './pages/admin/AdminUsuarios'
import AdminPedidos from './pages/admin/AdminPedidos'
import AdminPedidoDetalle from './pages/admin/AdminPedidoDetalle'
import AdminUsuarioDetalle from './pages/admin/AdminUsuarioDetalle'
import AdminStock from './pages/admin/AdminStock'
import AdminVendedores from './pages/admin/AdminVendedores'
import AdminOfertas from './pages/admin/AdminOfertas'
import AdminFotosVideos from './pages/admin/AdminFotosVideos'

function ProtectedRoute({ children, requireAdmin }) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Cargando...</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (profile?.deleted) return <Navigate to="/login?reason=deleted" replace />
  if (requireAdmin && profile?.role !== 'admin') return <Navigate to="/" replace />

  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Register />} />

      <Route path="/" element={
        <ProtectedRoute>
          <CarritoProvider>
            <Layout />
          </CarritoProvider>
        </ProtectedRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="catalogo" element={<Catalogo />} />
        <Route path="checkout" element={<Checkout />} />
        <Route path="datos" element={<Datos />} />
        <Route path="mis-pedidos" element={<MisPedidos />} />
        <Route path="fotos-videos" element={<FotosVideos />} />
        <Route path="novedades" element={<Novedades />} />
      </Route>

      <Route path="/admin" element={
        <ProtectedRoute requireAdmin>
          <AdminLayout />
        </ProtectedRoute>
      }>
        <Route index element={<AdminDashboard />} />
        <Route path="usuarios" element={<AdminUsuarios />} />
        <Route path="usuarios/:id" element={<AdminUsuarioDetalle />} />
        <Route path="pedidos" element={<AdminPedidos />} />
        <Route path="pedidos/:id" element={<AdminPedidoDetalle />} />
        <Route path="catalogo" element={<AdminStock />} />
        <Route path="ofertas" element={<AdminOfertas />} />
        <Route path="vendedores" element={<AdminVendedores />} />
        <Route path="fotos-videos" element={<AdminFotosVideos />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
