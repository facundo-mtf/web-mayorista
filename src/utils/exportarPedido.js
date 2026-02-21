import { jsPDF } from 'jspdf'
import * as XLSX from 'xlsx'
import { formatMoneda } from './formatoNumero'

function formatDate(d) {
  if (!d) return '-'
  const date = d?.toDate ? d.toDate() : new Date(d)
  return date.toLocaleString('es-AR')
}

function formatNum(n) {
  return formatMoneda(n ?? 0)
}

/** Convierte número a letras en español (Argentina) para "SON PESOS: ..." */
function numeroALetras(num) {
  const n = Math.abs(Number(num))
  const entero = Math.floor(n)
  const centavos = Math.round((n - entero) * 100)
  const UNIDADES = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE']
  const DECENAS = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA']
  const ESPECIALES = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE']
  const VEINTI = ['VEINTI', 'VEINTIUN', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE']
  const CIENTOS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS']

  function hasta99(v) {
    if (v === 0) return ''
    if (v < 10) return UNIDADES[v]
    if (v < 20) return ESPECIALES[v - 10]
    if (v === 20) return 'VEINTE'
    if (v < 30) return VEINTI[v - 20] || 'VEINTI' + UNIDADES[v - 20]
    const d = Math.floor(v / 10)
    const u = v % 10
    if (u === 0) return DECENAS[d]
    return DECENAS[d] + ' Y ' + UNIDADES[u]
  }
  function hasta999(v) {
    if (v === 0) return ''
    if (v === 100) return 'CIEN'
    const c = Math.floor(v / 100)
    const r = v % 100
    return (CIENTOS[c] || UNIDADES[c] + 'CIENTOS') + (r ? ' ' + hasta99(r) : '')
  }
  function bloque(v, singular, plural) {
    if (v === 0) return ''
    const s = v === 1 ? hasta999(v) + ' ' + singular : hasta999(v) + ' ' + plural
    return s.replace(/^UN MIL /, 'MIL ')
  }
  if (entero === 0 && centavos === 0) return 'CERO CON 00/100'
  let out = ''
  const millones = Math.floor(entero / 1e6)
  const miles = Math.floor((entero % 1e6) / 1000)
  const resto = entero % 1000
  if (millones > 0) out += bloque(millones, 'MILLÓN', 'MILLONES') + ' '
  if (miles > 0) out += (miles === 1 ? 'MIL' : hasta999(miles) + ' MIL') + ' '
  if (resto > 0 || out === '') out += hasta999(resto) || 'CERO'
  out = out.trim()
  out += ' CON ' + String(centavos).padStart(2, '0') + '/100'
  return out
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

/** Dibuja un bloque con título y contenido; devuelve la y final */
function drawBlock(pdf, opts) {
  const { x, y, w, title, lines, margin: blockMargin = 5 } = opts
  const lineH = 5
  const titleH = 6
  const contentH = lines.length * lineH
  const blockH = titleH + blockMargin + contentH + blockMargin
  pdf.setDrawColor(200)
  pdf.setFillColor(250, 250, 252)
  pdf.rect(x, y, w, blockH, 'FD')
  let cy = y + blockMargin
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.setTextColor(40, 40, 48)
  pdf.text(title, x + blockMargin, cy + 4)
  cy += titleH + 2
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(0, 0, 0)
  for (const { label, value } of lines) {
    pdf.setFont('helvetica', 'bold')
    pdf.text(label, x + blockMargin, cy)
    pdf.setFont('helvetica', 'normal')
    const str = String(value ?? '-')
    const tw = pdf.getTextDimensions(str).w
    pdf.text(str, Math.min(x + w - blockMargin - tw, x + w * 0.6), cy)
    cy += lineH
  }
  return y + blockH
}

/** Genera un PDF del pedido y lo descarga */
export async function exportarPedidoPDF(pedido) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const margin = 14
  const pageW = 210
  const colW = (pageW - margin * 2 - 8) / 2
  let y = 18

  try {
    const [luniBase64, polesieBase64] = await Promise.all([
      loadImageAsBase64('/logos/luni.png'),
      loadImageAsBase64('/logos/polesie.png'),
    ])
    const logoH = 11
    pdf.addImage(luniBase64, 'PNG', margin, 8, 26, logoH)
    pdf.addImage(polesieBase64, 'PNG', margin + 30, 8, 22, logoH)
    y = 24
  } catch {
    y = 18
  }

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(14)
  pdf.text('Distribuidora MTF - Pedido', margin, y)
  y += 7
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'normal')
  pdf.text(`Pedido #${pedido.numeroPedido ?? pedido.id?.slice(-6) ?? '-'}`, margin, y)
  y += 6

  const formatRazonLine = (r) => {
    if (!r) return 'Sin razón social'
    const parts = [r.razonSocial]
    if (r.cuit) parts.push(`CUIT: ${r.cuit}`)
    if (r.condicionFiscal) parts.push(r.condicionFiscal)
    const d = r.direccionFacturacion
    if (d && (d.calle || d.localidad)) {
      const dirParts = [d.calle, d.numero, d.localidad, d.provincia, d.codigoPostal].filter(Boolean)
      if (dirParts.length) parts.push(dirParts.join(', '))
    }
    return parts.join(' — ')
  }

  y = drawBlock(pdf, {
    x: margin,
    y,
    w: colW,
    title: 'Pedido',
    lines: [
      { label: 'Fecha:', value: formatDate(pedido.createdAt) },
      { label: 'Estado:', value: pedido.estado || 'pendiente' },
    ],
  })

  y = drawBlock(pdf, {
    x: margin + colW + 8,
    y: 24,
    w: colW,
    title: 'Facturación y entrega',
    lines: [
      { label: 'Razón social:', value: (pedido.razonSocial?.razonSocial || 'Sin razón').slice(0, 35) },
      { label: 'CUIT:', value: pedido.razonSocial?.cuit || '-' },
      { label: 'Sucursal:', value: pedido.sucursal ? `${pedido.sucursal.direccion || ''}, ${pedido.sucursal.localidad || ''}`.trim().slice(0, 38) : '-' },
      { label: 'Cond. fiscal:', value: pedido.condicionFiscal === 'A' ? 'Factura A' : pedido.condicionFiscal === 'nota_pedido' ? 'Nota de pedido' : (pedido.condicionFiscal || '-') },
      { label: 'Logística:', value: pedido.expreso?.nombre || pedido.logistica || '-' },
    ],
  })

  y = Math.max(y, 24 + 45)
  const contacto = pedido.contactoCompra || pedido.contacto
  const contactosLines = []
  if (contacto) {
    contactosLines.push({ label: 'Compra:', value: `${(contacto.nombre ?? '')} ${(contacto.apellido ?? '')}`.trim() || '-' })
    contactosLines.push({ label: 'Tel:', value: contacto.telefono || '-' })
    contactosLines.push({ label: 'Email:', value: (contacto.email || '-').slice(0, 36) })
  }
  if (pedido.contactoPago && pedido.contactoCompra && (pedido.contactoPago.email !== pedido.contactoCompra?.email || pedido.contactoPago.nombre !== pedido.contactoCompra?.nombre)) {
    contactosLines.push({ label: 'Pago:', value: `${pedido.contactoPago.nombre ?? ''} ${pedido.contactoPago.apellido ?? ''}`.trim() || '-' })
    contactosLines.push({ label: 'Tel pago:', value: pedido.contactoPago.telefono || '-' })
  }
  if (contactosLines.length) {
    y = drawBlock(pdf, { x: margin, y, w: pageW - margin * 2, title: 'Contactos', lines: contactosLines })
  } else {
    y += 2
  }

  if (pedido.observaciones && String(pedido.observaciones).trim()) {
    y += 4
    const obsLines = pdf.splitTextToSize(String(pedido.observaciones).trim(), pageW - margin * 2 - 10)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.text('Observaciones / Comentarios', margin, y)
    y += 5
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    obsLines.forEach((line) => {
      if (y > 270) { pdf.addPage(); y = 20 }
      pdf.text(line, margin, y)
      y += 5
    })
    y += 2
  }

  y += 4
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(10)
  pdf.text('Productos encargados', margin, y)
  y += 6

  const items = pedido.items || []
  const colW2 = [22, 70, 18, 28, 28, 38]
  const descColW = colW2[1]
  const lineH = 5
  const headers = ['SKU', 'Descripción', 'Bultos', 'P. unit.', 'P. bulto', 'Subtotal']
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  pdf.text(headers[0], margin, y)
  pdf.text(headers[1], margin + colW2[0], y)
  pdf.text(headers[2], margin + colW2[0] + colW2[1], y)
  pdf.text(headers[3], margin + colW2[0] + colW2[1] + colW2[2], y)
  pdf.text(headers[4], margin + colW2[0] + colW2[1] + colW2[2] + colW2[3], y)
  pdf.text(headers[5], margin + colW2[0] + colW2[1] + colW2[2] + colW2[3] + colW2[4], y)
  y += 8

  function wrapText(str, maxWidth) {
    const words = String(str ?? '-').split(/\s+/)
    const lines = []
    let line = ''
    for (const word of words) {
      const test = line ? line + ' ' + word : word
      const { w } = pdf.getTextDimensions(test)
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

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(8)
  for (const it of items) {
    if (y > 265) {
      pdf.addPage()
      y = 20
    }
    const precioUnit = it.precioUnitario ?? (it.precioPorBulto ?? 0) / (it.unidadesPorBulto ?? 1)
    const precioBulto = it.precioPorBulto ?? precioUnit * (it.unidadesPorBulto ?? 1)
    const subtotal = (it.bultos ?? 0) * precioBulto
    const descLines = wrapText(it.descripcion ?? '-', descColW)
    const rowH = Math.max(10, descLines.length * lineH + 4)
    const startY = y
    pdf.text(String(it.sku ?? '-'), margin, startY)
    descLines.forEach((ln, i) => {
      pdf.text(ln, margin + colW2[0], startY + i * lineH)
    })
    pdf.text(String(it.bultos ?? 0), margin + colW2[0] + colW2[1], startY)
    pdf.text('$' + formatNum(precioUnit), margin + colW2[0] + colW2[1] + colW2[2], startY)
    pdf.text('$' + formatNum(precioBulto), margin + colW2[0] + colW2[1] + colW2[2] + colW2[3], startY)
    pdf.text('$' + formatNum(subtotal), margin + colW2[0] + colW2[1] + colW2[2] + colW2[3] + colW2[4], startY)
    y = startY + rowH
  }

  y += 8
  if (y > 250) { pdf.addPage(); y = 20 }

  const blockLeft = 100
  const blockRight = 195
  const totalLineH = 6
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'normal')

  const subtotalBruto = pedido.subtotal ?? 0
  const descPct = pedido.descuentoBase ?? 0
  const subtotalConDescuentoBase = subtotalBruto * (1 - descPct / 100)
  const esFacturaA = pedido.condicionFiscal === 'A'
  const neto = esFacturaA ? (pedido.total ?? 0) / 1.21 : (pedido.total ?? 0)
  const iva = esFacturaA ? (pedido.total ?? 0) - neto : 0
  const descMonto = subtotalBruto - subtotalConDescuentoBase
  const prontoMonto = pedido.aplicaProntoPago ? subtotalConDescuentoBase * 0.1 : 0
  const descTexto = descPct > 0 && pedido.aplicaProntoPago
    ? `Desc. ${descPct} + 10 %`
    : descPct > 0
      ? `Desc. ${descPct} %`
      : pedido.aplicaProntoPago
        ? 'Desc. 10 %'
        : null

  function drawTotalLine(label, valueStr) {
    pdf.setFont('helvetica', 'normal')
    pdf.text(label, blockLeft, y)
    const valueW = pdf.getTextDimensions(valueStr).w
    pdf.text(valueStr, blockRight - valueW, y)
    y += totalLineH
  }

  drawTotalLine('Subtotal', '$' + formatNum(subtotalBruto))
  if (descTexto) drawTotalLine(descTexto, formatNum(descMonto + prontoMonto))
  pdf.setDrawColor(180)
  pdf.line(blockLeft, y, blockRight, y)
  y += 4
  drawTotalLine('Subtotal', '$' + formatNum(neto))
  if (esFacturaA) drawTotalLine('I.V.A. 21,00 %', '$' + formatNum(iva))
  pdf.line(blockLeft, y, blockRight, y)
  y += 4
  const totalEnLetras = numeroALetras(pedido.total ?? 0)
  pdf.setFont('helvetica', 'bold')
  const sonPesosText = 'SON PESOS: ' + totalEnLetras + ' *********************************************'
  const maxW = blockRight - blockLeft
  const sonPesosLines = pdf.splitTextToSize(sonPesosText, maxW)
  sonPesosLines.forEach((line) => {
    pdf.text(line, blockLeft, y)
    y += totalLineH
  })
  const totalStr = '$' + formatNum(pedido.total)
  const totalStrW = pdf.getTextDimensions(totalStr).w
  pdf.setFont('helvetica', 'bold')
  pdf.text('TOTAL', blockLeft, y)
  pdf.text(totalStr, blockRight - totalStrW, y)
  y += totalLineH + 4

  const filename = `pedido-${pedido.numeroPedido ?? pedido.id?.slice(-6) ?? 'sin-num'}.pdf`
  pdf.save(filename)
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
    ['Condición fiscal', (pedido.condicionFiscal === 'A' ? 'Factura A' : pedido.condicionFiscal === 'nota_pedido' ? 'Nota de pedido' : pedido.condicionFiscal) || '-'],
    ['Forma de pago', pedido.formaPago || '-'],
    ['Expreso/Logística', pedido.expreso?.nombre || pedido.logistica || '-'],
    [],
    ['Contacto', pedido.contacto ? `${pedido.contacto.nombre} ${pedido.contacto.apellido}` : '-'],
    ['Teléfono', pedido.contacto?.telefono || '-'],
    ['Email', pedido.contacto?.email || '-'],
    ...(pedido.observaciones ? [['Observaciones / Comentarios', pedido.observaciones]] : []),
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
  rows.push(['Total a pagar', '', '', '', '', '', ''])
  const subtotalBruto = pedido.subtotal ?? 0
  const descPct = pedido.descuentoBase ?? 0
  const subtotalConDescuentoBase = subtotalBruto * (1 - descPct / 100)
  const esFacturaA = pedido.condicionFiscal === 'A'
  const neto = esFacturaA ? (pedido.total ?? 0) / 1.21 : (pedido.total ?? 0)
  const iva = esFacturaA ? (pedido.total ?? 0) - neto : 0
  rows.push(['Subtotal bruto', '', '', '', '', '', pedido.subtotal ?? 0])
  if (descPct > 0) rows.push(['Desc. ' + descPct + '%', '', '', '', '', '', subtotalBruto - subtotalConDescuentoBase])
  if (pedido.aplicaProntoPago) rows.push(['Desc. pronto pago 10%', '', '', '', '', '', subtotalConDescuentoBase - subtotalConDescuentoBase * 0.9])
  rows.push(['Subtotal con descuento', '', '', '', '', '', neto])
  if (esFacturaA) rows.push(['I.V.A 21%', '', '', '', '', '', iva])
  rows.push(['TOTAL', '', '', '', '', '', pedido.total ?? 0])

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
