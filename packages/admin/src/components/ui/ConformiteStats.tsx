interface ConformiteStatsProps {
  nbStands: number
  nbNonVerif: number
  nbConforme: number
  nbNonConforme: number
  nbAbsent: number
  emptyMessage: string
  marginTop?: number
}

export function ConformiteStats({ nbStands, nbNonVerif, nbConforme, nbNonConforme, nbAbsent, emptyMessage, marginTop = 20 }: ConformiteStatsProps) {
  if (nbStands === 0) return <div className="empty-state">{emptyMessage}</div>

  return (
    <div style={{ display: 'flex', gap: 12, marginTop, flexWrap: 'wrap' }}>
      {[
        { val: nbStands, label: `Stand${nbStands > 1 ? 's' : ''}`, bg: 'var(--surface)', border: 'var(--border)', color: 'var(--text)', muted: 'var(--text-muted)' },
        { val: nbNonVerif, label: `Non vérifiée${nbNonVerif > 1 ? 's' : ''}`, bg: 'var(--surface)', border: 'var(--border)', color: 'var(--text-muted)', muted: 'var(--text-muted)' },
        { val: nbConforme, label: `Conforme${nbConforme > 1 ? 's' : ''}`, bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.25)', color: 'var(--success)', muted: 'var(--success)' },
        { val: nbNonConforme, label: `Non conforme${nbNonConforme > 1 ? 's' : ''}`, bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.25)', color: '#f97316', muted: '#f97316' },
        { val: nbAbsent, label: `Absent${nbAbsent > 1 ? 's' : ''}`, bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.25)', color: 'var(--danger)', muted: 'var(--danger)' },
      ].map(({ val, label, bg, border, color, muted }) => (
        <div key={label} style={{ flex: 1, minWidth: 140, background: bg, border: `1px solid ${border}`, borderRadius: 'var(--radius)', padding: '20px 24px' }}>
          <div style={{ fontSize: 36, fontWeight: 700, color }}>{val}</div>
          <div style={{ fontSize: 12, color: muted, marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.04em', opacity: 0.8 }}>{label}</div>
        </div>
      ))}
    </div>
  )
}
