/**
 * Formato de números: 2 decimales, miles con coma (,), decimales con punto (.)
 * Ej: 1234567.89 → "1,234,567.89"
 */
export function formatMoneda(n) {
  const num = Number(n)
  if (isNaN(num)) return '0.00'
  const fixed = num.toFixed(2)
  const [intPart, decPart] = fixed.split('.')
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return withCommas + '.' + decPart
}
