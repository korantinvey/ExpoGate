import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { db } from './db'
import { getPendingPrestaIds, getPendingStandIds } from './db'

beforeEach(async () => {
  await db.prestations.clear()
})

const base = {
  libelle: 'Test',
  prestataire_id: null,
  categorie: null,
  quantite_attendue: 1,
  emplacement_prevu: null,
  ajout_sur_site: false,
  commentaire_prestataire: null,
  statut_conformite: null,
  quantite_constatee: null,
  commentaire: null,
  controleur_id: null,
  date_controle: null,
}

describe('getPendingPrestaIds', () => {
  it('retourne un Set vide si aucun ID fourni', async () => {
    const result = await getPendingPrestaIds([])
    expect(result.size).toBe(0)
  })

  it('retourne uniquement les IDs avec pending_sync=1', async () => {
    await db.prestations.bulkPut([
      { ...base, id: 'p1', stand_id: 's1', pending_sync: 1 },
      { ...base, id: 'p2', stand_id: 's1', pending_sync: 0 },
      { ...base, id: 'p3', stand_id: 's2', pending_sync: 1 },
    ])
    const result = await getPendingPrestaIds(['p1', 'p2', 'p3'])
    expect(result).toEqual(new Set(['p1', 'p3']))
  })

  it('ignore les IDs absents de la base', async () => {
    await db.prestations.put({ ...base, id: 'p1', stand_id: 's1', pending_sync: 1 })
    const result = await getPendingPrestaIds(['p1', 'inexistant'])
    expect(result).toEqual(new Set(['p1']))
  })

  it('retourne un Set vide si aucune prestation est pending', async () => {
    await db.prestations.put({ ...base, id: 'p1', stand_id: 's1', pending_sync: 0 })
    const result = await getPendingPrestaIds(['p1'])
    expect(result.size).toBe(0)
  })
})

describe('getPendingStandIds', () => {
  it('retourne un Set vide si aucun standId fourni', async () => {
    const result = await getPendingStandIds([])
    expect(result.size).toBe(0)
  })

  it('retourne les stand_ids qui ont au moins une prestation pending', async () => {
    await db.prestations.bulkPut([
      { ...base, id: 'p1', stand_id: 's1', pending_sync: 1 },
      { ...base, id: 'p2', stand_id: 's1', pending_sync: 0 },
      { ...base, id: 'p3', stand_id: 's2', pending_sync: 0 },
    ])
    const result = await getPendingStandIds(['s1', 's2'])
    expect(result).toEqual(new Set(['s1']))
  })

  it('déduplique les stand_ids', async () => {
    await db.prestations.bulkPut([
      { ...base, id: 'p1', stand_id: 's1', pending_sync: 1 },
      { ...base, id: 'p2', stand_id: 's1', pending_sync: 1 },
    ])
    const result = await getPendingStandIds(['s1'])
    expect(result).toEqual(new Set(['s1']))
  })
})
