import { jsPDF } from 'jspdf'
import * as XLSX from 'xlsx'

function formatDate(d) {
  if (!d) return '-'
  const date = d?.toDate ? d.toDate() : new Date(d)
  return date.toLocaleString('es-AR')
}

function formatNum(n) {
  return (n ?? 0).toLocaleString('es-AR')
}

function loadImageAsBase64(src) {
  return fetch(src)
    .then(r => r.blob())
    .then(blob => new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    }))
}

/** Genera un PDF del pedido y lo descarga */
export async function exportarPedidoPDF(pedido) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const margin = 15
  let y = 20

  try {
    const [luniBase64, polesieBase64] = await Promise.all([
      loadImageAsBase64('/logos/luni.png'),
      loadImageAsBase64('/logos/polesie.png'),
    ])
    const logoH = 12
    doc.addImage(luniBase64, 'PNG', margin, 10, 28, logoH)
    doc.addImage(polesieBase64, 'PNG', margin + 32, 10, 24, logoH)
    y = 28
  } catch {
    y = 20
  }

  const add = (text, opts = {}) => {
    const { size = 10, bold = false } = opts
    doc.setFontSize(size)
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.text(text, margin, y)
    y += size * 0.5
  }

  const addLine = (label, value) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(label, margin, y)
    doc.setFont('helvetica', 'normal')
    doc.text(String(value ?? '-'), margin + 50, y)
    y += 6
  }

  add('Distribuidora MTF - Pedido', { size: 14, bold: true })
  y += 4
  add(`Pedido #${pedido.numeroPedido ?? pedido.id?.slice(-6) ?? '-'}`, { size: 12 })
  addLine('Fecha:', formatDate(pedido.createdAt))
  addLine('Estado:', pedido.estado || 'pendiente')
  y += 4

  add('Datos del pedido', { size: 11, bold: true })
  y += 4
  addLine('Razón social:', pedido.razonSocial?.razonSocial || 'Sin razón social')
  addLine('CUIT:', pedido.razonSocial?.cuit || '-')
  addLine('Sucursal:', pedido.sucursal ? `${pedido.sucursal.direccion}, ${pedido.sucursal.localidad}` : '-')
  addLine('Condición fiscal:', pedido.condicionFiscal || '-')
  addLine('Forma de pago:', pedido.formaPago || '-')
  if (pedido.expreso) addLine('Expreso:', pedido.expreso.nombre || '-')
  if (pedido.logistica) addLine('Logística:', pedido.logistica)
  y += 4

  if (pedido.contacto) {
    add('Contacto', { size: 11, bold: true })
    y += 4
    addLine('Nombre:', `${pedido.contacto.nombre ?? ''} ${pedido.contacto.apellido ?? ''}`.trim())
    addLine('Teléfono:', pedido.contacto.telefono)
    addLine('Email:', pedido.contacto.email)
    y += 4
  }

  add('Productos encargados', { size: 11, bold: true })
  y += 6

  const items = pedido.items || []
  const colW = [22, 75, 18, 32, 38]
  const descColW = colW[1]
  const lineH = 5
  const headers = ['SKU', 'Descripción', 'Bultos', 'P. bulto', 'Subtotal']
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text(headers[0], margin, y)
  doc.text(headers[1], margin + colW[0], y)
  doc.text(headers[2], margin + colW[0] + colW[1], y)
  doc.text(headers[3], margin + colW[0] + colW[1] + colW[2], y)
  doc.text(headers[4], margin + colW[0] + colW[1] + colW[2] + colW[3], y)
  y += 8

  function wrapText(str, maxWidth) {
    const words = String(str ?? '-').split(/\s+/)
    const lines = []
    let line = ''
    for (const word of words) {
      const test = line ? line + ' ' + word : word
      const { w } = doc.getTextDimensions(test)
      if (w <= maxWidth) {
        line = test
      } else {
        if (line) lines.push(line)
        line = word
      }
    }
    if (line) lines.push(line)
    return lines
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  for (const it of items) {
    if (y > 265) {
      doc.addPage()
      y = 20
    }
    const subtotal = (it.bultos ?? 0) * (it.precioPorBulto ?? 0)
    const descLines = wrapText(it.descripcion ?? '-', descColW)
    const rowH = Math.max(10, descLines.length * lineH + 4)
    const startY = y
    doc.text(String(it.sku ?? '-'), margin, startY)
    descLines.forEach((ln, i) => {
      doc.text(ln, margin + colW[0], startY + i * lineH)
    })
    doc.text(String(it.bultos ?? 0), margin + colW[0] + colW[1], startY)
    doc.text('$' + formatNum(it.precioPorBulto), margin + colW[0] + colW[1] + colW[2], startY)
    doc.text('$' + formatNum(subtotal), margin + colW[0] + colW[1] + colW[2] + colW[3], startY)
    y = startY + rowH
  }

  y += 6
  if (y > 250) { doc.addPage(); y = 20 }
  addLine('Subtotal:', '$' + formatNum(pedido.subtotal))
  if (pedido.descuentoBase) addLine('Descuento base %:', pedido.descuentoBase)
  if (pedido.aplicaProntoPago) add('(Incluye 10% pronto pago)', { size: 8 })
  addLine('Total:', '$' + formatNum(pedido.total))

  const filename = `pedido-${pedido.numeroPedido ?? pedido.id?.slice(-6) ?? 'sin-num'}.pdf`
  doc.save(filename)
}

/** Genera un Excel de un pedido y lo descarga */
export function exportarPedidoExcel(pedido) {
  const items = pedido.items || []
  const rows = [
    ['Pedido', `#${pedido.numeroPedido ?? pedido.id?.slice(-6) ?? '-'}`],
    ['Fecha', formatDate(pedido.createdAt)],
    ['Estado', pedido.estado || 'pendiente'],
    ['Razón social', pedido.razonSocial?.razonSocial || 'Sin razón social'],
    ['CUIT', pedido.razonSocial?.cuit || '-'],
    ['Sucursal', pedido.sucursal ? `${pedido.sucursal.direccion}, ${pedido.sucursal.localidad}` : '-'],
    ['Condición fiscal', pedido.condicionFiscal || '-'],
    ['Forma de pago', pedido.formaPago || '-'],
    ['Expreso/Logística', pedido.expreso?.nombre || pedido.logistica || '-'],
    [],
    ['Contacto', pedido.contacto ? `${pedido.contacto.nombre} ${pedido.contacto.apellido}` : '-'],
    ['Teléfono', pedido.contacto?.telefono || '-'],
    ['Email', pedido.contacto?.email || '-'],
    [],
    ['SKU', 'Descripción', 'Bultos', 'Unid/bulto', 'Precio unit.', 'Precio bulto', 'Subtotal'],
  ]
  for (const it of items) {
    const subtotal = (it.bultos ?? 0) * (it.precioPorBulto ?? 0)
    rows.push([
      it.sku ?? '-',
      it.descripcion ?? '-',
      it.bultos ?? 0,
      it.unidadesPorBulto ?? 1,
      it.precioUnitario ?? 0,
      it.precioPorBulto ?? 0,
      subtotal,
    ])
  }
  rows.push([])
  rows.push(['Subtotal', '', '', '', '', '', pedido.subtotal ?? 0])
  rows.push(['Total', '', '', '', '', '', pedido.total ?? 0])

  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Pedido')
  XLSX.writeFile(wb, `pedido-${pedido.numeroPedido ?? pedido.id?.slice(-6) ?? 'sin-num'}.xlsx`)
}

/** Genera un Excel con todos los pedidos */
export function exportarTodosPedidosExcel(pedidos) {
  const rows = [
    ['Nº', 'Fecha', 'Estado', 'Razón social', 'Sucursal', 'Forma pago', 'Contacto', 'Teléfono', 'Total'],
  ]
  for (const p of pedidos) {
    const contacto = p.contacto ? `${p.contacto.nombre ?? ''} ${p.contacto.apellido ?? ''}`.trim() : '-'
    const sucursal = p.sucursal ? `${p.sucursal.direccion}, ${p.sucursal.localidad}` : '-'
    rows.push([
      p.numeroPedido ?? p.id?.slice(-6) ?? '-',
      formatDate(p.createdAt),
      p.estado || 'pendiente',
      p.razonSocial?.razonSocial || 'Sin razón social',
      sucursal,
      p.formaPago || '-',
      contacto,
      p.contacto?.telefono || '-',
      p.total ?? 0,
    ])
  }

  const ws = XLSX.utils.aoa_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Pedidos')
  XLSX.writeFile(wb, `pedidos-${new Date().toISOString().slice(0, 10)}.xlsx`)
}
