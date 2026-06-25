export function normalizeNom(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .trim()
}

export function normalizePrenom(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

export function normalizeEmail(s: string): string {
  return s.toLowerCase().trim()
}

export function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}
