import { useState, useEffect } from 'react'

export default function ImageLightbox({ imagenes, onClose }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') setIndex(i => (i - 1 + imagenes.length) % imagenes.length)
      if (e.key === 'ArrowRight') setIndex(i => (i + 1) % imagenes.length)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [imagenes.length, onClose])

  if (!imagenes?.length) return null

  return (
    <div className="lightbox-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <button className="lightbox-close" onClick={onClose} aria-label="Cerrar">×</button>
      <button
        className="lightbox-nav lightbox-prev"
        onClick={(e) => { e.stopPropagation(); setIndex(i => (i - 1 + imagenes.length) % imagenes.length); }}
        aria-label="Anterior"
      >
        ‹
      </button>
      <img
        src={imagenes[index]}
        alt=""
        className="lightbox-img"
        onClick={e => e.stopPropagation()}
      />
      <button
        className="lightbox-nav lightbox-next"
        onClick={(e) => { e.stopPropagation(); setIndex(i => (i + 1) % imagenes.length); }}
        aria-label="Siguiente"
      >
        ›
      </button>
      <div className="lightbox-counter">
        {index + 1} / {imagenes.length}
      </div>
    </div>
  )
}
