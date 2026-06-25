import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'

interface Props {
  expectedCols: string[]
  onRows: (rows: Record<string, unknown>[]) => void
}

export function ImportZone({ expectedCols, onRows }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<Record<string, unknown>[]>([])
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)

  async function handle(file: File) {
    setFileName(file.name)
    setError('')
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
      setPreview(rows.slice(0, 5))
      onRows(rows)
    } catch (err: unknown) {
      setError(`Impossible de lire ce fichier : ${err instanceof Error ? err.message : String(err)}`)
      onRows([])
    }
  }

  return (
    <div>
      <div
        className={`import-zone${dragging ? ' dragover' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handle(f) }}
      >
        <div className="import-icon">↑</div>
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
      {preview.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="text-muted" style={{ marginBottom: 8 }}>Aperçu ({preview.length} lignes) :</div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr>{expectedCols.map(c => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i}>{expectedCols.map(c => <td key={c}>{String(r[c] ?? '')}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
