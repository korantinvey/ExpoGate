import { Upload } from 'lucide-react'

interface Props {
  onClick: () => void
  label?: string
}

export function ImportButton({ onClick, label = 'Importer' }: Props) {
  return (
    <button
      className="btn btn-secondary btn-sm"
      onClick={onClick}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
    >
      <Upload size={14} />
      {label}
    </button>
  )
}
