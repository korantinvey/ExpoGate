import { describe, it, expect } from 'vitest'
import { fmtDate } from './format'

describe('fmtDate', () => {
  it('convertit YYYY-MM-DD en DD/MM/YYYY', () => {
    expect(fmtDate('2025-03-15')).toBe('15/03/2025')
    expect(fmtDate('2024-01-01')).toBe('01/01/2024')
    expect(fmtDate('2026-12-31')).toBe('31/12/2026')
  })

  it('retourne — pour les valeurs nulles/vides', () => {
    expect(fmtDate(null)).toBe('—')
    expect(fmtDate(undefined)).toBe('—')
    expect(fmtDate('')).toBe('—')
  })
})
