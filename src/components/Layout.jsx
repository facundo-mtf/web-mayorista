import { Outlet, Link, useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase/config'
import { useAuth } from '../context/AuthContext'

export default function Layout() {
  const { user, profile, isAdmin } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    signOut(auth)
    navigate('/login')
  }

  return (
    <div className="layout">
      <header className="header">
        <div className="container header-inner">
          <Link to="/" className="logo logo-mtf">
            <img src="/logos/luni.png" alt="LUNI" className="logo-img logo-luni" />
            <img src="/logos/polesie.png" alt="Polesie" className="logo-img logo-polesie" />
            <span className="logo-text">Distribuidora MTF</span>
          </Link>
          <nav className="nav">
            <Link to="/">Inicio</Link>
            <Link to="/catalogo">Realizar pedido</Link>
            <Link to="/checkout">Carrito</Link>
            <Link to="/datos">Datos</Link>
            <Link to="/mis-pedidos">Mis pedidos</Link>
            {isAdmin && <Link to="/admin">Admin</Link>}
            <div className="user-menu">
              <span className="user-email">{user?.email}</span>
              <button onClick={handleLogout} className="btn btn-ghost btn-sm">
                Salir
              </button>
            </div>
          </nav>
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
