# INDEX — ExpoGate codebase

Référence rapide pour navigation dans le code. À mettre à jour à chaque ajout majeur.

---

## Arborescence packages/admin/src

```
App.tsx                          Routes + AuthProvider + push-banner (142 l.)
main.tsx                         Point d'entrée Vite
index.css                        Styles globaux (variables CSS, classes utilitaires)
sw.ts                            Service Worker (Workbox)

types/
  index.ts                       Toutes les interfaces métier (103 l.)
                                 Evenement · Stand · Prestation · User · Prestataire
                                 PrestataireContact · UserEvenement · MainCourante · Photo

lib/
  supabase.ts       L.1          sb (anon) + sbAdmin (service role)
  db.ts             L.1          Dexie IndexedDB — LocalEvenement/Stand/Prestation/Photo
  sync.ts           L.1          downloadEvent() · syncPending() · getPendingCount()
  format.ts                      fmtDate(s: string) → string
  normalize.ts                   normalizeNom/Prenom/Email · isValidEmail
  compressImage.ts               compressImage(file) → Blob (canvas resize)
  excel.ts                       downloadTemplate() — import XLSX

hooks/
  useAuth.tsx                    useAuth() → { user, loading } ; AuthProvider
  useMessages.ts                 Messages temps réel (Supabase realtime)
  usePushNotifications.ts        Web Push (VAPID) — requestPermission()
  useTheme.ts                    ThemeContext · useThemeProvider()

components/
  Layout.tsx                     Sidebar + outlet (vue admin)
  LayoutOrganisateur.tsx         Header + outlet (vue orga/presta)
  AppHeader.tsx                  Barre du haut (titre, userMenu)
  Sidebar.tsx                    Nav latérale admin
  UserMenu.tsx                   Déconnexion + réglages
  NotifDropdown.tsx              Cloche notifications
  PrestatairesPanel.tsx          Panel latéral recherche prestataires
  SettingsModal.tsx              Préférences (thème…)
  LogoExpogate.tsx               SVG logo

  ui/
    Alert.tsx                    <Alert type="error|success|info"> message </Alert>
    Badge.tsx                    <Badge statut={ev.statut} />
    DataTable.tsx                <DataTable columns rows onRowClick … /> (190 l.)
    DateInput.tsx                Picker date FR (107 l.)
    ExportButton.tsx             Bouton export CSV/XLS
    ImportZone.tsx               Drag-and-drop import (72 l.)
    Modal.tsx                    <Modal title onClose> children </Modal> (42 l.)
    Spinner.tsx                  <Spinner />
    Toast.tsx                    useToast() → { showToast } (33 l.)

pages/
  LoginPage.tsx                  Formulaire connexion (90 l.)
  SetPasswordPage.tsx            Changement de mot de passe forcé (49 l.)
  DashboardPage.tsx              Stats globales admin (212 l.)
  EvenementsPage.tsx             Liste événements admin (137 l.)
  EvenementsOrganisateurPage.tsx Liste événements orga (123 l.)
  UtilisateursPage.tsx           Gestion utilisateurs (199 l.)
  PrestatairesPage.tsx           Gestion prestataires (171 l.)

  FicheEvenementPage.tsx         Vue admin d'un événement (1418 l.)
    L.23   EvenementForm
    L.60   TabDetails
    L.76   StandForm
    L.116  ImportStandsModal
    L.151  StandPrestationsModal
    L.224  TabStands
    L.356  PrestationForm
    L.635  ImportPrestationsModal
    L.688  TabPrestations
    L.788  AddUserToEventModal
    L.895  EditAccesModal
    L.939  UserAccesList / L.1011 TabUtilisateurs
    L.1016 PrestataireDetailModal / L.1154 TabPrestataires
    L.1241 TabDashboard
    L.1365 type Tab (dashboard|details|stands|prestations|prestataires|utilisateurs|main_courante)
    L.1367 export FicheEvenementPage

  FicheEvenementOrganisateurPage.tsx  Vue orga/presta d'un événement (1676 l.)
    L.25   EvenementForm
    L.61   TabDetails (avec onEdit)
    L.81   StandForm
    L.121  ImportStandsModal
    L.157  StandPrestationsModal
    L.228  TabStands
    L.345  PrestationForm (+ readOnly mode presta + offline save)
    L.692  ImportPrestationsModal
    L.739  TabPrestations
    L.834  AddUserToEventModal
    L.916  EditAccesModal
    L.960  UserAccesList / L.1025 TabUtilisateurs
    L.1030 EditMembreModal / L.1054 PrestataireDetailModal / L.1187 TabPrestataires
    L.1267 TabDashboard
    L.1421 type Tab (dashboard|details|stands|prestations|prestataires|utilisateurs|main_courante)
    L.1423 export VueOrganisateur
    L.1460 export VuePrestataire
    L.1630 export FicheEvenementOrganisateurPage

  TabMainCourante.tsx            Onglet main courante partagé admin+orga (341 l.)
    L.21   McForm — stand autocomplete · titre · descriptif · photos
    L.236  export TabMainCourante({ ev })
    Photos uploadées dans bucket "Photos" sous main-courante/{id}/{uuid}.jpg

  ControleurEventPage.tsx        Vue terrain : liste stands d'un événement (268 l.)
    L.41   export ControleurEventPage
    Offline : lit IndexedDB, barre sync (pending count)

  ControleurStandPage.tsx        Vue terrain : prestations d'un stand (359 l.)
    L.31   ControlForm — formulaire inline conformité + photos
    L.197  PrestationCard
    L.252  export ControleurStandPage
    Offline : écrit IndexedDB pending_sync=1, upload photos
```

---

## Routing (App.tsx)

| Rôle | Routes |
|------|--------|
| Admin (`is_admin=true`) | `/dashboard` `/evenements` `/evenements/:id` `/utilisateurs` `/prestataires` |
| Orga/Presta (`is_admin=false`) | `/` (liste événements) `/evenements/:id` |
| Contrôleur terrain | `/controleur/:eventId` `/controleur/:eventId/:standId` (sans sidebar) |

---

## IndexedDB (db.ts)

| Table | Clé | Index |
|-------|-----|-------|
| `evenements` | `id` | — |
| `stands` | `id` | `evenement_id` |
| `prestations` | `id` | `stand_id, pending_sync` |
| `photos` | `++id` | `prestation_id, synced` |

`LocalPrestation` contient tous les champs Supabase + `pending_sync: 0|1`.

---

## Supabase

**Tables** : `evenements` · `stands` · `prestations` · `photos` · `users` · `prestataires` · `prestataire_contacts` · `user_evenements` · `main_courante` · `main_courante_photos`

**Storage bucket** : `Photos` (photos de prestations + photos main courante)
- Prestations : `{prestation_id}/{uuid}.jpg`
- Main courante : `main-courante/{mc_id}/{uuid}.jpg`

**Edge Functions** :
- `supabase/functions/create-user/` — création utilisateur via service role
- `supabase/functions/notify-non-conformite/` — email Resend sur non-conformité
- `supabase/functions/send-push-notification/` — Web Push VAPID

**Migrations** :
- `supabase/schema.sql` — schéma complet initial
- `supabase/migration_v2.sql` — ajouts v2
- `supabase/migration_stands_v2.sql` — champs stands v2
- `supabase/migration_main_courante.sql` — tables main_courante + photos RLS

---

## Règles rapides

- `sb` (anon) pour toutes les requêtes user → RLS appliqué
- `sbAdmin` (service role) uniquement pour upload Storage + create-user
- Offline : vérifier `navigator.onLine` avant tout appel Supabase
- Commit : `git config user.email noreply@anthropic.com && git config user.name Claude` avant chaque commit
- Branch principale : `main` (push nécessite confirmation utilisateur)
