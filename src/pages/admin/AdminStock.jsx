import { useState, useEffect } from 'react'
import imageCompression from 'browser-image-compression'
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, query, orderBy, writeBatch } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../../firebase/config'
import { formatMoneda } from '../../utils/formatoNumero'
import { notificarTodosLosClientes } from '../../utils/notificaciones'

const OPCIONES_COMPRESION = { maxSizeMB: 0.3, maxWidthOrHeight: 1200 }
import { useAuth } from '../../context/AuthContext'
import ImportarExcel from '../../components/ImportarExcel'

export default function AdminCatalogo() {
  const { user } = useAuth()
  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [nuevaCategoria, setNuevaCategoria] = useState('')
  const [guardandoCat, setGuardandoCat] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [catalogoActivo, setCatalogoActivo] = useState('polesie')
  const catalogos = [{ id: 'polesie', label: 'Polesie' }, { id: 'luni', label: 'LUNI' }]
  const [form, setForm] = useState({
    descripcion: '',
    sku: '',
    imagenFiles: [],
    dimensiones: '',
    presentacion: '',
    precioUnitario: '',
    unidadesPorBulto: '',
    categoriaId: '',
  })
  const [editando, setEditando] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [arrastrando, setArrastrando] = useState(null)
  const [reordenando, setReordenando] = useState(false)
  const [dropTargetIdx, setDropTargetIdx] = useState(null)
  const [editForm, setEditForm] = useState({
    descripcion: '',
    sku: '',
    imagenes: [],
    nuevosArchivos: [],
    dimensiones: '',
    presentacion: '',
    precioUnitario: '',
    unidadesPorBulto: '',
    categoriaId: '',
  })

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'productos'), (snap) => {
      setProductos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'categorias'), orderBy('orden', 'asc'))
    const unsub = onSnapshot(q, (snap) => {
      setCategorias(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [])

  const agregarCategoria = async (e) => {
    e?.preventDefault?.()
    const nombre = (nuevaCategoria || '').trim()
    if (!nombre) return
    setGuardandoCat(true)
    try {
      const maxOrden = categorias.length > 0 ? Math.max(...categorias.map(c => c.orden ?? 0)) : 0
      await addDoc(collection(db, 'categorias'), { nombre, orden: maxOrden + 1 })
      setNuevaCategoria('')
    } finally {
      setGuardandoCat(false)
    }
  }

  const eliminarCategoria = async (catId) => {
    if (!confirm('¿Eliminar esta categoría? Los productos quedarán sin categoría.')) return
    const batch = writeBatch(db)
    const productosConCat = productos.filter(p => p.categoriaId === catId)
    for (const p of productosConCat) {
      batch.update(doc(db, 'productos', p.id), { categoriaId: null })
    }
    batch.delete(doc(db, 'categorias', catId))
    await batch.commit()
  }

  const subirImagen = async (file, index = 0) => {
    if (!file || !user) return null
    let archivo = file
    if (file.type?.startsWith('image/')) {
      try {
        archivo = await imageCompression(file, OPCIONES_COMPRESION)
      } catch (_) {}
    }
    const unique = `${Date.now()}_${index}_${Math.random().toString(36).slice(2, 9)}`
    const path = `productos/${user.uid}/${unique}_${archivo.name}`
    const storageRef = ref(storage, path)
    await uploadBytes(storageRef, archivo)
    return getDownloadURL(storageRef)
  }

  const agregarProducto = async (e) => {
    e.preventDefault()
    setGuardando(true)
    try {
    const precioUnitario = Number(form.precioUnitario) || 0
    const unidadesPorBulto = Number(form.unidadesPorBulto) || 1
    const precioPorBulto = precioUnitario * unidadesPorBulto

    const files = form.imagenFiles || []
    const imagenes = (await Promise.all(files.map((f, i) => subirImagen(f, i)))).filter(Boolean)

    const productosCat = productos.filter(p => (p.catalogo || 'polesie') === catalogoActivo)
    const maxOrden = productosCat.length > 0 ? Math.max(...productosCat.map(p => p.orden ?? 0), 0) : 0
    await addDoc(collection(db, 'productos'), {
      descripcion: form.descripcion,
      sku: form.sku || null,
      imagenes,
      imagen: imagenes[0] || null,
      dimensiones: form.dimensiones || null,
      presentacion: form.presentacion || null,
      precioUnitario,
      unidadesPorBulto,
      precioPorBulto,
      activo: true,
      catalogo: catalogoActivo,
      categoriaId: form.categoriaId || null,
      orden: maxOrden + 1,
    })
    setForm({ descripcion: '', sku: '', imagenFiles: [], dimensiones: '', presentacion: '', precioUnitario: '', unidadesPorBulto: '', categoriaId: '' })
    notificarTodosLosClientes('Nuevo producto', 'Hay un nuevo producto en el catálogo.').catch(() => {})
    } finally {
      setGuardando(false)
    }
  }

  const abrirEditar = (p) => {
    const imgs = p.imagenes?.length ? p.imagenes : (p.imagen ? [p.imagen] : [])
    setEditando(p.id)
    setEditForm({
      descripcion: String(p.descripcion ?? ''),
      sku: String(p.sku ?? ''),
      imagenes: [...imgs],
      nuevosArchivos: [],
      dimensiones: String(p.dimensiones ?? ''),
      presentacion: String(p.presentacion ?? ''),
      precioUnitario: String(p.precioUnitario ?? ''),
      unidadesPorBulto: String(p.unidadesPorBulto ?? '1'),
      categoriaId: p.categoriaId || '',
    })
  }

  const guardarEditar = async () => {
    if (!editando) return
    setGuardando(true)
    try {
    const precioUnitario = Number(editForm.precioUnitario) || 0
    const unidadesPorBulto = Number(editForm.unidadesPorBulto) || 1
    const precioPorBulto = precioUnitario * unidadesPorBulto

    const imagenes = [...(editForm.imagenes || [])]
    const nuevos = editForm.nuevosArchivos || []
    const urlsNuevos = (await Promise.all(nuevos.map((f, i) => subirImagen(f, i)))).filter(Boolean)
    imagenes.push(...urlsNuevos)

    await updateDoc(doc(db, 'productos', editando), {
      descripcion: editForm.descripcion,
      sku: editForm.sku || null,
      imagenes,
      imagen: imagenes[0] || null,
      dimensiones: editForm.dimensiones || null,
      presentacion: editForm.presentacion || null,
      precioUnitario,
      unidadesPorBulto,
      precioPorBulto,
      catalogo: catalogoActivo,
      categoriaId: editForm.categoriaId || null,
    })
    setEditando(null)
    } finally {
      setGuardando(false)
    }
  }

  const quitarNuevoArchivoEdit = (index) => {
    setEditForm(f => ({ ...f, nuevosArchivos: (f.nuevosArchivos || []).filter((_, i) => i !== index) }))
  }

  const quitarImagenEdit = (i) => {
    setEditForm(f => ({ ...f, imagenes: f.imagenes.filter((_, idx) => idx !== i) }))
  }

  const moverImagenEdit = (from, to) => {
    if (to < 0 || to >= editForm.imagenes.length) return
    const arr = [...editForm.imagenes]
    const [removed] = arr.splice(from, 1)
    arr.splice(to, 0, removed)
    setEditForm(f => ({ ...f, imagenes: arr }))
  }

  const productosDelCatalogo = productos.filter(p => (p.catalogo || 'polesie') === catalogoActivo)

  const filtrarProductos = () => {
    const termino = busqueda.toLowerCase().trim()
    if (!termino) return productosDelCatalogo
    const palabras = termino.split(/\s+/)
    return productosDelCatalogo.filter(p => {
      const desc = (p.descripcion ?? p.nombre ?? '').toLowerCase()
      const sku = (p.sku ?? p.codigo ?? '').toLowerCase()
      const present = (p.presentacion ?? '').toLowerCase()
      const dim = (p.dimensiones ?? '').toLowerCase()
      const texto = `${desc} ${sku} ${present} ${dim}`
      return palabras.every(pal => texto.includes(pal))
    })
  }

  const ordenarPorCategoriaYOrden = (list) => {
    const mapOrden = Object.fromEntries(categorias.map((c, i) => [c.id, i]))
    return [...list].sort((a, b) => {
      const ordA = a.orden ?? 999999
      const ordB = b.orden ?? 999999
      if (ordA !== ordB) return ordA - ordB
      const ordCatA = a.categoriaId != null ? (mapOrden[a.categoriaId] ?? 9999) : 9999
      const ordCatB = b.categoriaId != null ? (mapOrden[b.categoriaId] ?? 9999) : 9999
      if (ordCatA !== ordCatB) return ordCatA - ordCatB
      return (a.descripcion ?? '').localeCompare(b.descripcion ?? '')
    })
  }

  const catalogOrdenados = ordenarPorCategoriaYOrden(productosDelCatalogo)
  const productosVisibles = busqueda.trim()
    ? ordenarPorCategoriaYOrden(filtrarProductos())
    : catalogOrdenados

  const handleDragOver = (e, idx) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    if (typeof idx === 'number') setDropTargetIdx(idx)
  }

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDropTargetIdx(null)
    }
  }

  const handleDragEnd = () => {
    setArrastrando(null)
  }

  const quitarImagenAdd = (index) => {
    setForm(f => ({ ...f, imagenFiles: (f.imagenFiles || []).filter((_, i) => i !== index) }))
  }

  const eliminarProducto = async (id) => {
    if (!confirm('¿Eliminar este producto?')) return
    await deleteDoc(doc(db, 'productos', id))
    if (editando === id) setEditando(null)
  }

  return (
    <div className="container page">
      <h1 className="page-title">Catálogo</h1>
      <div className="catalogo-tabs" style={{ marginBottom: '1.5rem' }}>
        {catalogos.map(c => (
          <button
            key={c.id}
            type="button"
            className={`catalogo-tab ${catalogoActivo === c.id ? 'active' : ''}`}
            onClick={() => setCatalogoActivo(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <section className="admin-section">
        <div className="admin-section-header">
          <h2>Categorías</h2>
        </div>
        <form onSubmit={agregarCategoria} className="form-inline flex-wrap" style={{ marginBottom: '1rem' }}>
          <input
            placeholder="Nueva categoría"
            value={nuevaCategoria}
            onChange={(e) => setNuevaCategoria(e.target.value)}
            style={{ width: 200 }}
          />
          <button type="submit" className="btn btn-primary" disabled={guardandoCat || !nuevaCategoria.trim()}>
            {guardandoCat ? '...' : 'Agregar categoría'}
          </button>
        </form>
        {categorias.length > 0 && (
          <div className="categorias-lista">
            {categorias.map(c => (
              <span key={c.id} className="badge-categoria">
                {c.nombre}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => eliminarCategoria(c.id)} title="Eliminar">×</button>
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="admin-section">
        <div className="admin-section-header">
          <h2>Agregar producto</h2>
          <ImportarExcel catalogo={catalogoActivo} onImportado={() => {}} />
        </div>
        <form onSubmit={agregarProducto} className="form-inline flex-wrap">
          <input placeholder="Descripción *" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} required />
          <input placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          <label className="input-file-label">
            Fotos (varias)
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                const files = e.target.files ? Array.from(e.target.files) : []
                if (files.length) setForm(f => ({ ...f, imagenFiles: [...(f.imagenFiles || []), ...files] }))
                e.target.value = ''
              }}
              style={{ display: 'none' }}
            />
            <span className="input-file-text">{form.imagenFiles?.length ? `${form.imagenFiles.length} archivo(s)` : 'Seleccionar'}</span>
          </label>
          {form.imagenFiles?.length > 0 && (
            <div className="admin-fotos-pendientes">
              {form.imagenFiles.map((f, i) => (
                <span key={i} className="admin-foto-pendiente">
                  {f.name}
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => quitarImagenAdd(i)} title="Quitar">×</button>
                </span>
              ))}
            </div>
          )}
          <input placeholder="Dimensiones" value={form.dimensiones} onChange={(e) => setForm({ ...form, dimensiones: e.target.value })} />
          <input placeholder="Presentación" value={form.presentacion} onChange={(e) => setForm({ ...form, presentacion: e.target.value })} />
          <input type="number" placeholder="Precio unitario *" value={form.precioUnitario} onChange={(e) => setForm({ ...form, precioUnitario: e.target.value })} required />
          <input type="number" placeholder="Unidades por bulto" value={form.unidadesPorBulto} onChange={(e) => setForm({ ...form, unidadesPorBulto: e.target.value })} min="1" />
          <select value={form.categoriaId} onChange={(e) => setForm({ ...form, categoriaId: e.target.value })} style={{ minWidth: 140 }}>
            <option value="">Sin categoría</option>
            {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <button type="submit" className="btn btn-primary" disabled={guardando}>{guardando ? 'Subiendo fotos...' : 'Agregar'}</button>
        </form>
      </section>

      <section className="admin-section">
        <div className="admin-section-header">
          <h2>Productos ({productosVisibles.length}{busqueda ? ` de ${productosDelCatalogo.length}` : ''})</h2>
          <span className="hint" style={{ marginLeft: '0.5rem', fontWeight: 'normal' }}>Arrastrá las filas para cambiar el orden</span>
          <input
            type="search"
            placeholder="Buscar por descripción, SKU o palabras clave..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="busqueda-input"
            style={{ maxWidth: 320 }}
          />
        </div>
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: 32 }}></th>
                <th>Descripción</th>
                <th>SKU</th>
                <th>Categoría</th>
                <th>Imagen</th>
                <th>Dimensiones</th>
                <th>Presentación</th>
                <th>Precio unit.</th>
                <th>Unid/bulto</th>
                <th>Precio/bulto</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}>
              {productosVisibles.map((p, idx) => {
                const precioPorBulto = p.precioPorBulto ?? (p.precioUnitario ?? 0) * (p.unidadesPorBulto ?? 1)
                const isDragging = arrastrando === p.id
                return (
                  <tr
                    key={p.id}
                    data-row-index={idx}
                    draggable={!editando && !reordenando}
                    onDragStart={(e) => {
                      if (!editando && !reordenando) {
                        e.dataTransfer.effectAllowed = 'move'
                        e.dataTransfer.setData('text/plain', p.id)
                        setArrastrando(p.id)
                      }
                    }}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      const productId = e.dataTransfer.getData('text/plain')
                      if (!productId || reordenando) return
                      const dropTarget = productosVisibles[idx]
                      if (!dropTarget || dropTarget.id === productId) return
                      setArrastrando(null)
                      setDropTargetIdx(null)
                      setReordenando(true)
                      const catalogList = [...catalogOrdenados]
                      const fromIdx = catalogList.findIndex(x => x.id === productId)
                      if (fromIdx === -1) { setReordenando(false); return }
                      const toIdx = catalogList.findIndex(x => x.id === dropTarget.id)
                      if (toIdx === -1) { setReordenando(false); return }
                      const [removed] = catalogList.splice(fromIdx, 1)
                      catalogList.splice(toIdx, 0, removed)
                      const batch = writeBatch(db)
                      catalogList.forEach((prod, i) => {
                        batch.update(doc(db, 'productos', prod.id), { orden: i })
                      })
                      batch.commit().catch(err => {
                        console.error('Error al reordenar:', err)
                        alert('Error al guardar el nuevo orden.')
                      }).finally(() => setReordenando(false))
                    }}
                    onDragEnd={handleDragEnd}
                    className={`admin-producto-row ${isDragging ? 'admin-row-dragging' : ''} ${dropTargetIdx === idx ? 'admin-row-drop-target' : ''}`}
                  >
                    <td className="admin-drag-handle" title="Arrastrar para reordenar">
                      {!editando && <span className="drag-handle-icon">⋮⋮</span>}
                    </td>
                    <td>
                      {editando === p.id ? (
                        <input value={editForm.descripcion} onChange={(e) => setEditForm({ ...editForm, descripcion: e.target.value })} style={{ width: 140 }} />
                      ) : (
                        p.descripcion
                      )}
                    </td>
                    <td>
                      {editando === p.id ? (
                        <input value={editForm.sku} onChange={(e) => setEditForm({ ...editForm, sku: e.target.value })} style={{ width: 80 }} />
                      ) : (
                        p.sku ?? '-'
                      )}
                    </td>
                    <td>
                      {editando === p.id ? (
                        <select value={editForm.categoriaId} onChange={(e) => setEditForm({ ...editForm, categoriaId: e.target.value })} style={{ minWidth: 120 }}>
                          <option value="">Sin categoría</option>
                          {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                      ) : (
                        categorias.find(c => c.id === p.categoriaId)?.nombre ?? '-'
                      )}
                    </td>
                    <td>
                      {editando === p.id ? (
                        <div className="admin-imagenes-edit">
                          <div className="admin-imagenes-thumbs">
                            {(editForm.imagenes || []).map((url, i) => (
                              <div key={`img-${i}`} className="admin-imagen-thumb">
                                <img src={url} alt="" />
                                <div className="admin-imagen-acciones">
                                  {i > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => moverImagenEdit(i, i - 1)} title="Principal">←</button>}
                                  <button type="button" className="btn btn-danger btn-sm" onClick={() => quitarImagenEdit(i)}>×</button>
                                </div>
                              </div>
                            ))}
                            {(editForm.nuevosArchivos || []).map((file, i) => (
                              <div key={`new-${i}`} className="admin-imagen-thumb">
                                <img src={URL.createObjectURL(file)} alt="" />
                                <div className="admin-imagen-acciones">
                                  <button type="button" className="btn btn-danger btn-sm" onClick={() => quitarNuevoArchivoEdit(i)} title="Quitar">×</button>
                                </div>
                              </div>
                            ))}
                          </div>
                          <label className="input-file-label">
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={(e) => {
                                const files = e.target.files ? Array.from(e.target.files) : []
                                if (files.length) setEditForm(f => ({ ...f, nuevosArchivos: [...(f.nuevosArchivos || []), ...files] }))
                                e.target.value = ''
                              }}
                              style={{ display: 'none' }}
                            />
                            <span className="input-file-text">+ Agregar fotos</span>
                          </label>
                        </div>
                      ) : (() => {
                        const img = p.imagenes?.[0] || p.imagen
                        return img ? (
                          <img src={img} alt="" style={{ maxWidth: 40, maxHeight: 40, objectFit: 'contain' }} onError={(e) => { e.target.style.display = 'none' }} />
                        ) : '-'
                      })()}
                    </td>
                    <td>
                      {editando === p.id ? (
                        <input value={editForm.dimensiones} onChange={(e) => setEditForm({ ...editForm, dimensiones: e.target.value })} style={{ width: 90 }} />
                      ) : (
                        p.dimensiones ?? '-'
                      )}
                    </td>
                    <td>
                      {editando === p.id ? (
                        <input value={editForm.presentacion} onChange={(e) => setEditForm({ ...editForm, presentacion: e.target.value })} style={{ width: 90 }} />
                      ) : (
                        p.presentacion ?? '-'
                      )}
                    </td>
                    <td>
                      {editando === p.id ? (
                        <input type="number" value={editForm.precioUnitario} onChange={(e) => setEditForm({ ...editForm, precioUnitario: e.target.value })} style={{ width: 80 }} />
                      ) : (
                        `$${formatMoneda(p.precioUnitario ?? 0)}`
                      )}
                    </td>
                    <td>
                      {editando === p.id ? (
                        <input type="number" value={editForm.unidadesPorBulto} onChange={(e) => setEditForm({ ...editForm, unidadesPorBulto: e.target.value })} style={{ width: 70 }} min="1" />
                      ) : (
                        p.unidadesPorBulto ?? 1
                      )}
                    </td>
                    <td>${formatMoneda(precioPorBulto)}</td>
                    <td>
                      {editando === p.id ? (
                        <div className="acciones-cell">
                          <button type="button" className="btn btn-primary btn-sm" onClick={guardarEditar} disabled={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</button>
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditando(null)}>Cancelar</button>
                        </div>
                      ) : (
                        <div className="acciones-cell">
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => abrirEditar(p)}>Editar</button>
                          <button type="button" className="btn btn-danger btn-sm" onClick={() => eliminarProducto(p.id)}>Eliminar</button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
