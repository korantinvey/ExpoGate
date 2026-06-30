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

class ExpoGateDB extends Dexie {
  evenements!: Table<LocalEvenement, string>
  stands!: Table<LocalStand, string>
  prestations!: Table<LocalPrestation, string>
  photos!: Table<LocalPhoto, number>
  main_courante!: Table<LocalMainCourante, string>
  mc_photos!: Table<LocalMcPhoto, number>

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
  }
}

export const db = new ExpoGateDB()
