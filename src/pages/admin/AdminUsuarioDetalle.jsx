import { useParams, useNavigate, Link } from 'react-router-dom'
import { doc, collection, query, where, orderBy, onSnapshot, updateDoc } from 'firebase/firestore'
import { useState, useEffect } from 'react'
import { db } from '../../firebase/config'

export default function AdminUsuarioDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [usuario, setUsuario] = useState(null)
  const [pedidos, setPedidos] = useState([])
  const [vendedores, setVendedores] = useState([])
  const [descuentoBase, setDescuentoBase] = useState(0)
  const [vendedorId, setVendedorId] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!id) return
    const unsub = onSnapshot(doc(db, 'users', id), (snap) => {
      const data = snap.exists() ? { id: snap.id, ...snap.data() } : null
      setUsuario(data)
      if (data) {
        setDescuentoBase(data.descuentoBase ?? 0)
        setVendedorId(data.vendedorId ?? '')
      }
    })
    return () => unsub()
  }, [id])

  useEffect(() => {
    if (!id) return
    const q = query(
      collection(db, 'pedidos'),
      where('userId', '==', id),
      orderBy('createdAt', 'desc')
    )
    const unsub = onSnapshot(q, (snap) => {
      setPedidos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [id])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'vendedores'), (snap) => {
      setVendedores(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [])

  const formatDate = (d) => {
    if (!d) return '-'
    const date = d?.toDate ? d.toDate() : new Date(d)
    return date.toLocaleString('es-AR')
  }

  const aprobar = async () => {
    if (!id) return
    setGuardando(true)
    try {
      await updateDoc(doc(db, 'users', id), { approved: true })
    } finally {
      setGuardando(false)
    }
  }

  const guardarDescuento = async () => {
    if (!id) return
    setGuardando(true)
    try {
      await updateDoc(doc(db, 'users', id), {
        descuentoBase,
        vendedorId: vendedorId || null,
      })
    } finally {
      setGuardando(false)
    }
  }

  if (!usuario) {
    return (
      <div className="container page">
        <p className="empty-state">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="container page">
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin/usuarios')} style={{ marginBottom: '1rem' }}>
        ← Volver a usuarios
      </button>

      <h1 className="page-title">{usuario.nombreEmpresa || usuario.email}</h1>
      <p className="page-subtitle">{usuario.role === 'admin' ? 'Administrador' : usuario.approved ? 'Cliente aprobado' : 'Pendiente de aprobación'}</p>

      <div className="admin-usuario-datos">
        <h3>Datos del cliente</h3>
        <div className="admin-usuario-datos-grid">
          <p><strong>Email:</strong> {usuario.email}</p>
          <p><strong>Empresa:</strong> {usuario.nombreEmpresa || '-'}</p>
          <p><strong>Rubro:</strong> {usuario.rubro || '-'}</p>
          <p><strong>Teléfono:</strong> {usuario.telefono || '-'}</p>
          <p><strong>Contacto:</strong> {(usuario.nombreContacto || usuario.apellidoContacto) ? `${usuario.nombreContacto || ''} ${usuario.apellidoContacto || ''}`.trim() : '-'}</p>
          <p><strong>Teléfono contacto:</strong> {usuario.telefonoContacto || '-'}</p>
          <p><strong>Email contacto:</strong> {usuario.emailContacto || '-'}</p>
        </div>

        {usuario.role === 'cliente' && (
          <>
            {!usuario.approved && (
              <div className="admin-usuario-aprobar">
                <button className="btn btn-primary" onClick={aprobar} disabled={guardando}>
                  {guardando ? '...' : 'Aprobar cliente'}
                </button>
              </div>
            )}

            <div className="admin-usuario-descuento">
              <h3>Descuento base</h3>
              <div className="admin-usuario-descuento-form">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={descuentoBase}
                  onChange={(e) => setDescuentoBase(Number(e.target.value))}
                  style={{ width: 80 }}
                />
                <span>%</span>
                <select value={vendedorId} onChange={(e) => setVendedorId(e.target.value)}>
                  <option value="">Sin vendedor</option>
                  {vendedores.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                </select>
                <button className="btn btn-primary btn-sm" onClick={guardarDescuento} disabled={guardando}>
                  {guardando ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {usuario.role === 'cliente' && (
        <div className="admin-usuario-pedidos">
          <h3>Pedidos de este cliente ({pedidos.length})</h3>
          {pedidos.length === 0 ? (
            <p className="empty-state">Sin pedidos aún.</p>
          ) : (
            <div className="pedidos-list pedidos-resumen">
              {pedidos.map(p => (
                <Link key={p.id} to={`/admin/pedidos/${p.id}`} className="pedido-card pedido-card-resumen pedido-card-link">
                  <div className="pedido-header">
                    <span>#{p.numeroPedido ?? p.id.slice(-6)}</span>
                    <span>{formatDate(p.createdAt)}</span>
                    <span>{p.estado || 'pendiente'}</span>
                  </div>
                  <div className="pedido-body">
                    <p><strong>Razón social:</strong> {p.razonSocial?.razonSocial || 'Sin razón social'}</p>
                    <p><strong>Sucursal:</strong> {p.sucursal?.direccion}, {p.sucursal?.localidad}</p>
                    <p><strong>Total:</strong> ${(p.total || 0).toLocaleString('es-AR')}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
