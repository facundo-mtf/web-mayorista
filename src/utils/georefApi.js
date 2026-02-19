const GEOREF_BASE = 'https://apis.datos.gob.ar/georef/api'

/**
 * Obtiene las localidades de una provincia desde la API Georef (Argentina)
 * @param {string} provinciaId - ID de la provincia (ej: '06' para Buenos Aires)
 * @returns {Promise<Array<{id: string, nombre: string}>>}
 */
export async function fetchLocalidades(provinciaId) {
  if (!provinciaId) return []
  try {
    const res = await fetch(
      `${GEOREF_BASE}/localidades?provincia=${provinciaId}&max=2000&orden=nombre`
    )
    const data = await res.json()
    if (!data.localidades) return []
    return data.localidades.map(l => ({ id: l.id, nombre: l.nombre }))
  } catch (err) {
    console.warn('Error fetching localidades:', err)
    return []
  }
}
