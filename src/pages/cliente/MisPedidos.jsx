import { useState, useEffect } from 'react'
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'
import { formatMoneda } from '../../utils/formatoNumero'

export default function MisPedidos() {
  const { user } = useAuth()
  const [pedidos, setPedidos] = useState([])

  useEffect(() => {
    if (!user) return
    const q = query(
      collection(db, 'pedidos'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    )
    const unsub = onSnapshot(q, (snap) => {
      setPedidos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [user])

  const formatDate = (d) => {
    if (!d) return '-'
    const date = d?.toDate ? d.toDate() : new Date(d)
    return date.toLocaleString('es-AR')
  }

  const ESTADOS_LABEL = {
    pendiente: 'Pendiente',
    confirmado: 'Confirmado',
    enviado: 'Enviado',
    entregado: 'Entregado',
    cancelado: 'Cancelado',
  }

  return (
    <div className="container page">
      <h1 className="page-title">Mis pedidos</h1>
      <p className="page-subtitle">Historial y detalle de tus pedidos.</p>
      {pedidos.length === 0 ? (
        <p className="empty-state">No tenés pedidos aún.</p>
      ) : (
        <div className="pedidos-list mis-pedidos-list">
          {pedidos.map(p => (
            <div key={p.id} className="pedido-card pedido-card-expandido">
              <div className="pedido-header">
                <span>#{p.numeroPedido ?? p.id.slice(-6)}</span>
                <span>{formatDate(p.createdAt)}</span>
                <span className={`pedido-estado pedido-estado-${(p.estado || 'pendiente').toLowerCase()}`}>
                  {ESTADOS_LABEL[p.estado] || ESTADOS_LABEL.pendiente}
                </span>
              </div>
              <div className="pedido-body">
                <p><strong>Razón social:</strong> {p.razonSocial?.razonSocial || 'Sin razón social'}</p>
                <p><strong>Sucursal:</strong> {p.sucursal ? `${p.sucursal.direccion}, ${p.sucursal.localidad}` : 'Sin sucursal'}</p>
                {p.condicionFiscal && <p><strong>Condición fiscal:</strong> {p.condicionFiscal === 'A' ? 'Factura A' : p.condicionFiscal === 'nota_pedido' ? 'Nota de pedido' : p.condicionFiscal}</p>}
                {(p.vendedorId || p.vendedorNombre) && <p><strong>Vendedor:</strong> {p.vendedorNombre || 'Sí'}</p>}
                <p><strong>Total:</strong> ${formatMoneda(p.total || 0)}</p>
                <div className="pedido-items">
                  <strong>Productos:</strong>
                  <ul>
                    {p.items?.map((item, i) => {
                      const precioUnit = item.precioUnitario ?? (item.precioPorBulto ?? 0) / (item.unidadesPorBulto ?? 1)
                      const precioBulto = item.precioPorBulto ?? precioUnit * (item.unidadesPorBulto ?? 1)
                      return (
                        <li key={i}>
                          {item.descripcion} — {item.bultos} bulto(s) × $/u ${formatMoneda(precioUnit)} = ${formatMoneda((item.bultos || 0) * precioBulto)}
                        </li>
                      )
                    })}
                  </ul>
                </div>
                {p.comprobanteUrl && (
                  <a href={p.comprobanteUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                    Ver comprobante
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
