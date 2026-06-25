export function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  const [y, m, j] = d.split('-')
  return `${j}/${m}/${y}`
}
