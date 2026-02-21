import { useParams, useNavigate, Link } from 'react-router-dom'
import { doc, collection, query, where, orderBy, onSnapshot, updateDoc } from 'firebase/firestore'
import { useState, useEffect } from 'react'
import { db } from '../../firebase/config'
import { notificarUsuario } from '../../utils/notificaciones'
import { formatMoneda } from '../../utils/formatoNumero'

const ESTADOS_CLIENTE = [
  { value: 'pendiente', label: 'Pendiente', approved: false, blocked: false },
  { value: 'aprobado', label: 'Aprobado', approved: true, blocked: false },
  { value: 'bloqueado', label: 'Bloqueado', approved: false, blocked: true },
]

function formatDir(d) {
  if (!d) return '-'
  const parts = [d.calle, d.numero, d.localidad, d.provincia, d.codigoPostal].filter(Boolean)
  return parts.length ? parts.join(', ') : (d.direccion ? `${d.direccion}, ${d.localidad || ''}`.trim() : '-')
}

export default function AdminUsuarioDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [usuario, setUsuario] = useState(null)
  const [pedidos, setPedidos] = useState([])
  const [vendedores, setVendedores] = useState([])
  const [razonesSociales, setRazonesSociales] = useState([])
  const [sucursalesSinRazon, setSucursalesSinRazon] = useState([])
  const [sucursalesConRazon, setSucursalesConRazon] = useState([])
  const [expresos, setExpresos] = useState([])
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
    const q = query(collection(db, 'razonesSociales'), where('userId', '==', id))
    const unsub = onSnapshot(q, (snap) => {
      setRazonesSociales(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [id])

  useEffect(() => {
    if (!id) return
    const q = query(collection(db, 'expresos'), where('userId', '==', id))
    const unsub = onSnapshot(q, (snap) => {
      setExpresos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [id])

  useEffect(() => {
    if (!id) return
    const q = query(collection(db, 'sucursales'), where('userId', '==', id), where('razonSocialId', '==', null))
    const unsub = onSnapshot(q, (snap) => {
      setSucursalesSinRazon(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [id])

  const razonIds = razonesSociales.map(r => r.id)
  useEffect(() => {
    if (razonIds.length === 0) { setSucursalesConRazon([]); return }
    const q = query(collection(db, 'sucursales'), where('razonSocialId', 'in', razonIds.slice(0, 30)))
    const unsub = onSnapshot(q, (snap) => {
      setSucursalesConRazon(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [razonIds.join(',')])

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

  const estadoActual = usuario?.role === 'cliente'
    ? ESTADOS_CLIENTE.find(e => e.approved === !!usuario.approved && e.blocked === !!usuario.blocked) || ESTADOS_CLIENTE[0]
    : null

  const cambiarEstado = async (estado) => {
    if (!id || usuario?.role !== 'cliente') return
    setGuardando(true)
    try {
      await updateDoc(doc(db, 'users', id), {
        approved: estado.approved,
        blocked: estado.blocked,
      })
    } finally {
      setGuardando(false)
    }
  }

  const aprobar = async () => {
    if (!id) return
    setGuardando(true)
    try {
      await updateDoc(doc(db, 'users', id), { approved: true, blocked: false })
    } finally {
      setGuardando(false)
    }
  }

  const eliminarUsuario = async () => {
    if (!id || !window.confirm('¿Eliminar este usuario? No podrá volver a ingresar. Esta acción no se puede deshacer.')) return
    setGuardando(true)
    try {
      await updateDoc(doc(db, 'users', id), { deleted: true, approved: false, blocked: true })
      navigate('/admin/usuarios')
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
      if (vendedorId) {
        notificarUsuario(id, 'Asignación de vendedor', 'Se te asignó un vendedor.').catch(() => {})
      }
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
      <p className="page-subtitle">
        {usuario.role === 'admin' ? 'Administrador' : usuario.deleted ? 'Usuario eliminado' : usuario.blocked ? 'Bloqueado' : usuario.approved ? 'Aprobado' : 'Pendiente de aprobación'}
      </p>

      {usuario.role === 'cliente' && !usuario.deleted && (
        <div className="admin-usuario-estado-block">
          <h3>Estado</h3>
          <div className="admin-usuario-estado-row">
            <select
              value={estadoActual?.value ?? 'pendiente'}
              onChange={(e) => {
                const est = ESTADOS_CLIENTE.find(x => x.value === e.target.value)
                if (est) cambiarEstado(est)
              }}
              disabled={guardando}
              className="admin-usuario-estado-select"
            >
              {ESTADOS_CLIENTE.map(e => (
                <option key={e.value} value={e.value}>{e.label}</option>
              ))}
            </select>
            {!usuario.approved && !usuario.blocked && (
              <button type="button" className="btn btn-primary btn-sm" onClick={aprobar} disabled={guardando}>
                {guardando ? '...' : 'Aprobar'}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="admin-usuario-datos">
        <h3>Datos del cliente (perfil)</h3>
        <div className="admin-usuario-datos-grid">
          <p><strong>Email:</strong> {usuario.email}</p>
          <p><strong>Empresa:</strong> {usuario.nombreEmpresa || '-'}</p>
          <p><strong>Rubro:</strong> {usuario.rubro || '-'}</p>
          <p><strong>Teléfono:</strong> {usuario.telefono || '-'}</p>
        </div>

        <h3 className="admin-usuario-seccion-datos">Datos cargados en “Datos”</h3>
        <div className="admin-usuario-datos-modulos">
          <div className="admin-usuario-modulo">
            <h4>Razones sociales</h4>
            {razonesSociales.length === 0 ? <p className="muted">Sin cargar</p> : (
              <ul className="admin-usuario-lista">
                {razonesSociales.map(r => (
                  <li key={r.id}>
                    {r.razonSocial || '-'}
                    {r.cuit && ` — CUIT: ${r.cuit}`}
                    {r.condicionFiscal && ` — ${r.condicionFiscal}`}
                    {r.direccionFacturacion && (r.direccionFacturacion.calle || r.direccionFacturacion.localidad) && (
                      <div className="admin-usuario-direccion">Facturación: {formatDir(r.direccionFacturacion)}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="admin-usuario-modulo">
            <h4>Sucursales de entrega</h4>
            {sucursalesSinRazon.length === 0 && sucursalesConRazon.length === 0 ? <p className="muted">Sin cargar</p> : (
              <ul className="admin-usuario-lista">
                {sucursalesSinRazon.map(s => (
                  <li key={s.id}>{s.razonSocial || s.direccion || '-'} — {formatDir(s)}</li>
                ))}
                {sucursalesConRazon.map(s => (
                  <li key={s.id}>{razonesSociales.find(r => r.id === s.razonSocialId)?.razonSocial || 'Sucursal'} — {formatDir(s)}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="admin-usuario-modulo">
            <h4>Expresos</h4>
            {expresos.length === 0 ? <p className="muted">Sin cargar</p> : (
              <ul className="admin-usuario-lista">
                {expresos.map(e => (
                  <li key={e.id}>{e.nombre || '-'}{e.telefono ? ` — ${e.telefono}` : ''}{e.direccionCABA ? ` — ${e.direccionCABA}` : ''}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="admin-usuario-modulo">
            <h4>Contacto compra</h4>
            <p>{(usuario.nombreCompra || usuario.apellidoCompra) ? `${usuario.nombreCompra || ''} ${usuario.apellidoCompra || ''}`.trim() : '-'}</p>
            <p>Tel: {usuario.telefonoCompra || '-'} — Email: {usuario.emailCompra || '-'}</p>
          </div>
          <div className="admin-usuario-modulo">
            <h4>Contacto pago</h4>
            <p>{(usuario.nombrePago || usuario.apellidoPago) ? `${usuario.nombrePago || ''} ${usuario.apellidoPago || ''}`.trim() : '-'}</p>
            <p>Tel: {usuario.telefonoPago || '-'} — Email: {usuario.emailPago || '-'}</p>
          </div>
        </div>

        {usuario.role === 'cliente' && !usuario.deleted && (
          <>
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
            <div className="admin-usuario-eliminar">
              <button type="button" className="btn btn-danger-outline" onClick={eliminarUsuario} disabled={guardando}>
                {guardando ? '...' : 'Eliminar usuario'}
              </button>
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
                    <p><strong>Total:</strong> ${formatMoneda(p.total || 0)}</p>
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
