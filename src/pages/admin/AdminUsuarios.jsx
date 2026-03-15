import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, onSnapshot, doc, updateDoc, setDoc, serverTimestamp, query, where, orderBy, limit, Timestamp, arrayUnion, arrayRemove } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'

export default function AdminUsuarios() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [vendedores, setVendedores] = useState([])
  const [editando, setEditando] = useState(null)
  const [descuentoBase, setDescuentoBase] = useState(0)
  const [vendedorId, setVendedorId] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [usersWithNewActivity, setUsersWithNewActivity] = useState(new Set())
  const [lastViewedAt, setLastViewedAt] = useState(undefined)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState('desc')
  const [filtroEtiqueta, setFiltroEtiqueta] = useState('')

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      setUsuarios(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!user?.uid) return
    const unsub = onSnapshot(doc(db, 'adminConfig', user.uid), (snap) => {
      setLastViewedAt(snap.data()?.lastViewedUsuariosAt ?? null)
    })
    return () => unsub()
  }, [user?.uid])

  useEffect(() => {
    if (lastViewedAt === undefined) return
    const since = lastViewedAt || Timestamp.fromDate(new Date(0))
    const q = query(
      collection(db, 'activityLog'),
      where('createdAt', '>', since),
      orderBy('createdAt', 'desc'),
      limit(500)
    )
    const unsub = onSnapshot(q, (snap) => {
      const ids = new Set(snap.docs.map(d => d.data().userId).filter(Boolean))
      setUsersWithNewActivity(ids)
    }, (err) => {
      console.warn('activityLog query:', err)
      setUsersWithNewActivity(new Set())
    })
    return () => unsub()
  }, [lastViewedAt])

  useEffect(() => {
    return () => {
      if (user?.uid) {
        setDoc(doc(db, 'adminConfig', user.uid), { lastViewedUsuariosAt: serverTimestamp() }, { merge: true }).catch(() => {})
      }
    }
  }, [user?.uid])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'vendedores'), (snap) => {
      setVendedores(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [])

  const clientes = usuarios.filter(u => u.role === 'cliente' && !u.deleted)
  const pendientes = clientes.filter(u => !u.approved && !u.blocked)
  const aprobados = clientes.filter(u => u.approved)
  const bloqueados = clientes.filter(u => u.blocked)

  const usuariosPorEstado = filtro === 'pendientes' ? pendientes
    : filtro === 'aprobados' ? aprobados
    : filtro === 'bloqueados' ? bloqueados
    : clientes

  const usuariosFiltradosRaw = filtroEtiqueta
    ? usuariosPorEstado.filter(u => (u.etiquetas || []).includes(filtroEtiqueta))
    : usuariosPorEstado

  const getSortValue = (u, key) => {
    if (key === 'email') return (u.email || '').toLowerCase()
    if (key === 'nombreEmpresa') return (u.nombreEmpresa || '').toLowerCase()
    if (key === 'rubro') return (u.rubro || '').toLowerCase()
    if (key === 'createdAt') {
      const d = u.createdAt?.toDate?.() ?? (u.createdAt instanceof Date ? u.createdAt : null)
      return d ? d.getTime() : 0
    }
    if (key === 'etiquetas') return (u.etiquetas || []).join(',').toLowerCase() || '\uFFFF'
    if (key === 'descuentoBase') return Number(u.descuentoBase) || 0
    if (key === 'vendedor') return (vendedores.find(v => v.id === u.vendedorId)?.nombre || '').toLowerCase()
    return ''
  }

  const usuariosFiltrados = [...usuariosFiltradosRaw].sort((a, b) => {
    const va = getSortValue(a, sortBy)
    const vb = getSortValue(b, sortBy)
    let cmp = 0
    if (typeof va === 'string') cmp = va.localeCompare(vb)
    else cmp = va - vb
    return sortOrder === 'asc' ? cmp : -cmp
  })

  const handleSort = (key) => {
    if (sortBy === key) setSortOrder(o => o === 'asc' ? 'desc' : 'asc')
    else { setSortBy(key); setSortOrder(key === 'createdAt' ? 'desc' : 'asc') }
  }

  const formatDate = (d) => {
    if (!d) return '-'
    const date = d?.toDate?.() ?? (d instanceof Date ? d : null)
    if (!date) return '-'
    return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const aprobar = async (e, uid) => {
    e.stopPropagation()
    await updateDoc(doc(db, 'users', uid), { approved: true })
  }

  const abrirEditar = (e, u) => {
    e.stopPropagation()
    setEditando(u.id)
    setDescuentoBase(u.descuentoBase ?? 0)
    setVendedorId(u.vendedorId ?? '')
  }

  const guardarEditar = async (e) => {
    e?.stopPropagation()
    if (!editando) return
    await updateDoc(doc(db, 'users', editando), {
      descuentoBase,
      vendedorId: vendedorId || null,
    })
    setEditando(null)
  }

  const allTags = [...new Set(usuarios.flatMap(u => u.etiquetas || []))].filter(Boolean).sort()
  const [addingTagFor, setAddingTagFor] = useState(null)

  // Color fijo por etiqueta (estilo Gmail/WhatsApp)
  const ETIQUETA_COLORS = ['tag-blue', 'tag-green', 'tag-amber', 'tag-rose', 'tag-violet', 'tag-cyan', 'tag-emerald', 'tag-orange', 'tag-indigo', 'tag-teal']
  const getTagColorClass = (tag) => {
    let n = 0
    for (let i = 0; i < (tag || '').length; i++) n = ((n << 5) - n) + (tag || '').charCodeAt(i)
    return ETIQUETA_COLORS[Math.abs(n) % ETIQUETA_COLORS.length]
  }

  const agregarEtiqueta = async (e, userId, tag) => {
    e.stopPropagation()
    if (!tag?.trim()) return
    const t = tag.trim()
    await updateDoc(doc(db, 'users', userId), { etiquetas: arrayUnion(t) })
    setAddingTagFor(null)
  }

  const quitarEtiqueta = async (e, userId, tag) => {
    e.stopPropagation()
    await updateDoc(doc(db, 'users', userId), { etiquetas: arrayRemove(tag) })
  }

  return (
    <div className="container page">
      <h1 className="page-title">Usuarios</h1>
      <p className="page-subtitle">Hacé clic en un cliente para ver todos sus datos y pedidos.</p>

      <div className="admin-usuarios-filtros">
        <button className={filtro === 'todos' ? 'active' : ''} onClick={() => setFiltro('todos')}>
          Todos ({clientes.length})
        </button>
        <button className={filtro === 'pendientes' ? 'active' : ''} onClick={() => setFiltro('pendientes')}>
          Pendientes ({pendientes.length})
        </button>
        <button className={filtro === 'aprobados' ? 'active' : ''} onClick={() => setFiltro('aprobados')}>
          Aprobados ({aprobados.length})
        </button>
        <button className={filtro === 'bloqueados' ? 'active' : ''} onClick={() => setFiltro('bloqueados')}>
          Bloqueados ({bloqueados.length})
        </button>
        <span className="admin-usuarios-filtro-etiqueta">
          <label htmlFor="filtro-etiqueta">Etiqueta:</label>
          <select
            id="filtro-etiqueta"
            value={filtroEtiqueta}
            onChange={(e) => setFiltroEtiqueta(e.target.value)}
            className="admin-usuarios-etiqueta-select"
          >
            <option value="">Todas</option>
            {allTags.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </span>
      </div>

      <div className="table-wrap">
        <table className="admin-table admin-table-usuarios">
          <thead>
            <tr>
              <th className="admin-th-sortable" onClick={() => handleSort('email')}>
                Email {sortBy === 'email' && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
              </th>
              <th className="admin-th-sortable" onClick={() => handleSort('nombreEmpresa')}>
                Empresa {sortBy === 'nombreEmpresa' && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
              </th>
              <th className="admin-th-sortable" onClick={() => handleSort('rubro')}>
                Rubro {sortBy === 'rubro' && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
              </th>
              <th className="admin-th-sortable" onClick={() => handleSort('createdAt')}>
                Fecha de registro {sortBy === 'createdAt' && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
              </th>
              <th className="admin-th-sortable" onClick={() => handleSort('etiquetas')}>
                Etiquetas {sortBy === 'etiquetas' && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
              </th>
              <th className="admin-th-sortable" onClick={() => handleSort('descuentoBase')}>
                Descuento % {sortBy === 'descuentoBase' && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
              </th>
              <th className="admin-th-sortable" onClick={() => handleSort('vendedor')}>
                Vendedor {sortBy === 'vendedor' && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
              </th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuariosFiltrados.map(u => (
              <tr key={u.id} className="admin-usuario-row" onClick={() => navigate(`/admin/usuarios/${u.id}`)}>
                <td>
                  <span className="admin-usuario-email-cell">
                    {usersWithNewActivity.has(u.id) && <span className="user-activity-dot" title="Tuvo actividad reciente" />}
                    {u.email}
                  </span>
                </td>
                <td>{u.nombreEmpresa}</td>
                <td>{u.rubro}</td>
                <td>{formatDate(u.createdAt)}</td>
                <td className="admin-cell-etiquetas" onClick={e => e.stopPropagation()}>
                  <span className="admin-etiquetas-list">
                    {(u.etiquetas || []).map(et => (
                      <span key={et} className={`badge badge-tag ${getTagColorClass(et)}`}>
                        {et}
                        <button type="button" className="admin-etiqueta-remove" onClick={(e) => quitarEtiqueta(e, u.id, et)} aria-label={`Quitar ${et}`}>×</button>
                      </span>
                    ))}
                  </span>
                  {addingTagFor === u.id ? (
                    <span className="admin-etiquetas-add">
                      <select
                        autoFocus
                        className="admin-etiquetas-select"
                        onBlur={() => setAddingTagFor(null)}
                        onChange={(e) => {
                          const v = e.target.value
                          if (v === '__nueva__') {
                            const nueva = window.prompt('Nombre de la nueva etiqueta')
                            if (nueva?.trim()) agregarEtiqueta(e, u.id, nueva.trim())
                            e.target.value = ''
                            return
                          }
                          if (v) { agregarEtiqueta(e, u.id, v); e.target.value = '' }
                        }}
                      >
                        <option value="">Elegir...</option>
                        {allTags.filter(t => !(u.etiquetas || []).includes(t)).map(t => <option key={t} value={t}>{t}</option>)}
                        <option value="__nueva__">+ Nueva etiqueta</option>
                      </select>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAddingTagFor(null)}>Cancelar</button>
                    </span>
                  ) : (
                    <button type="button" className="btn btn-ghost btn-sm admin-etiqueta-btn-add" onClick={(e) => { e.stopPropagation(); setAddingTagFor(u.id); }} title="Agregar etiqueta">+ Etiqueta</button>
                  )}
                </td>
                <td>
                  {editando === u.id ? (
                    <input type="number" value={descuentoBase} onChange={(e) => setDescuentoBase(Number(e.target.value))} onClick={e => e.stopPropagation()} style={{ width: 60 }} />
                  ) : (
                    u.descuentoBase ?? 0
                  )}
                </td>
                <td>
                  {editando === u.id ? (
                    <select value={vendedorId} onChange={(e) => setVendedorId(e.target.value)} onClick={e => e.stopPropagation()}>
                      <option value="">Sin asignar</option>
                      {vendedores.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                    </select>
                  ) : (
                    vendedores.find(v => v.id === u.vendedorId)?.nombre || '-'
                  )}
                </td>
                <td>
                  {!u.approved && (
                    <button className="btn btn-primary btn-sm" onClick={(e) => aprobar(e, u.id)}>Aprobar</button>
                  )}
                  {editando === u.id ? (
                    <button className="btn btn-primary btn-sm" onClick={guardarEditar}>Guardar</button>
                  ) : (
                    <button className="btn btn-ghost btn-sm" onClick={(e) => abrirEditar(e, u)}>Editar</button>
                  )}
                  <span className="link-ver">Ver detalle →</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {usuariosFiltrados.length === 0 && (
        <p className="empty-state">No hay usuarios en esta lista.</p>
      )}
    </div>
  )
}
