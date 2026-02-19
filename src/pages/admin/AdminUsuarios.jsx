import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, onSnapshot, doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore'
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

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      setUsuarios(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!user?.uid) return
    setDoc(doc(db, 'adminConfig', user.uid), { lastViewedUsuariosAt: serverTimestamp() }, { merge: true })
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

  const usuariosFiltrados = filtro === 'pendientes' ? pendientes
    : filtro === 'aprobados' ? aprobados
    : filtro === 'bloqueados' ? bloqueados
    : clientes

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
      </div>

      <div className="table-wrap">
        <table className="admin-table admin-table-usuarios">
          <thead>
            <tr>
              <th>Email</th>
              <th>Empresa</th>
              <th>Rubro</th>
              <th>Estado</th>
              <th>Descuento %</th>
              <th>Vendedor</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuariosFiltrados.map(u => (
              <tr key={u.id} className="admin-usuario-row" onClick={() => navigate(`/admin/usuarios/${u.id}`)}>
                <td>{u.email}</td>
                <td>{u.nombreEmpresa}</td>
                <td>{u.rubro}</td>
                <td>
                  {u.blocked ? <span className="badge badge-danger">Bloqueado</span> : u.approved ? <span className="badge badge-ok">Aprobado</span> : <span className="badge badge-pending">Pendiente</span>}
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
