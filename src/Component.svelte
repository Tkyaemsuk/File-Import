<script>
  import { getContext, onDestroy } from 'svelte'
  import { MAX_BYTES, parseFile, prepareImport, runImport } from './importer.js'

  export let title = 'File Import'
  export let queryId = ''
  export let parameterMapping = '{}'
  export let stopOnError = true
  export let disabled = false
  export let onComplete = undefined

  const sdk = getContext('sdk')
  const component = getContext('component')
  const styleable = sdk?.styleable || (() => ({}))
  let rows = [], filename = '', message = '', busy = false, loading = false
  let confirmed = false, cancel = false, attempted = false, result = null
  let alive = true
  onDestroy(() => { alive = false; cancel = true })
  $: columns = [...new Set(rows.flatMap(row => Object.keys(row)))]
  $: previewColumns = columns.slice(0, 10)
  $: configuration = `${queryId}\n${parameterMapping}`
  $: if (configuration) confirmed = false
  // builderStore is a Svelte store in Budibase 3.4.1.
  const sdkBuilder = sdk?.builderStore || { subscribe: fn => { fn(null); return () => {} } }
  $: editing = Boolean($sdkBuilder?.inBuilder)

  async function selectFile(event) {
    rows = []; filename = ''; message = ''; result = null; confirmed = false; attempted = false
    const file = event.target.files?.[0]
    if (!file) return
    loading = true
    try {
      if (file.size > MAX_BYTES) throw new Error('File exceeds 5 MiB.')
      rows = parseFile(await file.text(), file.name)
      filename = file.name
    } catch (error) { message = error.message }
    finally { loading = false }
  }

  async function startImport() {
    if (busy || disabled || attempted || !confirmed || editing) return
    busy = true; cancel = false; message = ''; result = null
    try {
      if (!sdk?.API?.executeQuery || !sdk?.API?.fetchQueryDefinition) throw new Error('Budibase query SDK is unavailable.')
      const savedId = queryId.trim()
      if (!savedId) throw new Error('Configure a saved write query ID in the component settings.')
      const mapping = parameterMapping
      const stop = stopOnError
      const query = await sdk.API.fetchQueryDefinition(savedId)
      const parameters = prepareImport(rows, query, mapping)
      if (cancel || !alive || disabled) return
      attempted = true
      result = await runImport({ api: sdk.API, queryId: savedId, parameters,
        stopOnError: stop, shouldCancel: () => cancel || !alive || disabled,
        onProgress: progress => { if (alive) result = progress }
      })
      if (alive && onComplete) {
        try { await onComplete({ ...result }) }
        catch { message = 'Import finished, but the completion action failed. Do not repeat the import.' }
      }
    } catch (error) { if (alive) message = error.message || String(error) }
    finally { if (alive) busy = false }
  }
</script>

<section class="importer" use:styleable={$component?.styles} aria-label={title}>
  <div class="heading"><span class="icon" aria-hidden="true">↑</span><div><h2>{title}</h2><p>CSV, TSV or JSON → saved Budibase query</p></div></div>
  {#if editing}<p class="notice">Configure a write query and parameter mapping, then use Preview or the published app to import.</p>{/if}
  <label class="upload">Choose a UTF-8 file <span>Maximum 5 MiB · 10,000 records</span>
    <input type="file" accept=".csv,.tsv,.json" disabled={disabled || busy || loading || editing} on:change={selectFile} />
  </label>
  {#if loading}<p role="status">Reading file…</p>{/if}
  {#if rows.length}
    <div class="file-info"><strong>{filename}</strong><span>{rows.length.toLocaleString()} records · {columns.length} columns</span></div>
    <div class="table-wrap"><table><caption>Preview: first {Math.min(5, rows.length)} records{columns.length > 10 ? ' (first 10 columns)' : ''}</caption>
      <thead><tr>{#each previewColumns as column}<th>{column}</th>{/each}</tr></thead>
      <tbody>{#each rows.slice(0, 5) as row}<tr>{#each previewColumns as column}<td title={String(row[column] ?? '')}>{row[column] ?? '—'}</td>{/each}</tr>{/each}</tbody>
    </table></div>
    <p class="notice">Each record runs the configured query once. Successful writes remain saved if you stop or an error occurs. Check query parameters before continuing.</p>
    <label class="confirm"><input type="checkbox" bind:checked={confirmed} disabled={busy || disabled || attempted || editing} />I confirm importing {rows.length.toLocaleString()} records into the database.</label>
    <div class="actions"><button class="primary" on:click={startImport} disabled={disabled || busy || attempted || !confirmed || editing}>{busy ? 'Importing…' : 'Import records'}</button>
      {#if busy}<button on:click={() => cancel = true} disabled={cancel}>{cancel ? 'Stopping…' : 'Stop after current record'}</button>{/if}
    </div>
  {/if}
  {#if message}<p class="error" role="alert">{message}</p>{/if}
  {#if result}<div class="result" role="status" aria-live="polite">
    <progress max={result.total} value={result.processed}></progress>
    <strong>{result.succeeded} succeeded · {result.failed} failed · {result.total - result.processed} remaining</strong>
    {#if !busy}<p>{result.cancelled ? 'Stopped.' : result.failed ? 'Finished with errors.' : 'Finished.'} Select a file again to start another import. Repeating successful records may create duplicates.</p>{/if}
    {#if result.errors.length}<ul>{#each result.errors.slice(0, 20) as error}<li>Record {error.record}: {error.message}</li>{/each}</ul>
      {#if result.errors.length > 20}<p>Showing the first 20 errors.</p>{/if}
    {/if}
  </div>{/if}
</section>

<style>
  .importer{font-family:inherit;color:var(--spectrum-global-color-gray-900,#202638);background:var(--spectrum-global-color-gray-50,#fff);border:1px solid #dce2eb;border-radius:12px;padding:24px;box-sizing:border-box;max-width:100%;min-width:0}
  .heading{display:flex;gap:12px;align-items:center;margin-bottom:24px}.icon{background:#ecf0ff;color:#405bc8;border-radius:12px;padding:10px 16px;font-size:24px}h2{font-size:20px;margin:0 0 5px}p{margin:6px 0;line-height:1.5}.heading p,.upload span,.file-info span{color:#657088;font-size:13px}
  .upload{display:flex;flex-direction:column;gap:10px;background:#f7f9fc;border:1px dashed #b8c3d6;padding:20px;border-radius:8px;font-weight:600}.upload span{font-weight:400}input[type=file]{max-width:100%;font:inherit;font-size:13px}.file-info{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;margin:20px 0 12px;overflow-wrap:anywhere}
  .table-wrap{overflow:auto}table{border-collapse:collapse;width:100%;font-size:13px;text-align:left}caption{text-align:left;color:#657088;margin:8px 0}th,td{padding:10px 12px;border-bottom:1px solid #e6eaf1;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}th{background:#f1f4f9}
  .notice{font-size:13px;background:#f4f6fa;padding:12px;border-radius:6px;margin:16px 0;color:#48546a}.confirm{display:flex;align-items:flex-start;gap:8px;font-size:13px;line-height:1.5}.actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:20px}button{border:1px solid #bac4d5;background:#fff;border-radius:6px;padding:10px 16px;font:inherit;font-size:13px;cursor:pointer}.primary{background:#405bc8;color:white;border-color:#405bc8}button:disabled{opacity:.5;cursor:default}button:focus-visible,input:focus-visible{outline:2px solid #405bc8;outline-offset:3px}.error{color:#a62632;overflow-wrap:anywhere}.result{margin-top:20px;font-size:13px;overflow-wrap:anywhere}progress{display:block;width:100%;height:8px;margin-bottom:12px;accent-color:#405bc8}
</style>
