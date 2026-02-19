import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { collection, query, where, addDoc, onSnapshot, doc, runTransaction, updateDoc } from 'firebase/firestore'
import { exportarPedidoPDF } from '../../utils/exportarPedido'
import { formatMoneda } from '../../utils/formatoNumero'
import { db } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'
import { useCarrito } from '../../context/CarritoContext'

const CONDICIONES = [
  { value: 'A', label: 'Factura A' },
  { value: 'nota_pedido', label: 'Nota de pedido' },
]

const A_COORDINAR = 'a_coordinar'

function formatDirFact(r) {
  if (!r?.direccionFacturacion) return ''
  const d = r.direccionFacturacion
  const parts = [d.calle, d.numero, d.localidad, d.provincia, d.codigoPostal].filter(Boolean)
  return parts.join(', ')
}

function formatSucursal(s) {
  const parts = [s.calle, s.numero, s.localidad, s.provincia, s.codigoPostal].filter(Boolean)
  if (parts.length) return parts.join(', ')
  return s.direccion ? `${s.direccion}, ${s.localidad || ''}`.trim() : '-'
}

export default function Checkout() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [razonesSociales, setRazonesSociales] = useState([])
  const [sucursales, setSucursales] = useState([])
  const [sucursalesSinRazon, setSucursalesSinRazon] = useState([])
  const [expresos, setExpresos] = useState([])
  const [vendedores, setVendedores] = useState([])
  const { carrito, setCarrito } = useCarrito()

  const [selector1, setSelector1] = useState('')  // Razón Social
  const [selector2, setSelector2] = useState('')  // Sucursal de entrega
  const [selector3, setSelector3] = useState('')  // Condición (A, nota_pedido)
  const [selector4, setSelector4] = useState('')  // Logística
  const [enviando, setEnviando] = useState(false)
  const [errores, setErrores] = useState([])
  const [pedidoEnviado, setPedidoEnviado] = useState(false)
  const [pedidoEnviadoData, setPedidoEnviadoData] = useState(null)
  const [contactoValido, setContactoValido] = useState(false)
  const [vendedorPedidoId, setVendedorPedidoId] = useState('')
  const [editandoContacto, setEditandoContacto] = useState(false)
  const [guardandoContacto, setGuardandoContacto] = useState(false)
  const [formCompra, setFormCompra] = useState({ nombre: '', apellido: '', telefono: '', email: '' })
  const [formPago, setFormPago] = useState({ nombre: '', apellido: '', telefono: '', email: '' })
  const [mismoCompraQuePaga, setMismoCompraQuePaga] = useState(true)
  const [observaciones, setObservaciones] = useState('')
  const [ofertas, setOfertas] = useState([])

  const descuentoBase = profile?.descuentoBase ?? 0
  const ofertaByProductId = Object.fromEntries((ofertas || []).map(o => [o.productId, o]))
  const getPrecioBultoConOferta = (item, precioPorBulto) => {
    const oferta = ofertaByProductId[item.id]
    if (!oferta?.descuentoPct) return precioPorBulto
    return precioPorBulto * (1 - (oferta.descuentoPct ?? 0) / 100)
  }
  const aplicaProntoPago = false

  const SIN_RAZON = 'sin_razon_social'
  const razonSeleccionada = selector1 === SIN_RAZON ? null : razonesSociales.find(r => r.id === selector1)
  const requiereCUIT = selector3 === 'A' && !razonSeleccionada?.cuit

  const sucursalesDisponibles = [...sucursalesSinRazon, ...sucursales]
  const sucursalSeleccionada = selector2 && selector2 !== A_COORDINAR
    ? sucursalesDisponibles.find(s => s.id === selector2)
    : null
  const expresoSeleccionado = selector4 && selector4 !== A_COORDINAR
    ? expresos.find(e => e.id === selector4)
    : null

  useEffect(() => {
    if (!user) return
    const unsub = onSnapshot(query(collection(db, 'razonesSociales'), where('userId', '==', user.uid)), (snap) => {
      setRazonesSociales(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [user])

  const razonIds = razonesSociales.map(r => r.id)
  useEffect(() => {
    if (!razonIds.length) { setSucursales([]); return }
    const q = query(
      collection(db, 'sucursales'),
      where('razonSocialId', 'in', razonIds.slice(0, 30))
    )
    const unsub = onSnapshot(q, (snap) => {
      setSucursales(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [razonIds.join(',')])

  useEffect(() => {
    if (!user) return
    const q = query(
      collection(db, 'sucursales'),
      where('userId', '==', user.uid),
      where('razonSocialId', '==', null)
    )
    const unsub = onSnapshot(q, (snap) => {
      setSucursalesSinRazon(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [user?.uid])

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
    const unsub = onSnapshot(collection(db, 'ofertas'), (snap) => {
      setOfertas(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    if (selector1 === SIN_RAZON) setSelector3('nota_pedido')
  }, [selector1])

  useEffect(() => {
    if (profile || user) {
      const compra = {
        nombre: profile?.nombreCompra ?? profile?.nombreContacto ?? '',
        apellido: profile?.apellidoCompra ?? profile?.apellidoContacto ?? '',
        telefono: profile?.telefonoCompra ?? profile?.telefonoContacto ?? '',
        email: profile?.emailCompra ?? profile?.emailContacto ?? user?.email ?? '',
      }
      const pago = {
        nombre: profile?.nombrePago ?? profile?.nombreContacto ?? '',
        apellido: profile?.apellidoPago ?? profile?.apellidoContacto ?? '',
        telefono: profile?.telefonoPago ?? profile?.telefonoContacto ?? '',
        email: profile?.emailPago ?? profile?.emailContacto ?? user?.email ?? '',
      }
      setFormCompra(compra)
      setFormPago(pago)
      setMismoCompraQuePaga(profile?.mismoCompraQuePaga !== false)
    }
  }, [profile, user?.email])

  const actualizarCantidad = (productoId, nuevaCantidad) => {
    const qty = Math.max(1, Math.floor(Number(nuevaCantidad)) || 1)
    setCarrito(carrito.map(i => i.id === productoId ? { ...i, qty } : i))
  }

  const eliminarDelCarrito = (productoId) => {
    setCarrito(carrito.filter(i => i.id !== productoId))
  }

  const abrirEditarContacto = () => {
    setFormCompra({
      nombre: profile?.nombreCompra ?? profile?.nombreContacto ?? '',
      apellido: profile?.apellidoCompra ?? profile?.apellidoContacto ?? '',
      telefono: profile?.telefonoCompra ?? profile?.telefonoContacto ?? '',
      email: profile?.emailCompra ?? profile?.emailContacto ?? user?.email ?? '',
    })
    setFormPago({
      nombre: profile?.nombrePago ?? profile?.nombreContacto ?? '',
      apellido: profile?.apellidoPago ?? profile?.apellidoContacto ?? '',
      telefono: profile?.telefonoPago ?? profile?.telefonoContacto ?? '',
      email: profile?.emailPago ?? profile?.emailContacto ?? user?.email ?? '',
    })
    setMismoCompraQuePaga(profile?.mismoCompraQuePaga !== false)
    setEditandoContacto(true)
  }

  const guardarContacto = async (e) => {
    e?.preventDefault?.()
    if (!user) return
    const pagoEfectivo = mismoCompraQuePaga ? formCompra : formPago
    setGuardandoContacto(true)
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        nombreCompra: formCompra.nombre || null,
        apellidoCompra: formCompra.apellido || null,
        telefonoCompra: formCompra.telefono || null,
        emailCompra: formCompra.email || null,
        nombrePago: pagoEfectivo.nombre || null,
        apellidoPago: pagoEfectivo.apellido || null,
        telefonoPago: pagoEfectivo.telefono || null,
        emailPago: pagoEfectivo.email || null,
        mismoCompraQuePaga,
        nombreContacto: formCompra.nombre || null,
        apellidoContacto: formCompra.apellido || null,
        telefonoContacto: formCompra.telefono || null,
        emailContacto: formCompra.email || null,
      })
      setEditandoContacto(false)
    } finally {
      setGuardandoContacto(false)
    }
  }


  const subtotalAntesDesc = carrito.reduce((s, i) => {
    const precioPorBulto = i.precioPorBulto ?? (i.precioUnitario ?? 0) * (i.unidadesPorBulto ?? 1)
    const precioFinal = getPrecioBultoConOferta(i, precioPorBulto)
    return s + precioFinal * i.qty
  }, 0)
  const montoDescuentoUsuario = subtotalAntesDesc * (descuentoBase / 100)
  const subtotal = subtotalAntesDesc - montoDescuentoUsuario
  const conProntoPago = aplicaProntoPago ? subtotal * 0.9 : subtotal

  const datosContactoCompra = {
    nombre: profile?.nombreCompra ?? profile?.nombreContacto ?? '',
    apellido: profile?.apellidoCompra ?? profile?.apellidoContacto ?? '',
    telefono: profile?.telefonoCompra ?? profile?.telefonoContacto ?? '',
    email: profile?.emailCompra ?? profile?.emailContacto ?? user?.email ?? '',
  }
  const datosContactoPago = {
    nombre: profile?.nombrePago ?? profile?.nombreContacto ?? '',
    apellido: profile?.apellidoPago ?? profile?.apellidoContacto ?? '',
    telefono: profile?.telefonoPago ?? profile?.telefonoContacto ?? '',
    email: profile?.emailPago ?? profile?.emailContacto ?? user?.email ?? '',
  }
  const tieneContacto = !!(
    datosContactoCompra.nombre && datosContactoCompra.apellido && datosContactoCompra.telefono && datosContactoCompra.email &&
    datosContactoPago.nombre && datosContactoPago.apellido && datosContactoPago.telefono && datosContactoPago.email
  )

  const puedeFinalizar =
    selector1 && selector2 && selector3 && selector4 &&
    !requiereCUIT &&
    tieneContacto &&
    contactoValido &&
    carrito.length > 0

  const getErrores = () => {
    const errs = []
    if (!selector1) errs.push('Seleccioná una razón social o "Sin razón social".')
    if (!selector2) errs.push('Seleccioná sucursal de entrega o "A coordinar".')
    if (!selector3) errs.push('Seleccioná la condición de compra (Factura A o Nota de pedido).')
    if (!selector4) errs.push('Seleccioná la logística.')
    if (!tieneContacto) errs.push('Completá datos de quien compra y quien paga en la sección Datos.')
    if (tieneContacto && !contactoValido) errs.push('Confirmá que los datos de contacto son correctos.')
    if (requiereCUIT) errs.push('Para Factura A necesitás una razón social con CUIT.')
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
      const sucursal = sucursalSeleccionada || null
      const expreso = expresoSeleccionado || null
      const logistica = selector4 === A_COORDINAR ? A_COORDINAR : (expreso?.nombre || null)

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
        } else {
          throw counterErr
        }
      }

      const pedidoPayload = {
        numeroPedido,
        userId: user.uid,
        vendedorId: vendedorPedidoId || profile?.vendedorId || null,
        vendedorNombre: vendedorPedidoId ? vendedores.find(v => v.id === vendedorPedidoId)?.nombre : null,
        pedidoEsVendedor: !!vendedorPedidoId,
        razonSocial: razonSeleccionada,
        sucursal,
        expreso,
        logistica,
        condicionFiscal: selector3,
        formaPago: null,
        items: carrito.map(i => {
          const precioPorBulto = i.precioPorBulto ?? (i.precioUnitario ?? 0) * (i.unidadesPorBulto ?? 1)
          const precioBultoEfectivo = getPrecioBultoConOferta(i, precioPorBulto)
          const unid = i.unidadesPorBulto ?? 1
          return {
            id: i.id,
            descripcion: i.descripcion ?? i.nombre,
            sku: i.sku ?? i.codigo,
            dimensiones: i.dimensiones,
            presentacion: i.presentacion,
            bultos: i.qty,
            unidadesPorBulto: unid,
            precioUnitario: precioBultoEfectivo / unid,
            precioPorBulto: precioBultoEfectivo,
          }
        }),
        subtotal,
        descuentoBase,
        aplicaProntoPago,
        total: conProntoPago,
        comprobanteUrl: null,
        contactoCompra: datosContactoCompra,
        contactoPago: datosContactoPago,
        contacto: datosContactoCompra,
        observaciones: observaciones.trim() || null,
        createdAt: new Date(),
        estado: 'pendiente',
      }
      await addDoc(collection(db, 'pedidos'), pedidoPayload)

      setPedidoEnviadoData({ ...pedidoPayload, id: null })
      setCarrito([])
      setSelector1(''); setSelector2(''); setSelector3(''); setSelector4('')
      setVendedorPedidoId('')
      setPedidoEnviado(true)
    } catch (err) {
      alert('Error al enviar el pedido: ' + err.message)
    } finally {
      setEnviando(false)
    }
  }

  const datosFacturacion = selector1 === SIN_RAZON
    ? 'Remito (sin razón social)'
    : razonSeleccionada
      ? [razonSeleccionada.razonSocial, razonSeleccionada.cuit, formatDirFact(razonSeleccionada)].filter(Boolean).join(' — ')
      : null

  return (
    <div className="container page">
      <h1 className="page-title">Checkout</h1>
      <p className="page-subtitle">Completá los datos para finalizar tu pedido.</p>

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
                const unidPorBulto = i.unidadesPorBulto ?? 1
                const precioPorBulto = i.precioPorBulto ?? (i.precioUnitario ?? 0) * unidPorBulto
                const precioBultoFinal = getPrecioBultoConOferta(i, precioPorBulto)
                const tieneOferta = !!ofertaByProductId[i.id]
                const totalLinea = precioBultoFinal * i.qty
                const precioUnitFinal = precioBultoFinal / unidPorBulto
                return (
                  <li key={i.id} className="carrito-item">
                    <div className="carrito-item-info">
                      <span className="carrito-item-nombre">{i.descripcion ?? i.nombre}</span>
                      <span className="carrito-item-detalle">
                        {(() => {
                          const totalUnid = i.qty * unidPorBulto
                          return `${totalUnid} ${totalUnid === 1 ? 'unidad' : 'unid.'}`
                        })()} · $/u ${formatMoneda(precioUnitFinal)} <span className="price-sin-iva">(sin IVA)</span>
                        {tieneOferta && <span className="product-price-base-tachado">${formatMoneda(precioPorBulto * i.qty)}</span>}
                        {' '}· ${formatMoneda(totalLinea)}
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
            <div className="selector-block checkout-datos-facturacion">
              <label>Datos de facturación</label>
              <p className="checkout-facturacion-resumen">{datosFacturacion || 'Seleccioná una razón social'}</p>
            </div>

            <div className="selector-block">
              <label>1. Razón Social</label>
              <select value={selector1} onChange={(e) => { setSelector1(e.target.value); setSelector2(''); setErrores([]); }}>
                <option value="">Seleccionar...</option>
                <option value={SIN_RAZON}>Sin razón social (Remito)</option>
                {razonesSociales.map(r => (
                  <option key={r.id} value={r.id}>{r.razonSocial} {r.cuit ? `— CUIT: ${r.cuit}` : '(sin CUIT)'}</option>
                ))}
              </select>
            </div>

            <div className="selector-block">
              <label>2. Condición de compra</label>
              <select value={selector3} onChange={(e) => { setSelector3(e.target.value); setErrores([]); }}>
                <option value="">Seleccionar...</option>
                {(selector1 === SIN_RAZON ? [{ value: 'nota_pedido', label: 'Nota de pedido' }] : CONDICIONES).map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              {selector1 === SIN_RAZON && <p className="hint">Sin razón social = Nota de pedido.</p>}
              {requiereCUIT && <p className="hint error">Para Factura A necesitás una razón social con CUIT.</p>}
            </div>

            <div className="selector-block">
              <label>3. Sucursal de entrega</label>
              <select value={selector2} onChange={(e) => { setSelector2(e.target.value); setErrores([]); }}>
                <option value="">Seleccionar...</option>
                <option value={A_COORDINAR}>A coordinar</option>
                {sucursalesSinRazon.map(s => (
                  <option key={s.id} value={s.id}>Sin razón — {formatSucursal(s)}</option>
                ))}
                {sucursales.map(s => (
                  <option key={s.id} value={s.id}>{s.razonSocial || 'Sucursal'} — {formatSucursal(s)}</option>
                ))}
              </select>
            </div>

            <div className="selector-block">
              <label>4. Logística</label>
              <select value={selector4} onChange={(e) => { setSelector4(e.target.value); setErrores([]); }}>
                <option value="">Seleccionar...</option>
                <option value={A_COORDINAR}>A coordinar</option>
                {expresos.map(e => (
                  <option key={e.id} value={e.id}>{e.nombre} — {e.direccionCABA}</option>
                ))}
              </select>
            </div>

            <div className="selector-block">
              <label>5. Comentarios u observaciones (opcional)</label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Notas, comentarios o observaciones para el pedido..."
                rows={3}
                className="checkout-observaciones"
              />
            </div>

            <div className="selector-block datos-contacto-block">
              <div className="datos-contacto-header">
                <label>Datos de contacto</label>
                {tieneContacto && !editandoContacto && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={abrirEditarContacto}>
                    Editar
                  </button>
                )}
              </div>
              {editandoContacto ? (
                <form onSubmit={guardarContacto} className="checkout-contacto-edit">
                  <label className="checkbox-label" style={{ marginBottom: '0.75rem' }}>
                    <input type="checkbox" checked={mismoCompraQuePaga} onChange={(e) => setMismoCompraQuePaga(e.target.checked)} />
                    ¿Es la misma persona quien compra y quien paga?
                  </label>
                  <div className="checkout-contacto-grid">
                    <div>
                      <strong>Quien compra</strong>
                      <input placeholder="Nombre" value={formCompra.nombre} onChange={(e) => setFormCompra({ ...formCompra, nombre: e.target.value })} />
                      <input placeholder="Apellido" value={formCompra.apellido} onChange={(e) => setFormCompra({ ...formCompra, apellido: e.target.value })} />
                      <input type="tel" placeholder="Teléfono WhatsApp" value={formCompra.telefono} onChange={(e) => setFormCompra({ ...formCompra, telefono: e.target.value })} />
                      <input type="email" placeholder="Email" value={formCompra.email} onChange={(e) => setFormCompra({ ...formCompra, email: e.target.value })} />
                    </div>
                    <div>
                      <strong>Quien paga</strong>
                      <input placeholder="Nombre" value={mismoCompraQuePaga ? formCompra.nombre : formPago.nombre} onChange={(e) => setFormPago({ ...formPago, nombre: e.target.value })} disabled={mismoCompraQuePaga} />
                      <input placeholder="Apellido" value={mismoCompraQuePaga ? formCompra.apellido : formPago.apellido} onChange={(e) => setFormPago({ ...formPago, apellido: e.target.value })} disabled={mismoCompraQuePaga} />
                      <input type="tel" placeholder="Teléfono WhatsApp" value={mismoCompraQuePaga ? formCompra.telefono : formPago.telefono} onChange={(e) => setFormPago({ ...formPago, telefono: e.target.value })} disabled={mismoCompraQuePaga} />
                      <input type="email" placeholder="Email" value={mismoCompraQuePaga ? formCompra.email : formPago.email} onChange={(e) => setFormPago({ ...formPago, email: e.target.value })} disabled={mismoCompraQuePaga} />
                    </div>
                  </div>
                  <div className="checkout-contacto-acciones">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditandoContacto(false)}>Cancelar</button>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={guardandoContacto}>{guardandoContacto ? 'Guardando...' : 'Guardar'}</button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="datos-contacto-resumen">
                    <p><strong>Quien compra:</strong> {datosContactoCompra.nombre} {datosContactoCompra.apellido} — {datosContactoCompra.telefono} — {datosContactoCompra.email}</p>
                    <p><strong>Quien paga:</strong> {datosContactoPago.nombre} {datosContactoPago.apellido} — {datosContactoPago.telefono} — {datosContactoPago.email}</p>
                  </div>
                  {!tieneContacto && (
                    <p className="hint error">Completá datos de quien compra y quien paga en la sección <Link to="/datos">Datos</Link>.</p>
                  )}
                  {tieneContacto && (
                    <label className="checkbox-label">
                      <input type="checkbox" checked={contactoValido} onChange={(e) => { setContactoValido(e.target.checked); setErrores([]); }} />
                      Confirmo que los datos son correctos
                    </label>
                  )}
                </>
              )}
            </div>

            <div className="selector-block">
              <label>Vendedor</label>
              <select value={vendedorPedidoId} onChange={(e) => { setVendedorPedidoId(e.target.value); setErrores([]); }}>
                <option value="">Sin ningún vendedor</option>
                {vendedores.map(v => (
                  <option key={v.id} value={v.id}>{v.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="checkout-totales totales-block">
            <div className="totales-fila"><span className="totales-label">Subtotal</span><span className="totales-valor">${formatMoneda(subtotalAntesDesc)}</span></div>
            {descuentoBase > 0 && montoDescuentoUsuario > 0 && (
              <div className="totales-fila">
                <span className="totales-label">Descuento ({descuentoBase} %)</span>
                <span className="totales-valor monto-negativo">-${formatMoneda(montoDescuentoUsuario)}</span>
              </div>
            )}
            {aplicaProntoPago && (
              <div className="totales-fila">
                <span className="totales-label">Pronto pago (10 %)</span>
                <span className="totales-valor monto-negativo">-${formatMoneda(subtotal - conProntoPago)}</span>
              </div>
            )}
            <div className="totales-sep" />
            <div className="totales-fila"><span className="totales-label">Subtotal</span><span className="totales-valor">${formatMoneda(selector3 === 'A' ? conProntoPago / 1.21 : conProntoPago)}</span></div>
            {selector3 === 'A' && <div className="totales-fila"><span className="totales-label">I.V.A. 21,00 %</span><span className="totales-valor">${formatMoneda(conProntoPago - conProntoPago / 1.21)}</span></div>}
            <div className="totales-sep" />
            <div className="totales-fila totales-total"><span className="totales-label">TOTAL</span><span className="totales-valor">${formatMoneda(conProntoPago)}</span></div>
          </div>

          <div className="checkout-acciones">
            <button type="button" className="btn btn-ghost" onClick={() => { setCarrito([]); navigate('/catalogo'); }}>
              Cancelar
            </button>
            <button className="btn btn-primary btn-lg" onClick={handleFinalizar} disabled={enviando}>
              {enviando ? 'Enviando...' : 'Finalizar pedido'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
