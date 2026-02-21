import { useState, useEffect } from 'react'
import { collection, onSnapshot, addDoc, deleteDoc, doc, orderBy, query } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../../firebase/config'
import { useAuth } from '../../context/AuthContext'
import { notificarTodosLosClientes } from '../../utils/notificaciones'

export default function AdminFotosVideos() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [subiendo, setSubiendo] = useState(false)
  const [form, setForm] = useState({ tipo: 'foto', titulo: '', descripcion: '', file: null })

  useEffect(() => {
    const q = query(collection(db, 'materialPublico'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.file || !user) return
    setSubiendo(true)
    try {
      const path = `materialPublico/${user.uid}/${Date.now()}_${form.file.name}`
      const storageRef = ref(storage, path)
      await uploadBytes(storageRef, form.file)
      const url = await getDownloadURL(storageRef)
      await addDoc(collection(db, 'materialPublico'), {
        tipo: form.tipo,
        titulo: form.titulo.trim() || null,
        descripcion: form.descripcion.trim() || null,
        url,
        createdAt: new Date(),
      })
      setForm({ tipo: 'foto', titulo: '', descripcion: '', file: null })
      notificarTodosLosClientes('Nuevo material', 'Se subió nuevo material en Fotos y videos.').catch(() => {})
    } catch (err) {
      console.error(err)
      alert('Error al subir. Revisá la consola.')
    } finally {
      setSubiendo(false)
    }
  }

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar este elemento?')) return
    await deleteDoc(doc(db, 'materialPublico', id))
  }

  return (
    <div className="container page">
      <h1 className="page-title">Fotos y videos</h1>
      <p className="page-subtitle">Subí material para que los clientes lo descarguen desde "Fotos y videos".</p>

      <form onSubmit={handleSubmit} className="admin-fotos-videos-form">
        <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
          <option value="foto">Foto / imagen</option>
          <option value="video">Video</option>
        </select>
        <input
          type="text"
          placeholder="Título (opcional)"
          value={form.titulo}
          onChange={(e) => setForm({ ...form, titulo: e.target.value })}
        />
        <input
          type="text"
          placeholder="Descripción (opcional)"
          value={form.descripcion}
          onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
        />
        <label className="input-file-label">
          Archivo
          <input
            type="file"
            accept={form.tipo === 'video' ? 'video/*' : 'image/*'}
            required
            onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })}
            style={{ display: 'none' }}
          />
          <span className="input-file-text">{form.file ? form.file.name : 'Seleccionar'}</span>
        </label>
        <button type="submit" className="btn btn-primary" disabled={subiendo}>
          {subiendo ? 'Subiendo...' : 'Subir'}
        </button>
      </form>

      <div className="admin-fotos-videos-list">
        <h3>Publicados ({items.length})</h3>
        {items.length === 0 ? (
          <p className="empty-state">Aún no hay elementos.</p>
        ) : (
          <ul className="admin-fotos-videos-ul">
            {items.map((item) => (
              <li key={item.id} className="admin-fotos-videos-li">
                {item.tipo === 'video' ? (
                  <video src={item.url} controls style={{ maxWidth: 200, maxHeight: 120 }} />
                ) : (
                  <img src={item.url} alt="" style={{ maxWidth: 120, maxHeight: 80, objectFit: 'cover' }} />
                )}
                <span>{item.titulo || item.descripcion || '(sin título)'}</span>
                <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => eliminar(item.id)}>Eliminar</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
