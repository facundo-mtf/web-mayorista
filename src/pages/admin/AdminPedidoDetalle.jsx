import { useParams, useNavigate } from 'react-router-dom'
import { doc, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore'
import { useState, useEffect } from 'react'
import { db } from '../../firebase/config'
import { exportarPedidoPDF, exportarPedidoExcel } from '../../utils/exportarPedido'
import { notificarUsuario } from '../../utils/notificaciones'
import { formatMoneda } from '../../utils/formatoNumero'

const ESTADOS = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'enviado', label: 'Enviado' },
  { value: 'entregado', label: 'Entregado' },
  { value: 'cancelado', label: 'Cancelado' },
]

export default function AdminPedidoDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [pedido, setPedido] = useState(null)
  const [modoEditar, setModoEditar] = useState(false)
  const [estadoEdit, setEstadoEdit] = useState('pendiente')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!id) return
    const unsub = onSnapshot(doc(db, 'pedidos', id), (snap) => {
      setPedido(snap.exists() ? { id: snap.id, ...snap.data() } : null)
    })
    return () => unsub()
  }, [id])

  const formatDate = (d) => {
    if (!d) return '-'
    const date = d?.toDate ? d.toDate() : new Date(d)
    return date.toLocaleString('es-AR')
  }

  const formatRazonSocialLine = (r) => {
    if (!r) return 'Sin razón social'
    const parts = [r.razonSocial]
    if (r.cuit) parts.push(`CUIT: ${r.cuit}`)
    if (r.condicionFiscal) parts.push(r.condicionFiscal)
    const d = r.direccionFacturacion
    if (d && (d.calle || d.localidad)) {
      const dirParts = [d.calle, d.numero, d.localidad, d.provincia, d.codigoPostal].filter(Boolean)
      if (dirParts.length) parts.push(dirParts.join(', '))
    }
    return parts.join(' — ')
  }

  const handleGuardarEstado = async () => {
    if (!id || !pedido) return
    setGuardando(true)
    try {
      await updateDoc(doc(db, 'pedidos', id), { estado: estadoEdit })
      setModoEditar(false)
      const estadoLabel = ESTADOS.find(e => e.value === estadoEdit)?.label || estadoEdit
      if (pedido.userId) {
        notificarUsuario(pedido.userId, 'Estado de tu pedido', `Tu pedido #${pedido.numeroPedido ?? id.slice(-6)} está ahora: ${estadoLabel}.`).catch(() => {})
      }
    } finally {
      setGuardando(false)
    }
  }

  if (!pedido) {
    return (
      <div className="container page">
        <p className="empty-state">Cargando pedido...</p>
      </div>
    )
  }

  return (
    <div className="container page">
      <button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin/pedidos')} style={{ marginBottom: '1rem' }}>
        ← Volver al listado
      </button>

      <h1 className="page-title">Pedido #{pedido.numeroPedido ?? pedido.id.slice(-6)}</h1>
      <p className="page-subtitle">{formatDate(pedido.createdAt)}</p>

      <div className="pedido-detalle-resumen">
        <p><strong>Razón social:</strong> {formatRazonSocialLine(pedido.razonSocial)}</p>
        <p><strong>Sucursal:</strong> {pedido.sucursal ? (pedido.sucursal.calle ? [pedido.sucursal.calle, pedido.sucursal.numero, pedido.sucursal.localidad, pedido.sucursal.provincia, pedido.sucursal.codigoPostal].filter(Boolean).join(', ') : `${pedido.sucursal.direccion || ''}, ${pedido.sucursal.localidad || ''}`.trim()) : 'A coordinar'}</p>
        <p><strong>Forma de pago:</strong> {pedido.formaPago || '-'}</p>
        <p><strong>Estado:</strong>
          {modoEditar ? (
            <span style={{ marginLeft: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <select value={estadoEdit} onChange={(e) => setEstadoEdit(e.target.value)}>
                {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
              <button type="button" className="btn btn-primary btn-sm" onClick={handleGuardarEstado} disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModoEditar(false)}>Cancelar</button>
            </span>
          ) : (
            <span style={{ marginLeft: '0.5rem' }}>
              {ESTADOS.find(e => e.value === (pedido.estado || 'pendiente'))?.label || pedido.estado || 'Pendiente'}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setEstadoEdit(pedido.estado || 'pendiente'); setModoEditar(true); }} style={{ marginLeft: '0.5rem' }}>Editar</button>
            </span>
          )}
        </p>
        {(pedido.contacto || pedido.contactoCompra) && (
          <p><strong>Contacto compra:</strong> {pedido.contactoCompra ? `${pedido.contactoCompra.nombre} ${pedido.contactoCompra.apellido} — ${pedido.contactoCompra.telefono} — ${pedido.contactoCompra.email}` : `${pedido.contacto?.nombre} ${pedido.contacto?.apellido} — ${pedido.contacto?.telefono} — ${pedido.contacto?.email}`}</p>
        )}
        {pedido.observaciones && (
          <p><strong>Observaciones / Comentarios:</strong> {pedido.observaciones}</p>
        )}
        {pedido.contactoPago && pedido.contactoCompra && (pedido.contactoPago.nombre !== pedido.contactoCompra.nombre || pedido.contactoPago.email !== pedido.contactoCompra.email) && (
          <p><strong>Contacto pago:</strong> {pedido.contactoPago.nombre} {pedido.contactoPago.apellido} — {pedido.contactoPago.telefono} — {pedido.contactoPago.email}</p>
        )}
        <div className="pedido-detalle-totales totales-block">
          <div className="totales-fila"><span className="totales-label">Subtotal</span><span className="totales-valor">${formatMoneda(pedido.subtotal ?? 0)}</span></div>
          {((pedido.descuentoBase ?? 0) > 0 || pedido.aplicaProntoPago) && (
            <div className="totales-fila">
              <span className="totales-label">Desc. {(pedido.descuentoBase ?? 0) > 0 && pedido.aplicaProntoPago ? `${pedido.descuentoBase} + 10 %` : (pedido.descuentoBase ?? 0) > 0 ? `${pedido.descuentoBase} %` : '10 %'}</span>
              <span className="totales-valor">
                ${formatMoneda((pedido.subtotal ?? 0) - (pedido.subtotal ?? 0) * (1 - (pedido.descuentoBase ?? 0) / 100) + (pedido.aplicaProntoPago ? (pedido.subtotal ?? 0) * (1 - (pedido.descuentoBase ?? 0) / 100) * 0.1 : 0))}
              </span>
            </div>
          )}
          <div className="totales-sep" />
          <div className="totales-fila"><span className="totales-label">Subtotal</span><span className="totales-valor">${formatMoneda(pedido.condicionFiscal === 'A' ? (pedido.total ?? 0) / 1.21 : (pedido.total ?? 0))}</span></div>
          {pedido.condicionFiscal === 'A' && <div className="totales-fila"><span className="totales-label">I.V.A. 21,00 %</span><span className="totales-valor">${formatMoneda((pedido.total ?? 0) - (pedido.total ?? 0) / 1.21)}</span></div>}
          <div className="totales-sep" />
          <div className="totales-fila totales-total"><span className="totales-label">TOTAL</span><span className="totales-valor">${formatMoneda(pedido.total ?? 0)}</span></div>
        </div>
      </div>

      <div className="pedido-detalle-items">
        <h3>Productos encargados</h3>
        <div className="table-wrap">
        <table className="pedido-items-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Descripción</th>
              <th>Bultos</th>
              <th>Precio unit.</th>
              <th>Precio bulto</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {pedido.items?.map((item, i) => {
              const precioUnit = item.precioUnitario ?? (item.precioPorBulto ?? 0) / (item.unidadesPorBulto ?? 1)
              const precioBulto = item.precioPorBulto ?? precioUnit * (item.unidadesPorBulto ?? 1)
              return (
                <tr key={i}>
                  <td className="sku-cell"><strong>{item.sku || '-'}</strong></td>
                  <td>{item.descripcion}</td>
                  <td>{item.bultos}</td>
                  <td>${formatMoneda(precioUnit)}</td>
                  <td>${formatMoneda(precioBulto)}</td>
                  <td>${formatMoneda((item.bultos || 0) * precioBulto)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>

      <div className="pedido-detalle-acciones">
        <div className="pedido-detalle-exportar">
        <button type="button" className="btn btn-primary" onClick={() => exportarPedidoPDF(pedido)}>
          Exportar PDF
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => exportarPedidoExcel(pedido)}>
          Exportar Excel
        </button>
        {pedido.comprobanteUrl && (
          <a href={pedido.comprobanteUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
            Ver comprobante
          </a>
        )}
        </div>
        <div className="pedido-detalle-admin">
          <button type="button" className="btn btn-danger-outline" onClick={async () => { if (confirm('¿Eliminar este pedido?')) { await deleteDoc(doc(db, 'pedidos', pedido.id)); navigate('/admin/pedidos'); } }}>
            Eliminar pedido
          </button>
        </div>
      </div>
    </div>
  )
}
