const toText = value => String(value || '').trim()

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const listTableColumns = async (supabase, tableName) => {
  const { data, error } = await supabase
    .from('information_schema.columns')
    .select('column_name')
    .eq('table_schema', 'public')
    .eq('table_name', tableName)

  if (error) {
    throw new Error(error.message || `Unable to load columns for ${tableName}.`)
  }

  return new Set((data || []).map(item => toText(item?.column_name)).filter(Boolean))
}

export const firstColumn = (columns, candidates = []) => candidates.find(column => columns.has(column)) || ''

export const firstValue = (row, candidates = []) => {
  for (const key of candidates) {
    const value = row?.[key]

    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return value
    }
  }

  return null
}

export const toNumberOrNull = value => {
  if (value === null || value === undefined || String(value).trim() === '') {
    return null
  }

  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : null
}

export const toBooleanOrNull = value => {
  if (value === null || value === undefined || String(value).trim() === '') {
    return null
  }

  if (typeof value === 'boolean') {
    return value
  }

  const normalized = String(value).trim().toLowerCase()

  if (['true', '1', 'yes', 'active'].includes(normalized)) {
    return true
  }

  if (['false', '0', 'no', 'inactive'].includes(normalized)) {
    return false
  }

  return null
}
