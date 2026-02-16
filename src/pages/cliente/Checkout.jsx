import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { collection, query, where, addDoc, onSnapshot, doc, runTransaction } from 'firebase/firestore'
import { exportarPedidoPDF } from '../../utils/exportarPedido'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'

const CONDICIONES = [
  { value: 'A', label: 'Factura A' },
  { value: 'A_12', label: 'Factura A 1/2' },
  { value: 'R', label: 'Factura R' },
]

const FORMAS_PAGO = [
  { value: 'transferencia', label: 'Transferencia', aplicaProntoPago: true },
  { value: 'mercadopago', label: 'Mercado Pago', aplicaProntoPago: true },
  { value: 'acuerdo', label: 'Acuerdo con Vendedor', aplicaProntoPago: false },
]

const DATOS_BANCARIOS = {
  titular: 'Distribuidora MTF S.A.',
  cbu: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXX',
  alias: 'alias.ejemplo.cbu',
  banco: 'Banco Ejemplo',
}

export default function Checkout() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [razonesSociales, setRazonesSociales] = useState([])
  const [sucursales, setSucursales] = useState([])
  const [sucursalesSinRazon, setSucursalesSinRazon] = useState([])
  const [expresos, setExpresos] = useState([])
  const [vendedores, setVendedores] = useState([])
  const [carrito, setCarrito] = useState(() => JSON.parse(localStorage.getItem('carrito') || '[]'))

  const [selector1, setSelector1] = useState('')  // Razón Social
  const [selector2, setSelector2] = useState('')  // Sucursal
  const [selector3, setSelector3] = useState('')  // Condición (A, A 1/2, R)
  const [selector4, setSelector4] = useState('')  // Expreso
  const [selector5, setSelector5] = useState('')  // Forma de pago

  const [comprobanteFile, setComprobanteFile] = useState(null)
  const [comprobanteError, setComprobanteError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [errores, setErrores] = useState([])
  const [pedidoEnviado, setPedidoEnviado] = useState(false)
  const [pedidoEnviadoData, setPedidoEnviadoData] = useState(null)
  const [contactoValido, setContactoValido] = useState(false)
  const [vendedorPedidoId, setVendedorPedidoId] = useState('')

  const descuentoBase = profile?.descuentoBase ?? 0
  const formaPago = FORMAS_PAGO.find(f => f.value === selector5)
  const aplicaProntoPago = formaPago?.aplicaProntoPago ?? false

  const SIN_RAZON = 'sin_razon_social'
  const SIN_SUCURSAL = 'sin_sucursal'
  const LOGISTICA_SIN_EXPRESO_CABA = 'entrega_sin_expreso_caba'
  const LOGISTICA_SIN_EXPRESO_GBA = 'entrega_sin_expreso_gba'
  const razonSeleccionada = selector1 === SIN_RAZON ? null : razonesSociales.find(r => r.id === selector1)
  const requiereCUIT = (selector3 === 'A' || selector3 === 'A_12') && !razonSeleccionada?.cuit
  const logisticaSinExpreso = selector4 === LOGISTICA_SIN_EXPRESO_CABA || selector4 === LOGISTICA_SIN_EXPRESO_GBA

  useEffect(() => {
    if (!user) return
    const unsub = onSnapshot(query(collection(db, 'razonesSociales'), where('userId', '==', user.uid)), (snap) => {
      setRazonesSociales(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [user])

  useEffect(() => {
    if (!selector1) { setSucursales([]); setSelector2(''); return }
    if (selector1 === SIN_RAZON) {
      setSucursales([])
      setSelector2('')
      return
    }
    const unsub = onSnapshot(
      query(collection(db, 'sucursales'), where('razonSocialId', '==', selector1)),
      (snap) => setSucursales(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    setSelector2('')
    return () => unsub()
  }, [selector1])

  useEffect(() => {
    if (!user || selector1 !== SIN_RAZON) return
    const unsub = onSnapshot(
      query(
        collection(db, 'sucursales'),
        where('userId', '==', user.uid),
        where('razonSocialId', '==', null)
      ),
      (snap) => setSucursalesSinRazon(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    return () => unsub()
  }, [user?.uid, selector1])

  useEffect(() => {
    if (!user) return
    const unsub = onSnapshot(query(collection(db, 'expresos'), where('userId', '==', user.uid)), (snap) => {
      setExpresos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [user])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'vendedores'), (snap) => {
      setVendedores(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    localStorage.setItem('carrito', JSON.stringify(carrito))
  }, [carrito])

  const actualizarCantidad = (productoId, nuevaCantidad) => {
    const qty = Math.max(1, Math.floor(Number(nuevaCantidad)) || 1)
    setCarrito(carrito.map(i => i.id === productoId ? { ...i, qty } : i))
  }

  const eliminarDelCarrito = (productoId) => {
    setCarrito(carrito.filter(i => i.id !== productoId))
  }

  const subtotal = carrito.reduce((s, i) => {
    const precioPorBulto = i.precioPorBulto ?? (i.precioUnitario ?? 0) * (i.unidadesPorBulto ?? 1)
    return s + precioPorBulto * i.qty
  }, 0)
  const conDescuentoBase = subtotal * (1 - descuentoBase / 100)
  const conProntoPago = aplicaProntoPago ? conDescuentoBase * 0.9 : conDescuentoBase

  const sucursalesDisponibles = selector1 === SIN_RAZON ? sucursalesSinRazon : sucursales
  const datosContacto = {
    nombre: profile?.nombreContacto || '',
    apellido: profile?.apellidoContacto || '',
    telefono: profile?.telefonoContacto || '',
    email: profile?.emailContacto || user?.email || '',
  }
  const tieneContacto = !!(datosContacto.nombre && datosContacto.apellido && datosContacto.telefono && datosContacto.email)
  const puedeFinalizar =
    selector1 && selector2 && selector3 && selector4 && selector5 &&
    !requiereCUIT &&
    tieneContacto &&
    contactoValido &&
    (selector5 === 'acuerdo' || (selector5 !== 'acuerdo' && comprobanteFile)) &&
    carrito.length > 0

  const handleFileChange = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    const valid = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(f.type)
    if (!valid) {
      setComprobanteError('Subí una imagen (JPG, PNG, WEBP) o PDF')
      return
    }
    setComprobanteFile(f)
    setComprobanteError('')
  }

  const getErrores = () => {
    const errs = []
    if (!selector1) errs.push('Seleccioná una razón social o "Sin razón social".')
    if (!selector2) errs.push('Seleccioná una sucursal.')
    if (!selector3) errs.push('Seleccioná la condición de compra (Factura A, A 1/2 o R).')
    if (!selector4) errs.push('Seleccioná la logística.')
    if (!selector5) errs.push('Seleccioná la forma de pago.')
    if (!tieneContacto) errs.push('Completá tus datos de contacto en la sección Datos (nombre, apellido, teléfono, email).')
    if (tieneContacto && !contactoValido) errs.push('Confirmá que tus datos de contacto son correctos.')
    if (requiereCUIT) errs.push('Para Factura A o A 1/2 necesitás una razón social con CUIT.')
    if (selector5 && formaPago?.aplicaProntoPago && !comprobanteFile) errs.push('Subí el comprobante de pago.')
    if (carrito.length === 0) errs.push('Tu carrito está vacío.')
    return errs
  }

  const handleFinalizar = async () => {
    const errs = getErrores()
    if (errs.length > 0) {
      setErrores(errs)
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50)
      return
    }
    setErrores([])
    if (!user) return
    setEnviando(true)
    try {
      let comprobanteUrl = null
      if (comprobanteFile) {
        const path = `comprobantes/${user.uid}/${Date.now()}_${comprobanteFile.name}`
        const refStorage = ref(storage, path)
        await uploadBytes(refStorage, comprobanteFile)
        comprobanteUrl = await getDownloadURL(refStorage)
      }

      const sucursal = selector2 === SIN_SUCURSAL ? null : sucursalesDisponibles.find(s => s.id === selector2)
      const expreso = logisticaSinExpreso ? null : expresos.find(e => e.id === selector4)
      const logistica = logisticaSinExpreso ? selector4 : null

      let numeroPedido
      try {
        await runTransaction(db, async (tx) => {
          const counterRef = doc(db, 'counters', 'pedidos')
          const counterSnap = await tx.get(counterRef)
          const current = counterSnap.exists() ? (counterSnap.data().count ?? 0) : 0
          numeroPedido = current + 1
          tx.set(counterRef, { count: numeroPedido }, { merge: true })
        })
      } catch (counterErr) {
        if (counterErr?.code === 'permission-denied' || counterErr?.message?.includes('permission')) {
          numeroPedido = Math.floor(Date.now() / 1000)
          console.warn('Para IDs consecutivos, ejecutá: firebase deploy --only firestore:rules')
        } else {
          throw counterErr
        }
      }

      const pedidoPayload = {
        numeroPedido,
        userId: user.uid,
        vendedorId: vendedorPedidoId || profile?.vendedorId || null,
        pedidoEsVendedor: !!vendedorPedidoId,
        razonSocial: razonSeleccionada,
        sucursal,
        expreso,
        logistica,
        condicionFiscal: selector3,
        formaPago: selector5,
        items: carrito.map(i => ({
          id: i.id,
          descripcion: i.descripcion ?? i.nombre,
          sku: i.sku ?? i.codigo,
          dimensiones: i.dimensiones,
          presentacion: i.presentacion,
          bultos: i.qty,
          unidadesPorBulto: i.unidadesPorBulto ?? 1,
          precioUnitario: i.precioUnitario,
          precioPorBulto: i.precioPorBulto ?? (i.precioUnitario ?? 0) * (i.unidadesPorBulto ?? 1),
        })),
        subtotal,
        descuentoBase,
        aplicaProntoPago,
        total: conProntoPago,
        comprobanteUrl,
        contacto: datosContacto,
        createdAt: new Date(),
        estado: 'pendiente',
      }
      await addDoc(collection(db, 'pedidos'), pedidoPayload)

      setPedidoEnviadoData({ ...pedidoPayload, id: null })
      setCarrito([])
      localStorage.setItem('carrito', '[]')
      setSelector1(''); setSelector2(''); setSelector3(''); setSelector4(''); setSelector5('')
      setComprobanteFile(null)
      setVendedorPedidoId('')
      setPedidoEnviado(true)
    } catch (err) {
      alert('Error al enviar el pedido: ' + err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="container page">
      <h1 className="page-title">Checkout</h1>
      <p className="page-subtitle">Completá los 5 selectores para finalizar tu pedido.</p>

      {pedidoEnviado ? (
        <div className="checkout-exito" role="alert">
          <p className="exito-titulo">Se envió correctamente</p>
          <p className="exito-mensaje">Recibirás una respuesta a la brevedad.</p>
          <div className="checkout-exito-acciones">
            {pedidoEnviadoData && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => exportarPedidoPDF(pedidoEnviadoData)}
              >
                Descargar PDF del pedido
              </button>
            )}
            <button className="btn btn-primary" onClick={() => navigate('/catalogo')}>Seguir comprando</button>
          </div>
        </div>
      ) : carrito.length === 0 ? (
        <p className="empty-state">Tu carrito está vacío. Agregá productos desde el catálogo.</p>
      ) : (
        <>
          <div className="checkout-carrito-resumen">
            <h3>Tu pedido</h3>
            <ul className="carrito-items-editable">
              {carrito.map(i => {
                const precioPorBulto = i.precioPorBulto ?? (i.precioUnitario ?? 0) * (i.unidadesPorBulto ?? 1)
                return (
                  <li key={i.id} className="carrito-item">
                    <div className="carrito-item-info">
                      <span className="carrito-item-nombre">{i.descripcion ?? i.nombre}</span>
                      <span className="carrito-item-detalle">
                        {(() => {
                          const totalUnid = i.qty * (i.unidadesPorBulto ?? 1)
                          return `${totalUnid} ${totalUnid === 1 ? 'unidad' : 'unid.'}`
                        })()} · ${(precioPorBulto * i.qty).toLocaleString('es-AR')}
                      </span>
                    </div>
                    <div className="carrito-item-acciones">
                      <input
                        type="number"
                        min="1"
                        value={i.qty}
                        onChange={(e) => actualizarCantidad(i.id, e.target.value)}
                        className="carrito-qty-input"
                      />
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => eliminarDelCarrito(i.id)} title="Eliminar">
                        Eliminar
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
          {errores.length > 0 && (
            <div className="checkout-alerta-errores" role="alert">
              <div className="checkout-alerta-inner container">
                <span className="checkout-alerta-icono" aria-hidden>⚠</span>
                <div className="checkout-alerta-texto">
                  <strong>Hay errores que corregir antes de finalizar</strong>
                  <ul>
                    {errores.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
                <button type="button" className="checkout-alerta-cerrar" onClick={() => setErrores([])} aria-label="Cerrar">×</button>
              </div>
            </div>
          )}

          <div className="checkout-selectores">
            <div className="selector-block">
              <label>1. Razón Social (quién compra)</label>
              <select value={selector1} onChange={(e) => { setSelector1(e.target.value); setErrores([]); }}>
                <option value="">Seleccionar...</option>
                <option value={SIN_RAZON}>Sin razón social</option>
                {razonesSociales.map(r => (
                  <option key={r.id} value={r.id}>{r.razonSocial} {r.cuit ? `— CUIT: ${r.cuit}` : '(sin CUIT)'}</option>
                ))}
              </select>
            </div>

            <div className="selector-block">
              <label>2. Sucursal (dirección de entrega)</label>
              <select value={selector2} onChange={(e) => { setSelector2(e.target.value); setErrores([]); }} disabled={!selector1}>
                <option value="">Seleccionar...</option>
                <option value={SIN_SUCURSAL}>Sin sucursal</option>
                {sucursalesDisponibles.map(s => (
                  <option key={s.id} value={s.id}>{s.direccion}, {s.localidad}</option>
                ))}
              </select>
            </div>

            <div className="selector-block">
              <label>3. Condición de compra</label>
              <select
                value={selector3}
                onChange={(e) => { setSelector3(e.target.value); setErrores([]); }}
              >
                <option value="">Seleccionar...</option>
                {(selector1 === SIN_RAZON ? CONDICIONES.filter(c => c.value === 'R') : CONDICIONES).map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              {selector1 === SIN_RAZON && <p className="hint">Sin razón social solo permite Factura R.</p>}
              {requiereCUIT && (
                <p className="hint error">Para Factura A o A 1/2, la razón social debe tener CUIT.</p>
              )}
            </div>

            <div className="selector-block">
              <label>4. Logística</label>
              <select value={selector4} onChange={(e) => { setSelector4(e.target.value); setErrores([]); }}>
                <option value="">Seleccionar...</option>
                <option value={LOGISTICA_SIN_EXPRESO_CABA}>Entrega sin expreso - CABA</option>
                <option value={LOGISTICA_SIN_EXPRESO_GBA}>Entrega sin expreso - GBA</option>
                {expresos.map(e => (
                  <option key={e.id} value={e.id}>{e.nombre} — {e.direccionCABA}</option>
                ))}
              </select>
            </div>

            <div className="selector-block">
              <label>5. Forma de pago</label>
              <select value={selector5} onChange={(e) => { setSelector5(e.target.value); setComprobanteFile(null); setComprobanteError(''); setErrores([]); }}>
                <option value="">Seleccionar...</option>
                {FORMAS_PAGO.map(f => (
                  <option key={f.value} value={f.value}>{f.label}{f.aplicaProntoPago ? ' (-10% pronto pago)' : ''}</option>
                ))}
              </select>

            {selector5 && formaPago?.aplicaProntoPago && (
                <div className="comprobante-block">
                  <p className="datos-bancarios">
                    <strong>Datos para transferencia:</strong><br />
                    {DATOS_BANCARIOS.titular}<br />
                    CBU: {DATOS_BANCARIOS.cbu}<br />
                    Alias: {DATOS_BANCARIOS.alias}<br />
                    {DATOS_BANCARIOS.banco}
                  </p>
                  <label>Subí el comprobante (imagen o PDF) *</label>
                  <input type="file" accept="image/*,.pdf" onChange={handleFileChange} />
                  {comprobanteError && <p className="hint error">{comprobanteError}</p>}
                  {comprobanteFile && <p className="hint success">Archivo: {comprobanteFile.name}</p>}
                </div>
              )}
            </div>

            <div className="selector-block datos-contacto-block">
              <label>¿Son correctos estos datos de contacto?</label>
              <div className="datos-contacto-resumen">
                <p><strong>Nombre:</strong> {datosContacto.nombre} {datosContacto.apellido}</p>
                <p><strong>Teléfono:</strong> {datosContacto.telefono}</p>
                <p><strong>Email:</strong> {datosContacto.email}</p>
              </div>
              {!tieneContacto && (
                <p className="hint error">Completá tus datos de contacto en la sección <Link to="/datos">Datos</Link> para continuar.</p>
              )}
              {tieneContacto && (
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={contactoValido}
                    onChange={(e) => { setContactoValido(e.target.checked); setErrores([]); }}
                  />
                  Sí, son correctos
                </label>
              )}
            </div>

            <div className="selector-block">
              <label>Vendedor</label>
              <select
                value={vendedorPedidoId}
                onChange={(e) => { setVendedorPedidoId(e.target.value); setErrores([]); }}
              >
                <option value="">Sin ningún vendedor</option>
                {vendedores.map(v => (
                  <option key={v.id} value={v.id}>{v.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="checkout-totales">
            <p>Subtotal (lista): ${subtotal.toLocaleString('es-AR')}</p>
            <p>Con descuento base ({descuentoBase}%): ${conDescuentoBase.toLocaleString('es-AR')}</p>
            {aplicaProntoPago && <p>Con pronto pago (-10%): ${conProntoPago.toLocaleString('es-AR')}</p>}
            <p className="total"><strong>Total: ${conProntoPago.toLocaleString('es-AR')}</strong></p>
          </div>

          <div className="checkout-acciones">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => { setCarrito([]); navigate('/catalogo'); }}
            >
              Cancelar
            </button>
            <button
              className="btn btn-primary btn-lg"
              onClick={handleFinalizar}
              disabled={enviando}
            >
              {enviando ? 'Enviando...' : 'Finalizar pedido'}
            </button>
          </div>

        </>
      )}
    </div>
  )
}
