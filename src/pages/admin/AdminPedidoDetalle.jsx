import { useParams, useNavigate } from 'react-router-dom'
import { doc, onSnapshot } from 'firebase/firestore'
import { useState, useEffect } from 'react'
import { db } from '../../firebase/config'
import { exportarPedidoPDF, exportarPedidoExcel } from '../../utils/exportarPedido'

export default function AdminPedidoDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [pedido, setPedido] = useState(null)

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
      <p className="page-subtitle">{formatDate(pedido.createdAt)} — {pedido.estado || 'pendiente'}</p>

      <div className="pedido-detalle-resumen">
        <p><strong>Razón social:</strong> {pedido.razonSocial?.razonSocial || 'Sin razón social'}</p>
        <p><strong>Sucursal:</strong> {pedido.sucursal ? `${pedido.sucursal.direccion}, ${pedido.sucursal.localidad}` : 'Sin sucursal'}</p>
        <p><strong>Forma de pago:</strong> {pedido.formaPago}</p>
        {pedido.contacto && (
          <p><strong>Contacto:</strong> {pedido.contacto.nombre} {pedido.contacto.apellido} — {pedido.contacto.telefono} — {pedido.contacto.email}</p>
        )}
        <p><strong>Total:</strong> ${(pedido.total || 0).toLocaleString('es-AR')}</p>
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
              <th>Precio por bulto</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {pedido.items?.map((item, i) => (
              <tr key={i}>
                <td className="sku-cell"><strong>{item.sku || '-'}</strong></td>
                <td>{item.descripcion}</td>
                <td>{item.bultos}</td>
                <td>${(item.precioPorBulto || 0).toLocaleString('es-AR')}</td>
                <td>${((item.bultos || 0) * (item.precioPorBulto || 0)).toLocaleString('es-AR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

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
    </div>
  )
}
