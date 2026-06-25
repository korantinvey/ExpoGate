# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Contexte projet

Application de gestion de conformité pour organisateurs de salons/expositions. Les contrôleurs vérifient sur le terrain que les stands sont correctement montés. Référence complète dans `CONTEXT.md`.

**3 composants** (monorepo npm workspaces) :
- `packages/admin` — Back-office admin (React + Vite) — **EN COURS** : migration depuis `admin.html`
- `packages/organisateur` — Back-office organisateur (React + Vite) — **À CRÉER**
- `packages/mobile` — App mobile (React Native + Expo) — **À CRÉER**

`admin.html` est la référence fonctionnelle vanilla JS à migrer, pas à modifier.

## Commandes

```bash
# Démarrer le back-office admin en dev
npm run admin

# Build admin
npm run build:admin

# Depuis packages/admin directement
cd packages/admin && npm run dev
```

## Architecture

**Backend** : Supabase (PostgreSQL + Auth + Storage + RLS). Client initialisé dans `packages/admin/src/lib/supabase.ts`, à reproduire identiquement dans les autres packages.

**Types TypeScript** : définis dans `packages/admin/src/types/index.ts` — contient toutes les interfaces métier (Evenement, Stand, Prestation, User, UserEvenement, Prestataire…). Réutiliser ces types dans les nouveaux packages.

**Variables d'environnement** : `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` dans `.env` (voir `.env.example`). Ne jamais mettre les clés en dur.

## Conventions

- Composants React en TypeScript strict
- snake_case pour les colonnes BDD, camelCase pour JS/TS
- Nommage des colonnes BDD : voir `supabase/schema.sql`
- RLS activé sur toutes les tables — les requêtes Supabase s'exécutent avec les droits de l'utilisateur connecté
- `prestataire_id` dans `user_evenements` est obligatoire si `role_local = 'prestataire'`, null sinon

## Règles métier clés

- Statut événement `parametrage` → invisible pour tous sauf admin
- Statut `termine` → invisible dans l'app mobile, visible BO admin + organisateur
- `prestataire_contacts` = annuaire global (qui travaille où), ne donne **pas** accès à un événement
- `user_evenements` = table d'accès + rôle par événement
- App mobile : offline obligatoire (SQLite + queue sync), optimisée appareils bas de gamme
- Notifications email prestataire sur non-conformité → Supabase Edge Function + Resend
