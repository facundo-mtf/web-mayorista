import { useState, useEffect } from 'react'
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase/config'

export default function FotosVideos() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(
      collection(db, 'materialPublico'),
      orderBy('createdAt', 'desc')
    )
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, () => setLoading(false))
    return () => unsub()
  }, [])

  return (
    <div className="container page">
      <h1 className="page-title">Fotos y videos</h1>
      <p className="page-subtitle">Material audiovisual para descargar.</p>
      {loading ? (
        <p className="empty-state">Cargando...</p>
      ) : items.length === 0 ? (
        <p className="empty-state">Aún no hay fotos ni videos publicados.</p>
      ) : (
        <div className="fotos-videos-grid">
          {items.map((item) => (
            <div key={item.id} className="fotos-videos-card">
              {item.tipo === 'video' && item.url ? (
                <div className="fotos-videos-video-wrap">
                  <video src={item.url} controls className="fotos-videos-video" />
                </div>
              ) : item.url ? (
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="fotos-videos-img-link">
                  <img src={item.url} alt={item.titulo || 'Imagen'} className="fotos-videos-img" />
                </a>
              ) : null}
              {(item.titulo || item.descripcion) && (
                <div className="fotos-videos-info">
                  {item.titulo && <h3>{item.titulo}</h3>}
                  {item.descripcion && <p>{item.descripcion}</p>}
                  {item.url && (
                    <a href={item.url} download target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">
                      Descargar
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
