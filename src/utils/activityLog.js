import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../context/AuthContext'

// Payload solo con valores que Firestore acepta (sin undefined)
function sanitizePayload(payload) {
  if (payload === null || typeof payload !== 'object') return {}
  const out = {}
  for (const [k, v] of Object.entries(payload)) {
    if (v === undefined) continue
    if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v
    } else if (typeof v === 'object' && !(v instanceof Date) && !('toDate' in v)) {
      out[k] = sanitizePayload(v)
    } else {
      out[k] = v
    }
  }
  return out
}

/**
 * Registra una acción del usuario en la colección activityLog.
 * Solo debe llamarse con el userId del usuario autenticado (no permite suplantación por reglas).
 * @param {import('firebase/firestore').Firestore} firestore - instancia de db
 * @param {string} userId - uid del usuario
 * @param {string|null} userEmail - email (para mostrar en admin)
 * @param {string} action - tipo de acción: register, login, cart_add_product, material_play, etc.
 * @param {object} payload - datos adicionales (productId, productName, materialId, tipo, titulo, etc.)
 */
export async function logActivity(firestore, userId, userEmail, action, payload = {}) {
  if (!userId || !action) return
  try {
    await addDoc(collection(firestore, 'activityLog'), {
      userId,
      userEmail: userEmail || null,
      action,
      payload: sanitizePayload(typeof payload === 'object' && payload !== null ? payload : {}),
      createdAt: serverTimestamp(),
    })
  } catch (e) {
    console.warn('activityLog:', e.message)
  }
}

/**
 * Hook para registrar acciones desde componentes con usuario ya logueado.
 * Retorna { log(action, payload) }. Si no hay usuario, log no hace nada.
 * La escritura es asíncrona; se ignora el rechazo para no romper el flujo.
 */
export function useActivityLog() {
  const { user } = useAuth()
  const log = (action, payload = {}) => {
    if (!user) return
    logActivity(db, user.uid, user.email || null, action, payload).catch((e) => {
      console.warn('activityLog write failed:', e.message)
    })
  }
  return { log }
}
