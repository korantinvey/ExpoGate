export function Alert({ message, type = 'error' }: { message: string; type?: 'error' | 'success' }) {
  if (!message) return null
  return <div className={`alert alert-${type}`}>{message}</div>
}
