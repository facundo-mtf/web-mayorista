import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore'
import ImageLightbox from '../../components/ImageLightbox'
import { db } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'
import { useCarrito } from '../../context/CarritoContext'
import { useActivityLog } from '../../utils/activityLog'
import { formatMoneda } from '../../utils/formatoNumero'

export default function Catalogo() {
  const { profile, user } = useAuth()
  const { carrito, setCarrito } = useCarrito()
  const { log } = useActivityLog()
  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [ofertas, setOfertas] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [catalogoActivo, setCatalogoActivo] = useState('polesie')
  const [vistaCatalogo, setVistaCatalogo] = useState('grid')
  const [imageIndexByProduct, setImageIndexByProduct] = useState({})
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
    const q = query(collection(db, 'categorias'), orderBy('orden', 'asc'))
    const unsub = onSnapshot(q, (snap) => {
      setCategorias(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'ofertas'), (snap) => {
      setOfertas(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    if (user) log('page_catalogo', {})
  }, [user?.uid])

  const descuentoBase = profile?.descuentoBase ?? 0
  const ofertaByProductId = Object.fromEntries((ofertas || []).map(o => [o.productId, o]))

  const precioConDescuento = (precioUnitario) => {
    return precioUnitario * (1 - descuentoBase / 100)
  }

  const getPrecioUnitarioConOferta = (producto, precioUnitario) => {
    const oferta = ofertaByProductId[producto.id]
    if (!oferta?.descuentoPct) return precioUnitario
    return precioUnitario * (1 - (oferta.descuentoPct ?? 0) / 100)
  }

  const productosDelCatalogo = productos.filter(p => (p.catalogo || 'polesie') === catalogoActivo)
  const productosEnOferta = productosDelCatalogo.filter(p => ofertaByProductId[p.id])

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

  const ordenarPorCategoria = (list) => {
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

  const productosVisibles = ordenarPorCategoria(filtrarProductos())

  function ProductCard({ p, getImagenes, addToCart, carrito, descuentoBase, ofertaByProductId, getPrecioUnitarioConOferta, precioConDescuento, formatMoneda, imageIndexByProduct, cycleProductImage, cycleProductImagePrev, setLightboxImagenes }) {
    const precioUnitario = p.precioUnitario ?? (p.precioPorBulto ?? 0) / (p.unidadesPorBulto ?? 1)
    const precioUnitarioConOferta = getPrecioUnitarioConOferta(p, precioUnitario)
    const tieneOferta = !!ofertaByProductId[p.id]
    const enCarrito = carrito.find(c => c.id === p.id)
    const unidadesEnCarrito = enCarrito?.qty ?? 0
    const imagenes = getImagenes(p)
    const idx = imageIndexByProduct[p.id] ?? 0
    const imgActual = imagenes[idx] ?? imagenes[0]

    return (
      <div className="product-card">
        {imgActual ? (
          <div className="product-image-wrap">
            <div className="product-image" onClick={() => imagenes.length > 0 && setLightboxImagenes(imagenes)}>
              <img src={imgActual} alt={p.descripcion ?? ''} onError={(e) => { e.target.style.display = 'none' }} />
              {imagenes.length > 1 && (
                <>
                  <span className="product-image-badge">{imagenes.length}</span>
                  <button type="button" tabIndex={-1} className="product-image-nav product-image-nav-prev" aria-label="Foto anterior" onClick={(e) => cycleProductImagePrev(p.id, imagenes.length, e)}>‹</button>
                  <button type="button" tabIndex={-1} className="product-image-nav product-image-nav-next" aria-label="Siguiente foto" onClick={(e) => cycleProductImage(p.id, imagenes.length, e)}>›</button>
                </>
              )}
            </div>
          </div>
        ) : null}
        <div className="product-info">
          <h3>{p.descripcion ?? p.nombre}</h3>
          <p className="product-codigo">{p.sku ?? p.codigo ?? ''}</p>
          {p.presentacion && <p className="product-presentacion">{p.presentacion}</p>}
          {p.dimensiones && <p className="product-dimensiones">{p.dimensiones}</p>}
          <p className="product-price-unit">
            Precio por unidad{' '}
            {tieneOferta ? (
              <>
                <span className="product-price-base-tachado">${formatMoneda(precioUnitario)}</span>
                <span className="product-price-final-oferta">${formatMoneda(precioUnitarioConOferta)}</span>
              </>
            ) : (
              <>${formatMoneda(precioUnitario)}</>
            )}{' '}
            <span className="price-sin-iva">(sin IVA)</span>
          </p>
        </div>
        <div className="product-add">
          <input type="number" min="1" defaultValue="1" className="product-qty-input" id={`qty-${p.id}`} placeholder="Unid." />
          <button className="btn btn-primary btn-sm" onClick={() => {
            const input = document.getElementById(`qty-${p.id}`)
            const val = input ? parseInt(input.value, 10) : 1
            addToCart(p, val)
            if (input) input.value = '1'
          }}>Agregar</button>
        </div>
        {unidadesEnCarrito > 0 && (
          <p className="product-in-cart">{unidadesEnCarrito} {unidadesEnCarrito === 1 ? 'unidad' : 'unidades'} en carrito</p>
        )}
      </div>
    )
  }

  const subtotalCarritoAntesDesc = carrito.reduce((s, i) => {
    const precioUnit = i.precioUnitario ?? (i.precioPorBulto ?? 0) / (i.unidadesPorBulto ?? 1)
    const precioFinal = getPrecioUnitarioConOferta(i, precioUnit)
    return s + precioFinal * i.qty
  }, 0)
  const montoDescuentoUsuario = subtotalCarritoAntesDesc * (descuentoBase / 100)
  const subtotalCarrito = subtotalCarritoAntesDesc - montoDescuentoUsuario
  const COMPRA_MINIMA = 1000000
  const alcanzaCompraMinima = subtotalCarrito >= COMPRA_MINIMA

  const actualizarCantidadCarrito = (productoId, qty) => {
    const n = Math.max(0, Math.floor(Number(qty)) || 0)
    const item = carrito.find(i => i.id === productoId)
    if (n === 0) {
      setCarrito(carrito.filter(i => i.id !== productoId))
      if (item) log('cart_remove_product', { productId: productoId, productName: item.descripcion || item.nombre })
      return
    }
    setCarrito(carrito.map(i => i.id === productoId ? { ...i, qty: n } : i))
    if (item) log('cart_update_qty', { productId: productoId, productName: item.descripcion || item.nombre, unidades: n })
  }
  const eliminarDelCarrito = (productoId) => {
    const item = carrito.find(i => i.id === productoId)
    setCarrito(carrito.filter(i => i.id !== productoId))
    if (item) log('cart_remove_product', { productId: productoId, productName: item.descripcion || item.nombre })
  }
  const cycleProductImage = (productId, totalImages, e) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    if (totalImages <= 1) return
    const scrollY = window.scrollY
    setImageIndexByProduct(prev => {
      const current = prev[productId] ?? 0
      const next = (current + 1) % totalImages
      return { ...prev, [productId]: next }
    })
    setTimeout(() => { window.scrollTo(0, scrollY) }, 0)
  }
  const cycleProductImagePrev = (productId, totalImages, e) => {
    e?.preventDefault?.()
    e?.stopPropagation?.()
    if (totalImages <= 1) return
    const scrollY = window.scrollY
    setImageIndexByProduct(prev => {
      const current = prev[productId] ?? 0
      const next = (current - 1 + totalImages) % totalImages
      return { ...prev, [productId]: next }
    })
    setTimeout(() => { window.scrollTo(0, scrollY) }, 0)
  }

  const addToCart = (prod, unidades = 1) => {
    const unidInt = Math.floor(Number(unidades)) || 1
    if (unidInt < 1) return
    const scrollY = window.scrollY
    const enCarrito = carrito.find(p => p.id === prod.id)
    if (enCarrito) {
      setCarrito(carrito.map(p => p.id === prod.id ? { ...p, qty: p.qty + unidInt } : p))
    } else {
      setCarrito([...carrito, { ...prod, qty: unidInt }])
    }
    log('cart_add_product', { productId: prod.id, productName: prod.descripcion || prod.nombre, unidades: unidInt })
    requestAnimationFrame(() => { window.scrollTo(0, scrollY) })
    setTimeout(() => { window.scrollTo(0, scrollY) }, 0)
  }

  return (
    <div className="catalogo-con-layout">
      <div className="catalogo-main">
        <div className="container page">
          <h1 className="page-title">Realizar pedido</h1>
          <p className="page-subtitle">
            Compra mínima $1.000.000
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
          <div className="catalogo-toolbar">
            <div className="catalogo-busqueda">
              <input
                type="search"
                placeholder="Buscar por descripción, SKU o palabras clave..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="busqueda-input"
              />
            </div>
            <div className="catalogo-vista-toggle">
              <span className="catalogo-vista-label">Vista:</span>
              <button type="button" className={vistaCatalogo === 'grid' ? 'active' : ''} onClick={() => setVistaCatalogo('grid')}>Cuadrícula</button>
              <button type="button" className={vistaCatalogo === 'list' ? 'active' : ''} onClick={() => setVistaCatalogo('list')}>Lista</button>
            </div>
          </div>

          {productosEnOferta.length > 0 && (
            <section className="catalogo-ofertas-section">
              <h2 className="catalogo-ofertas-titulo">Ofertas</h2>
              <div className={`product-grid product-grid--${vistaCatalogo} ${vistaCatalogo === 'grid' ? 'product-grid--4' : ''}`}>
                {ordenarPorCategoria(productosEnOferta).map((p) => (
                  <ProductCard
                    key={p.id}
                    p={p}
                    getImagenes={getImagenes}
                    addToCart={addToCart}
                    carrito={carrito}
                    descuentoBase={descuentoBase}
                    ofertaByProductId={ofertaByProductId}
                    getPrecioUnitarioConOferta={getPrecioUnitarioConOferta}
                    precioConDescuento={precioConDescuento}
                    formatMoneda={formatMoneda}
                    imageIndexByProduct={imageIndexByProduct}
                    cycleProductImage={cycleProductImage}
                    cycleProductImagePrev={cycleProductImagePrev}
                    setLightboxImagenes={setLightboxImagenes}
                  />
                ))}
              </div>
            </section>
          )}

          <div className={`product-grid product-grid--${vistaCatalogo} ${vistaCatalogo === 'grid' ? 'product-grid--4' : ''}`}>
        {productosDelCatalogo.length === 0 ? (
          <p className="empty-state">No hay productos en el catálogo {catalogoActivo === 'polesie' ? 'Polesie' : 'LUNI'}. El administrador debe cargarlo.</p>
        ) : productosVisibles.length === 0 ? (
          <p className="empty-state">No se encontraron productos para &quot;{busqueda}&quot;.</p>
        ) : (
          productosVisibles.map((p) => (
            <ProductCard
              key={p.id}
              p={p}
              getImagenes={getImagenes}
              addToCart={addToCart}
              carrito={carrito}
              descuentoBase={descuentoBase}
              ofertaByProductId={ofertaByProductId}
              getPrecioUnitarioConOferta={getPrecioUnitarioConOferta}
              precioConDescuento={precioConDescuento}
              formatMoneda={formatMoneda}
              imageIndexByProduct={imageIndexByProduct}
              cycleProductImage={cycleProductImage}
              cycleProductImagePrev={cycleProductImagePrev}
              setLightboxImagenes={setLightboxImagenes}
            />
          ))
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
                  const precioUnit = i.precioUnitario ?? (i.precioPorBulto ?? 0) / (i.unidadesPorBulto ?? 1)
                  const precioUnitFinal = getPrecioUnitarioConOferta(i, precioUnit)
                  const tieneOferta = !!ofertaByProductId[i.id]
                  const totalLinea = precioUnitFinal * i.qty
                  return (
                    <li key={i.id} className="carrito-sidebar-item">
                      <span className="carrito-sidebar-nombre">{i.descripcion ?? i.nombre}</span>
                      <div className="carrito-sidebar-row">
                        <span className="carrito-sidebar-detalle">
                          {tieneOferta && <span className="product-price-base-tachado">${formatMoneda(precioUnit * i.qty)}</span>}
                          {i.qty} {i.qty === 1 ? 'unidad' : 'unid.'} · $/u ${formatMoneda(precioUnitFinal)} (sin IVA) · ${formatMoneda(totalLinea)}
                        </span>
                      </div>
                      <div className="carrito-sidebar-actions">
                        <input type="number" min="1" value={i.qty} onChange={(e) => actualizarCantidadCarrito(i.id, e.target.value)} className="carrito-sidebar-qty" />
                        <button type="button" className="carrito-sidebar-remove" onClick={() => eliminarDelCarrito(i.id)} aria-label="Quitar">×</button>
                      </div>
                    </li>
                  )
                })}
              </ul>
              <p className="carrito-sidebar-total">Subtotal: ${formatMoneda(subtotalCarritoAntesDesc)}</p>
              {descuentoBase > 0 && montoDescuentoUsuario > 0 && (
                <p className="carrito-sidebar-descuento">Descuento ({descuentoBase}%): <span className="monto-negativo">-${formatMoneda(montoDescuentoUsuario)}</span></p>
              )}
              <p className="carrito-sidebar-total">Total: ${formatMoneda(subtotalCarrito)}</p>
              {!alcanzaCompraMinima && (
                <p className="carrito-sidebar-minimo">Compra mínima: ${formatMoneda(COMPRA_MINIMA)}</p>
              )}
              {alcanzaCompraMinima ? (
                <Link to="/checkout" className="btn btn-primary btn-block">Ir al carrito</Link>
              ) : (
                <span className="btn btn-primary btn-block btn-disabled" aria-disabled="true">Ir al carrito</span>
              )}
            </>
          )}
        </div>
      </aside>
      {carrito.length > 0 && (
        <div className="carrito-fab-mobile">
          <div className="carrito-fab-info">
            <span>{carrito.length} {carrito.length === 1 ? 'producto' : 'productos'}</span>
            <span className="carrito-fab-total">Total: ${formatMoneda(subtotalCarrito)}</span>
            {!alcanzaCompraMinima && <span className="carrito-fab-minimo">Mín. $1.000.000</span>}
          </div>
          {alcanzaCompraMinima ? (
            <Link to="/checkout" className="btn btn-primary btn-sm">Ir al carrito</Link>
          ) : (
            <span className="btn btn-primary btn-sm btn-disabled" aria-disabled="true">Ir al carrito</span>
          )}
        </div>
      )}
      {lightboxImagenes && (
        <ImageLightbox imagenes={lightboxImagenes} onClose={() => setLightboxImagenes(null)} />
      )}
    </div>
  )
}
