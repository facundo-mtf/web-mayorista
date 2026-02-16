import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { exportarTodosPedidosExcel } from '../../utils/exportarPedido'

export default function AdminPedidos() {
  const navigate = useNavigate()
  const [pedidos, setPedidos] = useState([])

  useEffect(() => {
    const q = query(collection(db, 'pedidos'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setPedidos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [])

  const formatDate = (d) => {
    if (!d) return '-'
    const date = d?.toDate ? d.toDate() : new Date(d)
    return date.toLocaleString('es-AR')
  }

  return (
    <div className="container page">
      <h1 className="page-title">Pedidos</h1>
      <p className="page-subtitle">Hacé clic en un pedido para ver el detalle.</p>
      {pedidos.length > 0 && (
        <div className="admin-pedidos-exportar" style={{ marginBottom: '1rem' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => exportarTodosPedidosExcel(pedidos)}
          >
            Exportar todos a Excel
          </button>
        </div>
      )}
      {pedidos.length === 0 ? (
        <p className="empty-state">No hay pedidos.</p>
      ) : (
        <div className="pedidos-list pedidos-resumen">
          {pedidos.map(p => (
            <button
              key={p.id}
              type="button"
              className="pedido-card pedido-card-resumen"
              onClick={() => navigate(`/admin/pedidos/${p.id}`)}
            >
              <div className="pedido-header">
                <span>#{p.numeroPedido ?? p.id.slice(-6)}</span>
                <span>{formatDate(p.createdAt)}</span>
                <span>{p.estado || 'pendiente'}</span>
              </div>
              <div className="pedido-body">
                <p><strong>Razón social:</strong> {p.razonSocial?.razonSocial || 'Sin razón social'}</p>
                <p><strong>Sucursal:</strong> {p.sucursal ? `${p.sucursal.direccion}, ${p.sucursal.localidad}` : 'Sin sucursal'}</p>
                <p><strong>Forma de pago:</strong> {p.formaPago}</p>
                <p><strong>Total:</strong> ${(p.total || 0).toLocaleString('es-AR')}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
