import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function Dashboard() {
  const { profile } = useAuth()

  return (
    <div className="container page">
      <h1 className="page-title">Bienvenido, {profile?.nombreEmpresa || 'Cliente'}</h1>
      <p className="page-subtitle">
        Tu descuento base es del {profile?.descuentoBase ?? 0}%. Accedé al catálogo para realizar pedidos.
      </p>
      <div className="dashboard-cards">
        <Link to="/catalogo" className="card card-link">
          <h3>Realizar pedido</h3>
          <p>Ver productos y agregar al carrito</p>
        </Link>
        <Link to="/checkout" className="card card-link">
          <h3>Carrito</h3>
          <p>Completar pedido con los 5 selectores</p>
        </Link>
        <Link to="/datos" className="card card-link">
          <h3>Datos</h3>
          <p>Razones sociales, sucursales, expresos y contacto</p>
        </Link>
        <Link to="/mis-pedidos" className="card card-link">
          <h3>Mis pedidos</h3>
          <p>Historial y detalle de tus pedidos</p>
        </Link>
        <Link to="/fotos-videos" className="card card-link">
          <h3>Fotos y videos</h3>
          <p>Material audiovisual para descargar</p>
        </Link>
        <Link to="/novedades" className="card card-link">
          <h3>Novedades</h3>
          <p>Notificaciones y novedades</p>
        </Link>
      </div>
    </div>
  )
}
