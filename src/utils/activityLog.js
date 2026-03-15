import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../context/AuthContext'

/**
 * Registra una acción del usuario en la colección activityLog.
 * Solo debe llamarse con el userId del usuario autenticado (no permite suplantación por reglas).
 * @param {import('firebase/firestore').Firestore} firestore - instancia de db
 * @param {string} userId - uid del usuario
 * @param {string|null} userEmail - email (para mostrar en admin)
 * @param {string} action - tipo de acción: register, login, cart_add_product, cart_remove_product, cart_update_qty, order_placed, datos_*
 * @param {object} payload - datos adicionales (productId, productName, orderId, total, etc.)
 */
export async function logActivity(firestore, userId, userEmail, action, payload = {}) {
  if (!userId || !action) return
  try {
    await addDoc(collection(firestore, 'activityLog'), {
      userId,
      userEmail: userEmail || null,
      action,
      payload: typeof payload === 'object' && payload !== null ? payload : {},
      createdAt: serverTimestamp(),
    })
  } catch (e) {
    console.warn('activityLog:', e.message)
  }
}

/**
 * Hook para registrar acciones desde componentes con usuario ya logueado.
 * Retorna { log(action, payload) }. Si no hay usuario, log no hace nada.
 */
export function useActivityLog() {
  const { user } = useAuth()
  const log = (action, payload = {}) => {
    if (!user) return
    logActivity(db, user.uid, user.email || null, action, payload)
  }
  return { log }
}
