import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore'
import ImageLightbox from '../../components/ImageLightbox'
import { db } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'
import { useCarrito } from '../../context/CarritoContext'
import { formatMoneda } from '../../utils/formatoNumero'

export default function Catalogo() {
  const { profile } = useAuth()
  const { carrito, setCarrito } = useCarrito()
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

  const descuentoBase = profile?.descuentoBase ?? 0
  const ofertaByProductId = Object.fromEntries((ofertas || []).map(o => [o.productId, o]))

  const precioConDescuento = (precioPorBulto) => {
    return precioPorBulto * (1 - descuentoBase / 100)
  }

  const getPrecioBultoConOferta = (producto, precioPorBulto) => {
    const oferta = ofertaByProductId[producto.id]
    if (!oferta?.descuentoPct) return precioPorBulto
    return precioPorBulto * (1 - (oferta.descuentoPct ?? 0) / 100)
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

  function ProductCard({ p, getImagenes, addToCart, carrito, descuentoBase, ofertaByProductId, getPrecioBultoConOferta, precioConDescuento, formatMoneda, imageIndexByProduct, cycleProductImage, cycleProductImagePrev, setLightboxImagenes }) {
    const unidPorBulto = p.unidadesPorBulto ?? 1
    const precioPorBulto = p.precioPorBulto ?? (p.precioUnitario ?? 0) * unidPorBulto
    const precioConOfertaBulto = getPrecioBultoConOferta(p, precioPorBulto)
    const tieneOferta = !!ofertaByProductId[p.id]
    const enCarrito = carrito.find(c => c.id === p.id)
    const bultosEnCarrito = enCarrito?.qty ?? 0
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
          <p className="product-unidades">({unidPorBulto} unid. por bulto)</p>
          <p className="product-price-unit">
            Precio unitario:{' '}
            {tieneOferta ? (
              <>
                <span className="product-price-base-tachado">${formatMoneda(p.precioUnitario ?? precioPorBulto / unidPorBulto)}</span>
                <span className="product-price-final-oferta">${formatMoneda(precioConOfertaBulto / unidPorBulto)}</span>
              </>
            ) : (
              <>${formatMoneda(p.precioUnitario ?? precioPorBulto / unidPorBulto)}</>
            )}{' '}
            <span className="price-sin-iva">(sin IVA)</span>
          </p>
          <p className={`product-price ${tieneOferta ? 'price-with-offer' : ''}`}>
            {tieneOferta ? (
              <>
                <span className="product-price-base-tachado">${formatMoneda(precioPorBulto)}</span>
                <span className="product-price-final-oferta">${formatMoneda(precioConOfertaBulto)}</span>
                <span className="price-unit">/ bulto</span>
              </>
            ) : (
              <>
                ${formatMoneda(precioPorBulto)}
                <span className="price-unit">/ bulto</span>
              </>
            )}
          </p>
        </div>
        <div className="product-add">
          <input type="number" min="1" defaultValue="1" className="product-qty-input" id={`qty-${p.id}`} />
          <button className="btn btn-primary btn-sm" onClick={() => {
            const input = document.getElementById(`qty-${p.id}`)
            const val = input ? parseInt(input.value, 10) : 1
            addToCart(p, val)
            if (input) input.value = '1'
          }}>Agregar</button>
        </div>
        {bultosEnCarrito > 0 && (
          <p className="product-in-cart">{bultosEnCarrito} bulto{bultosEnCarrito !== 1 ? 's' : ''} en carrito</p>
        )}
      </div>
    )
  }

  const subtotalCarritoAntesDesc = carrito.reduce((s, i) => {
    const precioPorBulto = i.precioPorBulto ?? (i.precioUnitario ?? 0) * (i.unidadesPorBulto ?? 1)
    const precioFinal = getPrecioBultoConOferta(i, precioPorBulto)
    return s + precioFinal * i.qty
  }, 0)
  const montoDescuentoUsuario = subtotalCarritoAntesDesc * (descuentoBase / 100)
  const subtotalCarrito = subtotalCarritoAntesDesc - montoDescuentoUsuario

  const actualizarCantidadCarrito = (productoId, qty) => {
    const n = Math.max(0, Math.floor(Number(qty)) || 0)
    if (n === 0) {
      setCarrito(carrito.filter(i => i.id !== productoId))
      return
    }
    setCarrito(carrito.map(i => i.id === productoId ? { ...i, qty: n } : i))
  }
  const eliminarDelCarrito = (productoId) => {
    setCarrito(carrito.filter(i => i.id !== productoId))
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

  const addToCart = (prod, bultos = 1) => {
    const bultosInt = Math.floor(Number(bultos)) || 1
    if (bultosInt < 1) return
    const scrollY = window.scrollY
    const enCarrito = carrito.find(p => p.id === prod.id)
    if (enCarrito) {
      setCarrito(carrito.map(p => p.id === prod.id ? { ...p, qty: p.qty + bultosInt } : p))
    } else {
      setCarrito([...carrito, { ...prod, qty: bultosInt }])
    }
    requestAnimationFrame(() => { window.scrollTo(0, scrollY) })
    setTimeout(() => { window.scrollTo(0, scrollY) }, 0)
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
                    getPrecioBultoConOferta={getPrecioBultoConOferta}
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
              getPrecioBultoConOferta={getPrecioBultoConOferta}
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
                  const unidPorBulto = i.unidadesPorBulto ?? 1
                  const precioPorBulto = i.precioPorBulto ?? (i.precioUnitario ?? 0) * unidPorBulto
                  const precioBultoFinal = getPrecioBultoConOferta(i, precioPorBulto)
                  const tieneOferta = !!ofertaByProductId[i.id]
                  const totalLinea = precioBultoFinal * i.qty
                  return (
                    <li key={i.id} className="carrito-sidebar-item">
                      <span className="carrito-sidebar-nombre">{i.descripcion ?? i.nombre}</span>
                      <div className="carrito-sidebar-row">
                        <span className="carrito-sidebar-detalle">
                          {tieneOferta && <span className="product-price-base-tachado">${formatMoneda(precioPorBulto * i.qty)}</span>}
                          {i.qty} bulto{i.qty !== 1 ? 's' : ''} · $/u ${formatMoneda(precioBultoFinal / unidPorBulto)} (sin IVA) · ${formatMoneda(totalLinea)}
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
              <Link to="/checkout" className="btn btn-primary btn-block">Ir al carrito</Link>
            </>
          )}
        </div>
      </aside>
      {carrito.length > 0 && (
        <div className="carrito-fab-mobile">
          <div className="carrito-fab-info">
            <span>{carrito.length} {carrito.length === 1 ? 'producto' : 'productos'}</span>
            <span className="carrito-fab-total">Total: ${formatMoneda(subtotalCarrito)}</span>
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
