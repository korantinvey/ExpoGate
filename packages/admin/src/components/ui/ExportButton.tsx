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
      style={{ padding: '6px 8px', lineHeight: 1 }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
        <rect x="1" y="1" width="14" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.2" fill="none"/>
        <line x1="1" y1="5.5" x2="15" y2="5.5" stroke="currentColor" strokeWidth="1.2"/>
        <line x1="1" y1="9.5" x2="15" y2="9.5" stroke="currentColor" strokeWidth="1.2"/>
        <line x1="5.5" y1="5.5" x2="5.5" y2="15" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M10 7.5 L10 12 M10 12 L8.5 10.5 M10 12 L11.5 10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  )
}
