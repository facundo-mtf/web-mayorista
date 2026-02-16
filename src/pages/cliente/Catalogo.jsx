import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import ImageLightbox from '../../components/ImageLightbox'
import { db } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'

export default function Catalogo() {
  const { profile } = useAuth()
  const [productos, setProductos] = useState([])
  const [carrito, setCarrito] = useState(() => JSON.parse(localStorage.getItem('carrito') || '[]'))
  const [busqueda, setBusqueda] = useState('')
  const [catalogoActivo, setCatalogoActivo] = useState('polesie')
  const [lightboxImagenes, setLightboxImagenes] = useState(null)

  const catalogos = [
    { id: 'polesie', label: 'Polesie' },
    { id: 'luni', label: 'LUNI' },
  ]

  const getImagenes = (p) => {
    if (p.imagenes?.length) return p.imagenes
    if (p.imagen) return [p.imagen]
    return []
  }

  useEffect(() => {
    const q = query(
      collection(db, 'productos'),
      where('activo', '==', true)
    )
    const unsub = onSnapshot(q, (snap) => {
      setProductos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    localStorage.setItem('carrito', JSON.stringify(carrito))
  }, [carrito])

  const descuentoBase = profile?.descuentoBase ?? 0

  const precioConDescuento = (precioPorBulto) => {
    return precioPorBulto * (1 - descuentoBase / 100)
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

  const productosVisibles = filtrarProductos()

  const subtotalCarrito = carrito.reduce((s, i) => {
    const precioPorBulto = i.precioPorBulto ?? (i.precioUnitario ?? 0) * (i.unidadesPorBulto ?? 1)
    return s + precioPorBulto * i.qty
  }, 0)
  const descuentoCarrito = subtotalCarrito * (descuentoBase / 100)

  const addToCart = (prod, bultos = 1) => {
    const bultosInt = Math.floor(Number(bultos)) || 1
    if (bultosInt < 1) return

    const enCarrito = carrito.find(p => p.id === prod.id)
    if (enCarrito) {
      setCarrito(carrito.map(p => p.id === prod.id ? { ...p, qty: p.qty + bultosInt } : p))
    } else {
      setCarrito([...carrito, { ...prod, qty: bultosInt }])
    }
  }

  return (
    <div className="catalogo-con-layout">
      <div className="catalogo-main">
        <div className="container page">
          <h1 className="page-title">Realizar pedido</h1>
          <p className="page-subtitle">
            Precios con {descuentoBase}% de descuento base. Pronto pago adicional aplica en checkout. Solo se venden bultos cerrados.
          </p>
          <div className="catalogo-tabs">
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
          <div className="catalogo-busqueda">
            <input
              type="search"
              placeholder="Buscar por descripción, SKU o palabras clave..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="busqueda-input"
            />
          </div>
          <div className="product-grid">
        {productosDelCatalogo.length === 0 ? (
          <p className="empty-state">No hay productos en el catálogo {catalogoActivo === 'polesie' ? 'Polesie' : 'LUNI'}. El administrador debe cargarlo.</p>
        ) : productosVisibles.length === 0 ? (
          <p className="empty-state">No se encontraron productos para &quot;{busqueda}&quot;.</p>
        ) : (
          productosVisibles.map((p) => {
            const unidPorBulto = p.unidadesPorBulto ?? 1
            const precioPorBulto = p.precioPorBulto ?? (p.precioUnitario ?? 0) * unidPorBulto
            const enCarrito = carrito.find(c => c.id === p.id)
            const bultosEnCarrito = enCarrito?.qty ?? 0

            return (
              <div key={p.id} className="product-card">
                {(() => {
                  const imagenes = getImagenes(p)
                  const imgPrincipal = imagenes[0]
                  return imgPrincipal ? (
                    <div className="product-image" onClick={() => imagenes.length > 0 && setLightboxImagenes(imagenes)}>
                      <img src={imgPrincipal} alt={p.descripcion ?? ''} onError={(e) => { e.target.style.display = 'none' }} />
                      {imagenes.length > 1 && <span className="product-image-badge">{imagenes.length}</span>}
                    </div>
                  ) : null
                })()}
                <div className="product-info">
                  <h3>{p.descripcion ?? p.nombre}</h3>
                  <p className="product-codigo">{p.sku ?? p.codigo ?? ''}</p>
                  {p.presentacion && <p className="product-presentacion">{p.presentacion}</p>}
                  {p.dimensiones && <p className="product-dimensiones">{p.dimensiones}</p>}
                  <p className="product-unidades">({unidPorBulto} unid. por bulto)</p>
                  <p className="product-price">
                    ${precioConDescuento(precioPorBulto).toLocaleString('es-AR')}
                    <span className="price-unit">/ bulto</span>
                    {descuentoBase > 0 && precioPorBulto > 0 && (
                      <span className="price-original">${precioPorBulto.toLocaleString('es-AR')}</span>
                    )}
                  </p>
                </div>
                <div className="product-add">
                  <input
                    type="number"
                    min="1"
                    defaultValue="1"
                    className="product-qty-input"
                    id={`qty-${p.id}`}
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      const input = document.getElementById(`qty-${p.id}`)
                      const val = input ? parseInt(input.value, 10) : 1
                      addToCart(p, val)
                      if (input) input.value = '1'
                    }}
                  >
                    Agregar
                  </button>
                </div>
                {bultosEnCarrito > 0 && (
                  <p className="product-in-cart">{bultosEnCarrito} bulto{bultosEnCarrito !== 1 ? 's' : ''} en carrito</p>
                )}
              </div>
            )
          })
        )}
          </div>
        </div>
      </div>
      <aside className="catalogo-carrito-sidebar">
        <div className="carrito-sidebar-inner">
          <h3>Tu carrito</h3>
          {carrito.length === 0 ? (
            <p className="carrito-sidebar-empty">Vacío</p>
          ) : (
            <>
              <ul className="carrito-sidebar-list">
                {carrito.map(i => {
                  const unidPorBulto = i.unidadesPorBulto ?? 1
                  const precioPorBulto = i.precioPorBulto ?? (i.precioUnitario ?? 0) * unidPorBulto
                  const totalUnid = i.qty * unidPorBulto
                  return (
                    <li key={i.id}>
                      <span className="carrito-sidebar-nombre">{i.descripcion ?? i.nombre}</span>
                      <span className="carrito-sidebar-detalle">
                        {i.qty} bulto{i.qty !== 1 ? 's' : ''} · {totalUnid} {totalUnid === 1 ? 'unidad' : 'unid.'} · ${(precioPorBulto * i.qty).toLocaleString('es-AR')}
                      </span>
                    </li>
                  )
                })}
              </ul>
              <p className="carrito-sidebar-total">Subtotal: ${(subtotalCarrito - descuentoCarrito).toLocaleString('es-AR')}</p>
              <Link to="/checkout" className="btn btn-primary btn-block">Ir al carrito</Link>
            </>
          )}
        </div>
      </aside>
      {carrito.length > 0 && (
        <div className="carrito-fab-mobile">
          <div className="carrito-fab-info">
            <span>{carrito.length} {carrito.length === 1 ? 'producto' : 'productos'}</span>
            <span className="carrito-fab-total">${(subtotalCarrito - descuentoCarrito).toLocaleString('es-AR')}</span>
          </div>
          <Link to="/checkout" className="btn btn-primary btn-sm">Ir al carrito</Link>
        </div>
      )}
      {lightboxImagenes && (
        <ImageLightbox imagenes={lightboxImagenes} onClose={() => setLightboxImagenes(null)} />
      )}
    </div>
  )
}
