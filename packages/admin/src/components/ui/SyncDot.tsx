export function SyncDot({ pending }: { pending: boolean }) {
  return (
    <span
      title={pending ? 'En attente de synchronisation' : 'Synchronisé'}
      style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: pending ? '#f97316' : '#22c55e' }}
    />
  )
}
