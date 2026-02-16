import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from './firebase/config'
import { useAuth } from './context/AuthContext'

import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/cliente/Dashboard'
import Catalogo from './pages/cliente/Catalogo'
import Checkout from './pages/cliente/Checkout'
import Datos from './pages/cliente/Datos'
import MisPedidos from './pages/cliente/MisPedidos'
import AdminLayout from './components/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminUsuarios from './pages/admin/AdminUsuarios'
import AdminPedidos from './pages/admin/AdminPedidos'
import AdminPedidoDetalle from './pages/admin/AdminPedidoDetalle'
import AdminUsuarioDetalle from './pages/admin/AdminUsuarioDetalle'
import AdminStock from './pages/admin/AdminStock'
import AdminVendedores from './pages/admin/AdminVendedores'

function ProtectedRoute({ children, requireAdmin, requireApproved }) {
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
  if (requireAdmin && profile?.role !== 'admin') return <Navigate to="/" replace />
  if (requireApproved && !requireAdmin && profile?.role === 'cliente' && !profile?.approved) {
    return <Navigate to="/pendiente" replace />
  }

  return children
}

function PendingApproval() {
  const navigate = useNavigate()
  const handleLogout = () => {
    signOut(auth)
    navigate('/login')
  }
  return (
    <div className="pending-screen">
      <h1>Cuenta pendiente de aprobación</h1>
      <p>Un administrador debe aprobar tu cuenta para acceder al catálogo y realizar pedidos.</p>
      <p className="muted">Recibirás un aviso cuando tu cuenta esté activa.</p>
      <button onClick={handleLogout} className="btn btn-secondary">Cerrar sesión</button>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Register />} />
      <Route path="/pendiente" element={
        <ProtectedRoute>
          <PendingApproval />
        </ProtectedRoute>
      } />

      <Route path="/" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={
          <ProtectedRoute requireApproved>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="catalogo" element={
          <ProtectedRoute requireApproved>
            <Catalogo />
          </ProtectedRoute>
        } />
        <Route path="checkout" element={
          <ProtectedRoute requireApproved>
            <Checkout />
          </ProtectedRoute>
        } />
        <Route path="datos" element={
          <ProtectedRoute requireApproved>
            <Datos />
          </ProtectedRoute>
        } />
        <Route path="mis-pedidos" element={
          <ProtectedRoute requireApproved>
            <MisPedidos />
          </ProtectedRoute>
        } />
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
        <Route path="vendedores" element={<AdminVendedores />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
