import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { collection, query, where, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'

export default function AdminDashboard() {
  const { user } = useAuth()
  const [nuevosClientes, setNuevosClientes] = useState(0)
  const [lastViewedUsuariosAt, setLastViewedUsuariosAt] = useState(null)
  const [pedidosHoy, setPedidosHoy] = useState(0)
  const [vendedoresCount, setVendedoresCount] = useState(0)

  useEffect(() => {
    if (!user?.uid) return
    const unsub = onSnapshot(doc(db, 'adminConfig', user.uid), (snap) => {
      const at = snap.exists() ? snap.data().lastViewedUsuariosAt : null
      setLastViewedUsuariosAt(at?.toDate?.() ?? null)
    })
    return () => unsub()
  }, [user?.uid])

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'users'), where('role', '==', 'cliente')),
      (snap) => {
        const clientes = snap.docs
          .map(d => ({ ...d.data(), id: d.id }))
          .filter(u => !u.deleted)
        const since = lastViewedUsuariosAt ? new Date(lastViewedUsuariosAt) : null
        const count = since
          ? clientes.filter(u => (u.createdAt?.toDate?.() ?? new Date(0)) > since).length
          : clientes.length
        setNuevosClientes(count)
      }
    )
    return () => unsub()
  }, [lastViewedUsuariosAt])

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
          <h3>{nuevosClientes}</h3>
          <p>Nuevos clientes</p>
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
