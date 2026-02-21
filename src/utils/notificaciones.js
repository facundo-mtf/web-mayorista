import { collection, addDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'

/** Notifica a un usuario */
export async function notificarUsuario(userId, titulo, mensaje) {
  if (!userId || !titulo) return
  await addDoc(collection(db, 'notificaciones'), {
    userId,
    titulo,
    mensaje: mensaje || null,
    leida: false,
    createdAt: serverTimestamp(),
  })
}

/**
 * Notifica a todos los clientes (role === 'cliente', no deleted).
 * @returns {{ ok: boolean, count: number, error?: string }}
 */
export async function notificarTodosLosClientes(titulo, mensaje) {
  try {
    const q = query(
      collection(db, 'users'),
      where('role', '==', 'cliente')
    )
    const snap = await getDocs(q)
    let count = 0
    for (const d of snap.docs) {
      const data = d.data()
      if (data.deleted) continue
      try {
        await notificarUsuario(d.id, titulo, mensaje)
        count++
      } catch (e) {
        console.error('Error creando notificación para', d.id, e)
      }
    }
    return { ok: true, count }
  } catch (err) {
    console.error('notificarTodosLosClientes:', err)
    return { ok: false, count: 0, error: err?.message || String(err) }
  }
}
