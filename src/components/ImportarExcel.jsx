import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { collection, writeBatch, doc, getDocs } from 'firebase/firestore'
import { db } from '../firebase/config'

// Mapeo fijo: A=0, B=1... En tu Excel: Cant(A), Item(B), Image(C), Product Size(D), Product(E), Packaging(F), m3(G), Qty(H), $(I)
const COL_SKU = 1
const COL_DIMENSIONES = 3
const COL_DESCRIPCION = 4
const COL_PRESENTACION = 5
const COL_UNIDADES_POR_BULTO = 7
const COL_PRECIO_UNITARIO = 8

function parseNum(val) {
  if (val == null || val === '') return 0
  if (typeof val === 'number') return val
  const s = String(val).replace(',', '.').trim()
  return parseFloat(s) || 0
}

// Preserva ceros a la izquierda: si es número 360 no podemos recuperar "0360", pero si es texto "0360" se mantiene
function skuToString(val) {
  if (val == null || val === '') return null
  return String(val)
}

export default function ImportarExcel({ onImportado, catalogo = 'polesie' }) {
  const [importando, setImportando] = useState(false)
  const [eliminandoTodo, setEliminandoTodo] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError('')
    setImportando(true)

    try {
      const arrayBuffer = await file.arrayBuffer()
      const data = new Uint8Array(arrayBuffer)

      // Leer datos del sheet
      const workbook = XLSX.read(data, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true })

      if (!json.length) {
        setError('El archivo está vacío.')
        setImportando(false)
        return
      }

      const filas = json.slice(1).filter(row => {
        const desc = row[COL_DESCRIPCION]
        return desc !== '' && desc != null && String(desc).trim() !== ''
      })

      const productos = filas.map((fila) => {
        const descripcion = String(fila[COL_DESCRIPCION] ?? '').trim()
        const sku = skuToString(fila[COL_SKU])
        const dimensiones = fila[COL_DIMENSIONES] != null ? String(fila[COL_DIMENSIONES]).trim() : null
        const presentacion = fila[COL_PRESENTACION] != null ? String(fila[COL_PRESENTACION]).trim() : null
        const unidadesPorBulto = Math.max(1, parseInt(String(fila[COL_UNIDADES_POR_BULTO] ?? '1'), 10) || 1)
        const precioUnitario = parseNum(fila[COL_PRECIO_UNITARIO])
        const precioPorBulto = precioUnitario * unidadesPorBulto

        return {
          descripcion,
          sku: sku || null,
          imagen: null,
          imagenes: [],
          dimensiones: dimensiones || null,
          presentacion: presentacion || null,
          unidadesPorBulto,
          precioUnitario,
          precioPorBulto,
          activo: true,
          catalogo,
        }
      })

      const colRef = collection(db, 'productos')
      const BATCH_SIZE = 500

      for (let i = 0; i < productos.length; i += BATCH_SIZE) {
        const chunk = productos.slice(i, i + BATCH_SIZE)
        const batch = writeBatch(db)
        for (const prod of chunk) {
          const docRef = doc(colRef)
          batch.set(docRef, prod)
        }
        await batch.commit()
      }

      onImportado?.()
      alert(`Se importaron ${productos.length} productos correctamente. Podés subir las imágenes manualmente en Editar.`)
    } catch (err) {
      setError('Error al importar: ' + (err.message || err))
    } finally {
      setImportando(false)
    }

    e.target.value = ''
  }

  const handleEliminarTodo = async () => {
    const nomCatalogo = catalogo === 'luni' ? 'LUNI' : 'Polesie'
    if (!confirm(`¿Eliminar todos los productos del catálogo ${nomCatalogo}? Esta acción no se puede deshacer.`)) return

    setEliminandoTodo(true)
    setError('')

    try {
      const snap = await getDocs(collection(db, 'productos'))
      const docsToDelete = snap.docs.filter(d => (d.data().catalogo || 'polesie') === catalogo)
      const batchSize = 500
      let deleted = 0

      for (let i = 0; i < docsToDelete.length; i += batchSize) {
        const batch = writeBatch(db)
        docsToDelete.slice(i, i + batchSize).forEach(d => {
          batch.delete(d.ref)
          deleted++
        })
        await batch.commit()
      }

      onImportado?.()
      alert(`Se eliminaron ${deleted} productos.`)
    } catch (err) {
      setError('Error al eliminar: ' + (err.message || err))
    } finally {
      setEliminandoTodo(false)
    }
  }

  return (
    <div className="importar-excel">
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        disabled={importando}
      />
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => inputRef.current?.click()}
        disabled={importando}
      >
        {importando ? 'Importando...' : 'Importar Excel'}
      </button>
      <button
        type="button"
        className="btn btn-danger-outline"
        onClick={handleEliminarTodo}
        disabled={eliminandoTodo}
      >
        {eliminandoTodo ? 'Eliminando...' : `Eliminar catálogo ${catalogo === 'luni' ? 'LUNI' : 'Polesie'}`}
      </button>
      {error && <p className="hint error" style={{ marginTop: '0.5rem' }}>{error}</p>}
    </div>
  )
}
