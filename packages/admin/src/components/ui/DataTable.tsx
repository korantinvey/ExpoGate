import { useState, useMemo, useRef, useEffect } from 'react'
import * as XLSX from 'xlsx'

const isMobile = () => window.innerWidth <= 768

const deburr = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')

export interface Column<T> {
  key: string
  label: string
  sortable?: boolean
  filterable?: boolean
  hideOnMobile?: boolean
  options?: { value: string; label: string }[]
  render?: (row: T) => React.ReactNode
  getValue?: (row: T) => string
}

interface Props<T> {
  columns: Column<T>[]
  data: T[]
  onRowClick?: (row: T) => void
  rowStyle?: (row: T) => React.CSSProperties | undefined
  emptyState?: React.ReactNode
  exportFilename?: string
  onExportReady?: (fn: () => void) => void
}

type SortDir = 'asc' | 'desc' | null

function getVal<T>(row: T, col: Column<T>): string {
  if (col.getValue) return col.getValue(row)
  const v = (row as Record<string, unknown>)[col.key]
  return v == null ? '' : String(v)
}

function TextFilterPopover({ value, onChange, onClose }: { value: string; onChange: (v: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    inputRef.current?.focus()
    function handler(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  return (
    <div ref={ref} style={popoverStyle} onClick={e => e.stopPropagation()}>
      <input ref={inputRef} value={value} onChange={e => onChange(e.target.value)} placeholder="Filtrer…"
        style={{ width: '100%', padding: '5px 8px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 4 }} />
      {value && <ClearBtn onClick={() => onChange('')} />}
    </div>
  )
}

function PicklistFilterPopover({ options, selected, onChange, onClose }: { options: { value: string; label: string }[]; selected: string[]; onChange: (v: string[]) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handler(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])
  function toggle(value: string) { onChange(selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value]) }
  return (
    <div ref={ref} style={{ ...popoverStyle, minWidth: 180 }} onClick={e => e.stopPropagation()}>
      {options.map(opt => (
        <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px', cursor: 'pointer', borderRadius: 4, fontSize: 13 }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')} onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
          <input type="checkbox" checked={selected.includes(opt.value)} onChange={() => toggle(opt.value)} style={{ width: 'auto', margin: 0, cursor: 'pointer' }} />
          {opt.label}
        </label>
      ))}
      {selected.length > 0 && <ClearBtn onClick={() => onChange([])} />}
    </div>
  )
}

function ClearBtn({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Effacer</button>
}

const popoverStyle: React.CSSProperties = {
  position: 'absolute', top: '100%', left: 0, zIndex: 50,
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: '8px', marginTop: 4,
}

export function DataTable<T extends { id?: string }>({ columns, data, onRowClick, rowStyle, emptyState, exportFilename, onExportReady }: Props<T>) {
  const mobile = isMobile()
  const visibleColumns = useMemo(() => mobile ? columns.filter(c => !c.hideOnMobile) : columns, [columns, mobile])
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)
  const [textFilters, setTextFilters] = useState<Record<string, string>>({})
  const [pickFilters, setPickFilters] = useState<Record<string, string[]>>({})
  const [openFilter, setOpenFilter] = useState<string | null>(null)

  // Stabiliser la référence columns pour ne pas retrigger processed/onExportReady à chaque render parent
  const columnsRef = useRef(columns)
  columnsRef.current = columns

  function toggleSort(key: string) {
    if (sortKey !== key) { setSortKey(key); setSortDir('asc'); return }
    if (sortDir === 'asc') { setSortDir('desc'); return }
    setSortKey(null); setSortDir(null)
  }

  const processed = useMemo(() => {
    const cols = columnsRef.current
    let rows = [...data]
    for (const col of cols) {
      if (col.options) {
        const sel = pickFilters[col.key] ?? []
        if (sel.length) rows = rows.filter(r => sel.includes(getVal(r, col)))
      } else {
        const q = deburr((textFilters[col.key] ?? '').trim().toLowerCase())
        if (q) rows = rows.filter(r => deburr(getVal(r, col).toLowerCase()).includes(q))
      }
    }
    if (sortKey && sortDir) {
      const col = cols.find(c => c.key === sortKey)
      if (col) rows.sort((a, b) => { const va = getVal(a, col), vb = getVal(b, col); return sortDir === 'asc' ? va.localeCompare(vb, 'fr') : vb.localeCompare(va, 'fr') })
    }
    return rows
  }, [data, textFilters, pickFilters, sortKey, sortDir])

  const onExportReadyRef = useRef(onExportReady)
  onExportReadyRef.current = onExportReady

  useEffect(() => {
    if (!onExportReadyRef.current) return
    const exportCols = columns.filter(c => c.label.trim() !== '')
    onExportReadyRef.current(() => {
      const headers = exportCols.map(c => c.label)
      const rows = processed.map(row => exportCols.map(col => getVal(row, col)))
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Export')
      XLSX.writeFile(wb, `${exportFilename ?? 'export'}.xlsx`)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processed, exportFilename])

  return (
    <table>
      <thead>
        <tr>
          {visibleColumns.map(col => {
            const isPicklist = !!col.options
            const isFiltered = isPicklist ? (pickFilters[col.key]?.length ?? 0) > 0 : !!(textFilters[col.key]?.trim())
            return (
              <th key={col.key} style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, userSelect: 'none' }}>
                  {col.sortable ? (
                    <button onClick={() => toggleSort(col.key)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {col.label}
                      <span style={{ fontSize: 10, opacity: sortKey === col.key ? 1 : 0.3 }}>{sortKey === col.key && sortDir === 'desc' ? '▼' : '▲'}</span>
                    </button>
                  ) : <span>{col.label}</span>}
                  {col.filterable && (
                    <button onClick={e => { e.stopPropagation(); setOpenFilter(openFilter === col.key ? null : col.key) }} title="Filtrer"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '1px 3px', borderRadius: 4, lineHeight: 1, fontSize: 12, color: isFiltered ? 'var(--accent)' : 'var(--text-muted)', backgroundColor: isFiltered ? 'var(--accent-light)' : 'transparent' }}>
                      {isFiltered ? '⊘' : '⌕'}
                    </button>
                  )}
                </div>
                {col.filterable && openFilter === col.key && (
                  isPicklist
                    ? <PicklistFilterPopover options={col.options!} selected={pickFilters[col.key] ?? []} onChange={v => setPickFilters(f => ({ ...f, [col.key]: v }))} onClose={() => setOpenFilter(null)} />
                    : <TextFilterPopover value={textFilters[col.key] ?? ''} onChange={v => setTextFilters(f => ({ ...f, [col.key]: v }))} onClose={() => setOpenFilter(null)} />
                )}
              </th>
            )
          })}
        </tr>
      </thead>
      <tbody>
        {processed.length === 0 ? (
          <tr><td colSpan={visibleColumns.length}>{emptyState ?? <div className="empty-state">Aucun résultat.</div>}</td></tr>
        ) : processed.map((row, i) => (
          <tr key={(row as Record<string, unknown>).id as string ?? i} onClick={() => onRowClick?.(row)} style={{ ...(onRowClick ? { cursor: 'pointer' } : {}), ...rowStyle?.(row) }}>
            {visibleColumns.map(col => <td key={col.key}>{col.render ? col.render(row) : getVal(row, col) || '—'}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
