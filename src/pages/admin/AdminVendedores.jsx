import { useState, useEffect } from 'react'
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'

export default function AdminVendedores() {
  const [vendedores, setVendedores] = useState([])
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [editando, setEditando] = useState(null)
  const [nombreEdit, setNombreEdit] = useState('')

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'vendedores'), (snap) => {
      setVendedores(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [])

  const agregar = async (e) => {
    e.preventDefault()
    const nombre = nombreNuevo.trim()
    if (!nombre) return
    await addDoc(collection(db, 'vendedores'), { nombre })
    setNombreNuevo('')
  }

  const abrirEditar = (v) => {
    setEditando(v.id)
    setNombreEdit(v.nombre || '')
  }

  const guardarEditar = async () => {
    if (!editando) return
    const nombre = nombreEdit.trim()
    if (!nombre) return
    await updateDoc(doc(db, 'vendedores', editando), { nombre })
    setEditando(null)
  }

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar este vendedor?')) return
    await deleteDoc(doc(db, 'vendedores', id))
    if (editando === id) setEditando(null)
  }

  return (
    <div className="container page">
      <h1 className="page-title">Vendedores</h1>
      <p className="page-subtitle">Gestioná la lista de vendedores. Esta lista se usa en el checkout y al asignar clientes.</p>

      <section className="admin-section">
        <h2>Agregar vendedor</h2>
        <form onSubmit={agregar} className="form-inline">
          <input
            placeholder="Nombre del vendedor"
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value)}
          />
          <button type="submit" className="btn btn-primary">Agregar</button>
        </form>
      </section>

      <section className="admin-section">
        <h2>Lista de vendedores ({vendedores.length})</h2>
        {vendedores.length === 0 ? (
          <p className="empty-state">No hay vendedores cargados. Agregá uno arriba.</p>
        ) : (
          <ul className="entidades-list admin-vendedores-list">
            {vendedores.map(v => (
              <li key={v.id} className="admin-vendedor-item">
                {editando === v.id ? (
                  <>
                    <input
                      value={nombreEdit}
                      onChange={(e) => setNombreEdit(e.target.value)}
                      className="admin-vendedor-input"
                    />
                    <div className="acciones-cell">
                      <button type="button" className="btn btn-primary btn-sm" onClick={guardarEditar}>Guardar</button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditando(null)}>Cancelar</button>
                    </div>
                  </>
                ) : (
                  <>
                    <strong>{v.nombre}</strong>
                    <div className="acciones-cell">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => abrirEditar(v)}>Editar</button>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => eliminar(v.id)}>Eliminar</button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
