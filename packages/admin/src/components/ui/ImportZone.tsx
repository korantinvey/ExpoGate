import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { UploadCloud } from 'lucide-react'

interface Props {
  expectedCols: string[]
  colLabels?: Record<string, string>
  onRows: (rows: Record<string, unknown>[]) => void
}

function mapRows(
  rawRows: Record<string, unknown>[],
  mapping: Record<string, string>,
  expectedCols: string[],
): Record<string, unknown>[] {
  return rawRows.map(row => {
    const out: Record<string, unknown> = {}
    for (const col of expectedCols) {
      const fileCol = mapping[col]
      out[col] = fileCol ? (row[fileCol] ?? '') : ''
    }
    return out
  })
}

function autoDetect(fileCols: string[], expectedCols: string[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (const col of expectedCols) {
    const match = fileCols.find(fc => fc.toLowerCase().trim() === col.toLowerCase().trim())
    result[col] = match ?? ''
  }
  return result
}

export function ImportZone({ expectedCols, colLabels, onRows }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [fileColumns, setFileColumns] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})

  async function handle(file: File) {
    setFileName(file.name)
    setError('')
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
      const fileCols = rows.length > 0 ? Object.keys(rows[0]) : []
      const map = autoDetect(fileCols, expectedCols)
      setFileColumns(fileCols)
      setRawRows(rows)
      setMapping(map)
      onRows(mapRows(rows, map, expectedCols))
    } catch (err: unknown) {
      setError(`Impossible de lire ce fichier : ${err instanceof Error ? err.message : String(err)}`)
      onRows([])
    }
  }

  function updateMapping(col: string, fileCol: string) {
    const newMap = { ...mapping, [col]: fileCol }
    setMapping(newMap)
    onRows(mapRows(rawRows, newMap, expectedCols))
  }

  const preview = mapRows(rawRows.slice(0, 5), mapping, expectedCols)
  const label = (col: string) => colLabels?.[col] ?? col

  return (
    <div>
      <div
        className={`import-zone${dragging ? ' dragover' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handle(f) }}
      >
        <div className="import-icon"><UploadCloud size={32} strokeWidth={1.5} /></div>
        <div className="import-text">
          Glissez votre fichier Excel ou CSV ici, ou <strong>cliquez pour choisir</strong>
        </div>
        {fileName && <div style={{ marginTop: 8, fontSize: 13, color: 'var(--accent-dark)' }}>{fileName}</div>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handle(f) }}
      />

      {error && <div className="alert alert-error" style={{ marginTop: 12 }}>{error}</div>}

      {rawRows.length > 0 && (
        <div style={{ marginTop: 16 }}>
          {/* Mapping */}
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
            Associez les colonnes de votre fichier aux champs attendus :
          </div>
          <table style={{ width: '100%', fontSize: 13, marginBottom: 16, borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '4px 12px 6px 0', color: 'var(--text-muted)', fontWeight: 500, width: '45%' }}>Champ</th>
                <th style={{ textAlign: 'left', padding: '4px 0 6px', color: 'var(--text-muted)', fontWeight: 500 }}>Colonne du fichier</th>
              </tr>
            </thead>
            <tbody>
              {expectedCols.map(col => {
                const mapped = mapping[col] ?? ''
                const autoMatched = mapped !== '' && mapped.toLowerCase().trim() === col.toLowerCase().trim()
                return (
                  <tr key={col}>
                    <td style={{ padding: '4px 12px 4px 0', fontWeight: 500 }}>{label(col)}</td>
                    <td style={{ padding: '4px 0' }}>
                      <select
                        value={mapped}
                        onChange={e => updateMapping(col, e.target.value)}
                        style={{ fontSize: 13, padding: '3px 6px', borderColor: mapped && !autoMatched ? 'var(--accent)' : undefined }}
                      >
                        <option value="">— Ne pas importer —</option>
                        {fileColumns.map(fc => (
                          <option key={fc} value={fc}>{fc}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Preview */}
          {preview.length > 0 && (
            <>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                Aperçu ({preview.length} lignes) :
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>{expectedCols.map(c => <th key={c}>{label(c)}</th>)}</tr>
                  </thead>
                  <tbody>
                    {preview.map((r, i) => (
                      <tr key={i}>{expectedCols.map(c => <td key={c}>{String(r[c] ?? '')}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
