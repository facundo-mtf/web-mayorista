import { useState, useEffect } from 'react'
import { collection, onSnapshot, doc, setDoc, deleteDoc, query, where } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { notificarTodosLosClientes } from '../../utils/notificaciones'
import { formatMoneda } from '../../utils/formatoNumero'

export default function AdminOfertas() {
  const [productos, setProductos] = useState([])
  const [ofertas, setOfertas] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [descuentoEdit, setDescuentoEdit] = useState({})

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'productos'), where('activo', '==', true)),
      (snap) => setProductos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    return () => unsub()
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'ofertas'), (snap) => {
      setOfertas(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [])

  const termino = busqueda.toLowerCase().trim()
  const productosFiltrados = termino
    ? productos.filter(p => {
        const t = `${p.descripcion ?? ''} ${p.nombre ?? ''} ${p.sku ?? ''} ${p.codigo ?? ''}`.toLowerCase()
        return t.includes(termino)
      })
    : []

  const agregarOferta = async (producto, descuentoPct) => {
    const num = Number(descuentoPct)
    if (descuentoPct === '' || descuentoPct === null || descuentoPct === undefined) {
      alert('Ingresá un porcentaje de descuento (0-100) antes de agregar la oferta.')
      return
    }
    if (isNaN(num)) {
      alert('El porcentaje debe ser un número.')
      return
    }
    const pct = Math.max(0, Math.min(100, num))
    try {
      await setDoc(doc(db, 'ofertas', producto.id), {
        productId: producto.id,
        descuentoPct: pct,
        descripcion: producto.descripcion ?? producto.nombre,
        sku: producto.sku ?? producto.codigo,
      })
      setDescuentoEdit(prev => ({ ...prev, [producto.id]: '' }))
      const notif = await notificarTodosLosClientes('Nueva oferta', 'Se agregó una nueva oferta al catálogo.')
      if (!notif.ok) {
        alert(`Oferta guardada. No se pudieron enviar notificaciones: ${notif.error || 'Revisá que tu usuario tenga role "admin" en la colección users.'}`)
      } else if (notif.count === 0) {
        console.warn('Oferta guardada. No hay clientes en la base para notificar.')
      }
    } catch (err) {
      console.error('Error al agregar oferta:', err)
      alert('No se pudo agregar la oferta. Revisá la consola o permisos de Firestore.')
    }
  }

  const quitarOferta = async (productId) => {
    if (!confirm('¿Quitar esta oferta?')) return
    await deleteDoc(doc(db, 'ofertas', productId))
  }

  const actualizarDescuento = async (productId, descuentoPct) => {
    const pct = Math.max(0, Math.min(100, Number(descuentoPct)))
    if (isNaN(pct)) return
    const oferta = ofertas.find(o => o.productId === productId)
    if (!oferta) return
    await setDoc(doc(db, 'ofertas', productId), { ...oferta, descuentoPct: pct })
    setDescuentoEdit(prev => ({ ...prev, [productId]: '' }))
  }

  return (
    <div className="container page">
      <h1 className="page-title">Ofertas</h1>
      <p className="page-subtitle">Buscá productos del catálogo y asigná un descuento puntual. Esos productos se verán en la sección OFERTAS del cliente.</p>

      <div className="admin-ofertas-busqueda">
        <input
          type="search"
          placeholder="Buscar por descripción, SKU..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="busqueda-input"
        />
      </div>

      {busqueda && (
        <div className="admin-ofertas-resultados">
          <h3>Resultados ({productosFiltrados.length})</h3>
          {productosFiltrados.length === 0 ? (
            <p className="empty-state">No hay productos que coincidan.</p>
          ) : (
            <ul className="admin-ofertas-lista">
              {productosFiltrados.map(p => {
                const yaEnOferta = ofertas.find(o => o.productId === p.id)
                const precioBulto = p.precioPorBulto ?? (p.precioUnitario ?? 0) * (p.unidadesPorBulto ?? 1)
                const desc = descuentoEdit[p.id] ?? (yaEnOferta?.descuentoPct ?? '')
                return (
                  <li key={p.id} className="admin-oferta-item">
                    <span className="admin-oferta-nombre">{p.descripcion ?? p.nombre} — {p.sku ?? p.codigo}</span>
                    <span className="admin-oferta-precio">${formatMoneda(precioBulto)}/bulto</span>
                    <div className="admin-oferta-acciones">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        placeholder="% desc"
                        value={desc}
                        onChange={(e) => setDescuentoEdit(prev => ({ ...prev, [p.id]: e.target.value }))}
                        style={{ width: 70 }}
                      />
                      {yaEnOferta ? (
                        <>
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => actualizarDescuento(p.id, desc)}>
                            Actualizar %
                          </button>
                          <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => quitarOferta(p.id)}>Quitar oferta</button>
                        </>
                      ) : (
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => agregarOferta(p, desc)}>
                          Agregar oferta
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      <div className="admin-ofertas-activas">
        <h3>Ofertas activas ({ofertas.length})</h3>
        {ofertas.length === 0 ? (
          <p className="empty-state">Aún no hay ofertas. Buscá un producto y asignale un descuento.</p>
        ) : (
          <ul className="admin-ofertas-lista">
            {ofertas.map(o => {
              const p = productos.find(pr => pr.id === o.productId)
              const precioBulto = p ? (p.precioPorBulto ?? (p.precioUnitario ?? 0) * (p.unidadesPorBulto ?? 1)) : 0
              const conDescuento = precioBulto * (1 - (o.descuentoPct ?? 0) / 100)
              return (
                <li key={o.id} className="admin-oferta-item">
                  <span className="admin-oferta-nombre">{o.descripcion ?? p?.descripcion} — {o.sku ?? p?.sku}</span>
                  <span className="admin-oferta-precio">${formatMoneda(precioBulto)} → ${formatMoneda(conDescuento)} ({o.descuentoPct}% off)</span>
                  <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => quitarOferta(o.productId)}>Quitar</button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
