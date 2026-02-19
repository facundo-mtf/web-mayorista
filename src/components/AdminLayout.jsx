import { Outlet, Link, useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase/config'

export default function AdminLayout() {
  const navigate = useNavigate()

  const handleLogout = () => {
    signOut(auth)
    navigate('/login')
  }

  return (
    <div className="layout admin-layout">
      <header className="header header-admin">
        <div className="container header-inner">
          <Link to="/admin" className="logo logo-mtf">
            <img src="/logos/luni.png" alt="LUNI" className="logo-img logo-luni" />
            <img src="/logos/polesie.png" alt="Polesie" className="logo-img logo-polesie" />
            <span className="logo-text">Admin MTF</span>
          </Link>
          <nav className="nav">
            <Link to="/admin">Dashboard</Link>
            <Link to="/admin/usuarios">Usuarios</Link>
            <Link to="/admin/pedidos">Pedidos</Link>
            <Link to="/admin/catalogo">Catálogo</Link>
            <Link to="/admin/ofertas">Ofertas</Link>
            <Link to="/admin/vendedores">Vendedores</Link>
            <Link to="/">Ver sitio</Link>
            <button onClick={handleLogout} className="btn btn-ghost btn-sm">Salir</button>
          </nav>
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
