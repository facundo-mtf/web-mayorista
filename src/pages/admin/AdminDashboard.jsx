import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase/config'

export default function AdminDashboard() {
  const [pendientes, setPendientes] = useState(0)
  const [pedidosHoy, setPedidosHoy] = useState(0)
  const [vendedoresCount, setVendedoresCount] = useState(0)

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'users'), where('approved', '==', false), where('role', '==', 'cliente')),
      (snap) => setPendientes(snap.size)
    )
    return () => unsub()
  }, [])

  useEffect(() => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const unsub = onSnapshot(collection(db, 'pedidos'), (snap) => {
      const count = snap.docs.filter(d => d.data().createdAt?.toDate?.() >= hoy).length
      setPedidosHoy(count)
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'vendedores'), (snap) => setVendedoresCount(snap.size))
    return () => unsub()
  }, [])

  return (
    <div className="container page">
      <h1 className="page-title">Panel de administración</h1>
      <div className="dashboard-cards admin-cards">
        <div className="card">
          <h3>{pendientes}</h3>
          <p>Usuarios pendientes de aprobar</p>
          <Link to="/admin/usuarios" className="btn btn-primary btn-sm">Ver usuarios</Link>
        </div>
        <div className="card">
          <h3>{pedidosHoy}</h3>
          <p>Pedidos de hoy</p>
          <Link to="/admin/pedidos" className="btn btn-primary btn-sm">Ver pedidos</Link>
        </div>
        <div className="card">
          <h3>Catálogo</h3>
          <p>Gestionar productos</p>
          <Link to="/admin/catalogo" className="btn btn-primary btn-sm">Gestionar catálogo</Link>
        </div>
        <div className="card">
          <h3>{vendedoresCount}</h3>
          <p>Vendedores</p>
          <Link to="/admin/vendedores" className="btn btn-primary btn-sm">Gestionar vendedores</Link>
        </div>
      </div>
    </div>
  )
}
