import { Download } from 'lucide-react'

interface Props {
  onClick: (() => void) | null | undefined
  title?: string
}

export function ExportButton({ onClick, title = 'Exporter en Excel' }: Props) {
  return (
    <button
      className="btn btn-secondary btn-sm"
      onClick={() => onClick?.()}
      title={title}
      disabled={!onClick}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
    >
      <Download size={14} />
      Export
    </button>
  )
}
