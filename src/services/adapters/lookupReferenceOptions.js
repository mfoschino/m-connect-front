export const buildLookupReferenceOptions = (lookupTables, selectedCode = '') => {
  const seen = new Set()
  const options = (Array.isArray(lookupTables) ? lookupTables : [])
    .filter((lookup) => {
      if (typeof lookup?.codigo !== 'string' || !lookup.codigo || seen.has(lookup.codigo)) {
        return false
      }
      seen.add(lookup.codigo)
      return true
    })
    .map((lookup) => {
      const name = typeof lookup.name === 'string' ? lookup.name.trim() : ''
      return {
        value: lookup.codigo,
        label: [lookup.codigo, name, lookup.is_active === false ? 'inactiva' : '']
          .filter(Boolean)
          .join(' — '),
      }
    })

  if (selectedCode && !seen.has(selectedCode)) {
    options.unshift({
      value: selectedCode,
      label: `${selectedCode} — no disponible`,
      unavailable: true,
    })
  }

  return options
}
