# Projet Conformité Événements — Contexte Claude Code

## Résumé du projet
Application de gestion de conformité pour organisateurs de salons/expositions.
Permet de vérifier sur le terrain que les stands sont correctement montés et équipés.

## Architecture — 3 composants

### 1. App mobile (React Native + Expo)
- Utilisée **sur le terrain** par les contrôleurs
- Liste des événements → liste des stands → liste des prestations → contrôle
- Pour chaque prestation : statut (conforme/non conforme/absent/à vérifier), quantité constatée, commentaire, photo
- **Offline obligatoire** : certains parcs expo n'ont pas de réseau. Stockage local SQLite + queue de sync automatique au retour réseau
- Optimisée pour appareils anciens et d'entrée de gamme
- Sélection de salon à la connexion : si un seul salon actif → chargement auto, si plusieurs → écran de sélection avec possibilité de changer

### 2. Back-office organisateur (React)
- Tableau de bord : vue globale de la conformité d'un événement
- Suivi des mains courantes (historique des contrôles, filtres, statuts)
- Détail par stand : photos, statuts, prestataires

### 3. Back-office admin (React)
- **DÉJÀ DÉVELOPPÉ** en HTML/JS vanilla (fichier admin.html)
- Gestion événements (CRUD + statuts)
- Fiche événement à onglets : Détails / Stands / Prestations / Accès
- Import stands et prestations via Excel (.xlsx) ou CSV — librairie SheetJS
- Modèles Excel téléchargeables générés dynamiquement
- Gestion utilisateurs (création via Supabase Auth Admin API)
- Gestion prestataires + annuaire des intervenants (prestataire_contacts)
- Gestion des accès par événement avec filtrage des intervenants par société

## Stack technique
- **Frontend** : React + Vite (back-offices) / React Native + Expo (mobile)
- **Backend** : Supabase (PostgreSQL + Auth + Storage + RLS)
- **Import/Export** : SheetJS (xlsx.js)
- **Emails** : à intégrer (Resend ou SendGrid) pour notifications non-conformité

## Credentials Supabase
```
SUPABASE_URL=https://fhelmytyygtgbhnnpuml.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoZWxteXR5eWd0Z2Jobm5wdW1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MTQwNzYsImV4cCI6MjA5NzM5MDA3Nn0.DOcL6XLjNBHLtgvFYpwhpcKP8HH7JWR0lLLAY1yh7n0
SUPABASE_SERVICE_ROLE=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZoZWxteXR5eWd0Z2Jobm5wdW1sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTgxNDA3NiwiZXhwIjoyMDk3MzkwMDc2fQ.NvNIEegBbFS9sbdDDE1KFTJdZwB8udk_e-oUndMIWWo
```

## Schéma de base de données (déjà en production sur Supabase)

### Tables

**users**
- id (uuid, PK, lié à auth.users)
- email, nom, prenom (text)
- is_admin (boolean) — flag admin plateforme, pas de rôle global
- created_at

**prestataires** — sociétés intervenantes, globales (réutilisables sur plusieurs événements)
- id, raison_sociale, email_contact, telephone, created_at

**prestataire_contacts** — annuaire global : qui travaille pour quelle société
- id, user_id (FK users), prestataire_id (FK prestataires)
- unique(user_id, prestataire_id)
- Ne donne PAS accès à un événement — c'est juste un répertoire

**evenements**
- id, nom, lieu, date_debut, date_fin
- statut : 'parametrage' | 'actif' | 'termine'
  - parametrage → invisible pour tous sauf admin
  - actif → visible pour tous les users ayant accès
  - termine → visible uniquement admin + organisateurs en BO, invisible app mobile

**user_evenements** — table fusionnée (accès + rôle + lien prestataire)
- id, user_id (FK), evenement_id (FK), role_local, prestataire_id (FK, nullable)
- role_local : 'organisateur' | 'controleur' | 'prestataire'
- prestataire_id : obligatoire si role_local = 'prestataire', null sinon
- unique(user_id, evenement_id)
- Logique notification : WHERE evenement_id = X AND prestataire_id = Y → notifie tous ces users

**stands**
- id, evenement_id (FK), numero, nom_exposant, hall, emplacement
- unique(evenement_id, numero)

**prestations** — équipement attendu sur un stand
- id, stand_id (FK), prestataire_id (FK prestataires — la SOCIÉTÉ, pas un individu)
- libelle, categorie, quantite_attendue, emplacement_prevu

**controles** — saisie terrain du contrôleur
- id, prestation_id (FK), controleur_id (FK users)
- statut : 'conforme' | 'non_conforme' | 'absent' | 'a_verifier'
- quantite_constatee, commentaire, created_at
- synced (boolean) — false = créé hors ligne, pas encore envoyé

**photos** — liées à un contrôle
- id, controle_id (FK)
- url (Supabase Storage, après sync), url_local (chemin device, avant sync)
- synced (boolean), prise_le
- constraint : url OR url_local doit être non null

**notifications**
- id, controle_id (FK), destinataire_id (FK users)
- type : 'non_conformite' | 'rappel'
- statut : 'en_attente' | 'envoyee' | 'echec'
- envoyee_le

### Règles métier importantes
- RLS activé sur toutes les tables
- Fonctions helper : is_admin(), role_sur_evenement(uuid)
- Trigger on_auth_user_created → crée automatiquement public.users à l'inscription
- Index partiels sur synced = false (perf offline sync)

## État d'avancement

### ✅ Fait
- Schéma SQL complet en production (schema.sql + migration_v2.sql)
- Back-office admin (admin.html) — HTML/JS vanilla, fonctionne en ouvrant le fichier dans un navigateur
  - Auth Supabase
  - CRUD événements avec statuts
  - Fiche événement à onglets (Détails / Stands / Prestations / Accès)
  - Import Excel/CSV stands et prestations avec SheetJS
  - Modèles Excel téléchargeables
  - Gestion utilisateurs (création Supabase Auth)
  - Gestion prestataires + annuaire intervenants
  - Gestion accès par événement (filtrage intervenants par société)

### 🔲 À faire
1. **Migrer admin.html en React** (composants, routing, .env pour les clés)
2. **Back-office organisateur** (React)
   - Tableau de bord conformité temps réel
   - Mains courantes avec filtres
   - Détail stand/prestation avec photos
3. **App mobile** (React Native + Expo)
   - Auth + sélection événement
   - Navigation événement → stand → prestation
   - Formulaire de contrôle (statut, quantité, commentaire)
   - Capture photo
   - Stockage offline SQLite + queue de sync
   - Resync automatique au retour réseau
4. **Notifications email** prestataire sur non-conformité (Resend)
5. **Supabase Edge Function** pour l'envoi des emails (côté serveur, service_role)

## Structure de projet recommandée
```
conformite-evenements/
├── packages/
│   ├── admin/          # Back-office admin (React + Vite)
│   ├── organisateur/   # Back-office organisateur (React + Vite)
│   └── mobile/         # App mobile (React Native + Expo)
├── supabase/
│   ├── schema.sql
│   ├── migration_v2.sql
│   └── functions/      # Edge functions (notifications email)
├── admin.html          # Version vanilla déjà fonctionnelle (référence)
└── CONTEXT.md          # Ce fichier
```

## Conventions de code
- Composants React en TypeScript
- Supabase client initialisé une seule fois et exporté
- Variables d'environnement dans .env (jamais de clés en dur)
- Nommage snake_case pour les colonnes BDD, camelCase pour le JS/TS

## Premier message suggéré pour Claude Code
"Lis CONTEXT.md et commence par scaffolder la structure monorepo du projet,
puis migre admin.html en application React + Vite avec React Router,
en extrayant les composants et en mettant les clés Supabase dans .env"
