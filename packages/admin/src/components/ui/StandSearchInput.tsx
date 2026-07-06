import React from 'react'

interface StandOption {
  id: string
  numero: string
  nom_exposant: string | null
  hall?: string | null
}

interface StandSearchInputProps {
  stands: StandOption[]
  search: string
  standId: string
  onSearchChange: (search: string) => void
  onSelect: (id: string, label: string) => void
  onClear?: () => void
  readOnly?: boolean
  optional?: boolean
}

export function standLabel(s: { numero: string; nom_exposant?: string | null }) {
  return `${s.numero}${s.nom_exposant ? ` — ${s.nom_exposant}` : ''}`
}

const roStyle: React.CSSProperties = { background: 'var(--bg)', color: 'var(--text-muted)', cursor: 'not-allowed' }

export function StandSearchInput({ stands, search, standId, onSearchChange, onSelect, onClear, readOnly, optional }: StandSearchInputProps) {
  return (
    <div className="form-group" style={{ position: 'relative' }}>
      <label>
        Stand{optional && <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 12 }}> (optionnel)</span>}
      </label>
      <input
        value={search}
        onChange={e => { if (!readOnly) { onSearchChange(e.target.value) } }}
        placeholder="Rechercher par numéro ou nom d'exposant…"
        autoComplete="off"
        readOnly={readOnly}
        style={readOnly ? roStyle : undefined}
      />
      {search && !standId && !readOnly && (() => {
        const q = search.toLowerCase()
        const filtered = stands.filter(s =>
          s.numero.toLowerCase().includes(q) ||
          (s.nom_exposant ?? '').toLowerCase().includes(q)
        )
        return filtered.length > 0 ? (
          <div style={{ position: 'absolute', zIndex: 100, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', width: '100%', maxHeight: 200, overflowY: 'auto', top: '100%', left: 0 }}>
            {filtered.map(s => (
              <div key={s.id}
                style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13 }}
                onMouseDown={() => onSelect(s.id, standLabel(s))}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                <strong>{s.numero}</strong>{s.nom_exposant ? ` — ${s.nom_exposant}` : ''}
                {s.hall ? <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: 11 }}>Hall {s.hall}</span> : null}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ position: 'absolute', zIndex: 100, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 13, color: 'var(--text-muted)', width: '100%', top: '100%', left: 0 }}>
            Aucun stand trouvé
          </div>
        )
      })()}
      {standId && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--success)' }}>✓ Stand sélectionné</span>
          {onClear && (
            <button type="button" style={{ fontSize: 11, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }} onClick={onClear}>
              ✕ Dissocier
            </button>
          )}
        </div>
      )}
    </div>
  )
}
