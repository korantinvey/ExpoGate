import Dexie, { type Table } from 'dexie'
import type { ControleStatut } from '../types'

export interface LocalEvenement {
  id: string
  nom: string
  lieu: string | null
  date_debut: string
  date_fin: string
  statut: string
  downloaded_at: string | null
  role_local?: string | null
}

export interface LocalStand {
  id: string
  evenement_id: string
  nom_exposant: string | null
  hall: string | null
  numero: string
  surface: number | null
  angles: number | null
  pending_sync: 0 | 1
}

export interface LocalPrestation {
  id: string
  stand_id: string
  prestataire_id: string | null
  libelle: string
  categorie: string | null
  quantite_attendue: number
  emplacement_prevu: string | null
  ajout_sur_site: boolean
  commentaire_prestataire: string | null
  statut_conformite: ControleStatut | null
  quantite_constatee: number | null
  commentaire: string | null
  controleur_id: string | null
  date_controle: string | null
  anomalie?: boolean
  date_anomalie?: string | null
  date_retour_a_verifier?: string | null
  pending_sync: 0 | 1
}

export interface LocalPhoto {
  id?: number
  prestation_id: string
  blob: Blob
  created_at: string
  synced: 0 | 1
  remote_url: string | null
}

export interface LocalMainCourante {
  id: string
  evenement_id: string
  stand_id: string | null
  titre: string
  descriptif: string | null
  etat: string
  created_at: string
  created_by: string | null
  pending_sync: 0 | 1
}

export interface LocalMcPhoto {
  id?: number
  main_courante_id: string
  blob: Blob
  created_at: string
  synced: 0 | 1
  remote_url: string | null
}

export interface LocalPrestataire {
  id: string
  raison_sociale: string
  email_contact: string | null
  telephone: string | null
}

export interface LocalPendingNotification {
  prestation_id: string
}

class ExpoGateDB extends Dexie {
  evenements!: Table<LocalEvenement, string>
  stands!: Table<LocalStand, string>
  prestations!: Table<LocalPrestation, string>
  photos!: Table<LocalPhoto, number>
  main_courante!: Table<LocalMainCourante, string>
  mc_photos!: Table<LocalMcPhoto, number>
  prestataires!: Table<LocalPrestataire, string>
  pending_notifications!: Table<LocalPendingNotification, string>

  constructor() {
    super('expogate')
    this.version(1).stores({
      evenements: 'id',
      stands: 'id, evenement_id',
      prestations: 'id, stand_id, pending_sync',
      photos: '++id, prestation_id, synced',
    })
    this.version(2).stores({
      main_courante: 'id, evenement_id, pending_sync',
      mc_photos: '++id, main_courante_id, synced',
    })
    this.version(3).stores({
      stands: 'id, evenement_id, pending_sync',
    })
    this.version(4).stores({
      prestataires: 'id',
    })
    this.version(5).stores({
      pending_notifications: 'prestation_id',
    })
  }
}

export const db = new ExpoGateDB()

export async function getPendingPrestaIds(ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set()
  const rows = await db.prestations.where('id').anyOf(ids).filter(p => p.pending_sync === 1).toArray()
  return new Set(rows.map(p => p.id))
}

export async function getPendingStandIds(standIds: string[]): Promise<Set<string>> {
  if (!standIds.length) return new Set()
  const [prestRows, standRows] = await Promise.all([
    db.prestations.where('stand_id').anyOf(standIds).filter(p => p.pending_sync === 1).toArray(),
    db.stands.where('id').anyOf(standIds).filter(s => s.pending_sync === 1).toArray(),
  ])
  return new Set([...prestRows.map(p => p.stand_id), ...standRows.map(s => s.id)])
}
