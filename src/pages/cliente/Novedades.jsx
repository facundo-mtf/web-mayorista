import { useState, useEffect } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'

export default function Novedades() {
  const { user } = useAuth()
  const [notificaciones, setNotificaciones] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.uid) return
    const q = query(
      collection(db, 'notificaciones'),
      where('userId', '==', user.uid)
    )
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      list.sort((a, b) => {
        const getTime = (x) => {
          if (!x) return 0
          if (typeof x.toMillis === 'function') return x.toMillis()
          if (typeof x.toDate === 'function') return x.toDate().getTime()
          return (new Date(x)).getTime()
        }
        return getTime(b.createdAt) - getTime(a.createdAt)
      })
      setNotificaciones(list)
      setLoading(false)
    }, (err) => {
      console.error('Error cargando novedades:', err)
      setLoading(false)
    })
    return () => unsub()
  }, [user?.uid])

  const formatDate = (d) => {
    if (!d) return ''
    const date = d?.toDate ? d.toDate() : new Date(d)
    return date.toLocaleString('es-AR')
  }

  return (
    <div className="container page">
      <h1 className="page-title">Novedades</h1>
      <p className="page-subtitle">Notificaciones y novedades para vos.</p>
      {loading ? (
        <p className="empty-state">Cargando...</p>
      ) : notificaciones.length === 0 ? (
        <p className="empty-state">No tenés notificaciones nuevas.</p>
      ) : (
        <ul className="novedades-list">
          {notificaciones.map((n) => (
            <li key={n.id} className={`novedades-item ${n.leida ? 'novedades-item-leida' : ''}`}>
              <div className="novedades-item-content">
                <strong>{n.titulo || 'Novedad'}</strong>
                {n.mensaje && <p>{n.mensaje}</p>}
                <span className="novedades-item-fecha">{formatDate(n.createdAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
