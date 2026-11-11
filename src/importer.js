import Papa from 'papaparse'

const forbidden = new Set(['__proto__', 'prototype', 'constructor'])
const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key)
const record = value => value && typeof value === 'object' && !Array.isArray(value)
export const MAX_BYTES = 5 * 1024 * 1024
export const MAX_ROWS = 10000

export function parseFile(text, filename) {
  if (new TextEncoder().encode(text).length > MAX_BYTES) throw new Error('File exceeds 5 MiB.')
  const ext = filename.split('.').pop().toLowerCase()
  let rows
  if (ext === 'json') {
    rows = JSON.parse(text.replace(/^\uFEFF/, ''))
  } else if (ext === 'csv' || ext === 'tsv') {
    // Parse as arrays so duplicate/empty headers cannot be silently renamed.
    const result = Papa.parse(text.replace(/^\uFEFF/, ''), {
      delimiter: ext === 'tsv' ? '\t' : ',', skipEmptyLines: 'greedy'
    })
    if (result.errors.length) throw new Error(result.errors[0].message)
    const [headers, ...values] = result.data
    if (!headers || headers.some(h => !h.trim() || forbidden.has(h))) throw new Error('Invalid column header.')
    if (new Set(headers).size !== headers.length) throw new Error('Duplicate column headers.')
    rows = values.map((cells, i) => {
      if (cells.length !== headers.length) throw new Error(`Record ${i + 1}: column count differs from header.`)
      return Object.fromEntries(headers.map((h, j) => [h, cells[j]]))
    })
  } else throw new Error('Use a .csv, .tsv or .json file.')
  if (!Array.isArray(rows) || !rows.length) throw new Error('Expected a non-empty array of records.')
  if (rows.length > MAX_ROWS) throw new Error('File exceeds 10,000 records.')
  rows.forEach((row, i) => {
    if (!record(row) || !Object.keys(row).length) throw new Error(`Record ${i + 1}: expected an object with columns.`)
    for (const [key, value] of Object.entries(row)) {
      if (!key.trim() || forbidden.has(key)) throw new Error(`Record ${i + 1}: invalid column name.`)
      if (value !== null && typeof value === 'object') throw new Error(`Record ${i + 1}: nested values are not supported.`)
    }
  })
  return rows
}

export function prepareImport(rows, query, mappingText = '{}') {
  if (!query?.datasourceId || query.readable !== false) throw new Error('Select a saved write query (readable=false).')
  if (!rows.length) throw new Error('Select a file first.')
  const mapping = JSON.parse(mappingText || '{}')
  if (!record(mapping)) throw new Error('Parameter mapping must be a JSON object.')
  const names = (query.parameters || []).map(p => p.name)
  if (!names.length || new Set(names).size !== names.length) throw new Error('The query must define unique named parameters.')
  for (const [name, column] of Object.entries(mapping)) {
    if (!names.includes(name) || typeof column !== 'string' || forbidden.has(column)) throw new Error(`Invalid mapping: ${name}`)
  }
  // Validate every row before making the first write. No SQL interpolation.
  return rows.map((row, index) => Object.fromEntries(names.map(name => {
    if (forbidden.has(name)) throw new Error('Invalid query parameter name.')
    const column = own(mapping, name) ? mapping[name] : name
    if (!own(row, column)) throw new Error(`Record ${index + 1}: missing column "${column}" for parameter "${name}".`)
    const value = row[column]
    return [name, value === null ? null : String(value)]
  })))
}

export async function runImport({ api, queryId, parameters, shouldCancel = () => false, stopOnError = true, onProgress = () => {} }) {
  const result = { succeeded: 0, failed: 0, processed: 0, total: parameters.length, cancelled: false, errors: [] }
  for (let i = 0; i < parameters.length; i++) {
    if (shouldCancel()) { result.cancelled = true; break }
    try {
      await api.executeQuery(queryId, { parameters: parameters[i] })
      result.succeeded++
    } catch (error) {
      result.failed++
      result.errors.push({ record: i + 1, message: String(error?.message || error || 'Query failed') })
    }
    result.processed++
    onProgress({ ...result, errors: [...result.errors] })
    if (result.failed && stopOnError) break
  }
  return result
}
