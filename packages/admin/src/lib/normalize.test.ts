import { describe, it, expect } from 'vitest'
import { normalizeNom, normalizePrenom, normalizeEmail, isValidEmail } from './normalize'

describe('normalizeNom', () => {
  it('met en majuscules et supprime les accents', () => {
    expect(normalizeNom('dupont')).toBe('DUPONT')
    expect(normalizeNom('Hébert')).toBe('HEBERT')
    expect(normalizeNom('müller')).toBe('MULLER')
    expect(normalizeNom('Ñoño')).toBe('NONO')
  })

  it('supprime les espaces en début/fin', () => {
    expect(normalizeNom('  martin  ')).toBe('MARTIN')
  })

  it('ne plante pas sur chaîne vide', () => {
    expect(normalizeNom('')).toBe('')
  })
})

describe('normalizePrenom', () => {
  it('met en title case', () => {
    expect(normalizePrenom('jean')).toBe('Jean')
    expect(normalizePrenom('MARIE')).toBe('Marie')
    expect(normalizePrenom('jean-pierre')).toBe('Jean-pierre')
  })

  it('gère les prénoms composés séparés par espace', () => {
    expect(normalizePrenom('anne marie')).toBe('Anne Marie')
    expect(normalizePrenom('  jean   paul  ')).toBe('Jean Paul')
  })

  it('ne plante pas sur chaîne vide', () => {
    expect(normalizePrenom('')).toBe('')
  })
})

describe('normalizeEmail', () => {
  it('met en minuscules et supprime les espaces', () => {
    expect(normalizeEmail('Jean.Dupont@Example.COM')).toBe('jean.dupont@example.com')
    expect(normalizeEmail('  test@test.fr  ')).toBe('test@test.fr')
  })
})

describe('isValidEmail', () => {
  it('accepte les emails valides', () => {
    expect(isValidEmail('a@b.com')).toBe(true)
    expect(isValidEmail('jean.dupont@example.fr')).toBe(true)
    expect(isValidEmail('user+tag@domain.co.uk')).toBe(true)
  })

  it('rejette les emails invalides', () => {
    expect(isValidEmail('')).toBe(false)
    expect(isValidEmail('pasd@')).toBe(false)
    expect(isValidEmail('@domain.com')).toBe(false)
    expect(isValidEmail('user@domain')).toBe(false)
    expect(isValidEmail('pas un email')).toBe(false)
  })
})
