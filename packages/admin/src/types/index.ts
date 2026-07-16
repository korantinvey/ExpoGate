export type EvenementStatut = 'parametrage' | 'actif' | 'termine'
export type RoleLocal = 'organisateur' | 'controleur' | 'prestataire'
export type ControleStatut = 'conforme' | 'non_conforme' | 'absent' | 'a_verifier'
export type McEtat = 'a_traiter' | 'pris_en_charge' | 'resolu'

export interface Evenement {
  id: string
  nom: string
  lieu: string | null
  date_debut: string
  date_fin: string
  statut: EvenementStatut
  created_at: string
}

export interface User {
  id: string
  email: string
  nom: string
  prenom: string
  is_admin: boolean
  created_at: string
  last_sign_in_at?: string | null
}

export interface Prestataire {
  id: string
  raison_sociale: string
  email_contact: string | null
  telephone: string | null
  created_at: string
}

export interface PrestataireContact {
  id: string
  user_id: string
  prestataire_id: string
  users?: Pick<User, 'id' | 'nom' | 'prenom' | 'email'>
}

export interface Stand {
  id: string
  evenement_id: string
  nom_exposant: string | null
  hall: string | null
  numero: string
  surface: number | null
  angles: number | null
  deleted?: boolean
}

export interface Prestation {
  id: string
  stand_id: string
  prestataire_id: string | null
  libelle: string
  categorie: string | null
  quantite_attendue: number
  emplacement_prevu: string | null
  ajout_sur_site: boolean
  // Conformité
  statut_conformite: ControleStatut | null
  quantite_constatee: number | null
  commentaire: string | null
  commentaire_prestataire: string | null
  controleur_id: string | null
  date_controle: string | null
  // Suivi anomalies
  anomalie: boolean
  date_anomalie: string | null
  date_retour_a_verifier: string | null
  deleted?: boolean
  // Jointures
  stands?: Pick<Stand, 'numero' | 'nom_exposant'>
  prestataires?: Pick<Prestataire, 'raison_sociale'>
  users?: Pick<User, 'nom' | 'prenom'>
}

export interface Photo {
  id: string
  prestation_id: string
  url: string | null
  url_local: string | null
  synced: boolean
  prise_le: string
}

export interface MainCourante {
  id: string
  evenement_id: string
  stand_id: string | null
  titre: string
  descriptif: string | null
  etat: McEtat
  created_at: string
  created_by: string | null
  pending_sync?: 0 | 1
  // Jointures
  stands?: Pick<Stand, 'numero' | 'nom_exposant'> | null
  users?: Pick<User, 'nom' | 'prenom'> | null
  photos?: { id: string; url: string }[]
}

export interface EvenementAvecRole extends Evenement {
  role_local: RoleLocal
}

export interface ControleurStand {
  id: string
  user_evenement_id: string
  stand_id: string
  stands?: Pick<Stand, 'numero' | 'nom_exposant' | 'hall'>
}

export interface UserEvenement {
  id: string
  user_id: string
  evenement_id: string
  role_local: RoleLocal
  prestataire_id: string | null
  users?: Pick<User, 'nom' | 'prenom' | 'email'>
  prestataires?: Pick<Prestataire, 'raison_sociale'>
}
