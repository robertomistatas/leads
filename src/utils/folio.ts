function stableHash32(input: string) {
  // FNV-1a 32-bit
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

export function numericFolioFromId(id: string, digits = 4) {
  const text = String(id)
  if (!text) return undefined
  const mod = 10 ** digits
  const n = stableHash32(text) % mod
  return String(n).padStart(digits, '0')
}

export function makeFolio(kind: 'Lead' | 'Venta', id: string) {
  const folio = numericFolioFromId(id)
  if (!folio) return undefined
  return `${kind} #${folio}`
}
