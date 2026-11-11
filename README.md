# QuickPrint QR

> **Scan. Send. Print.**

QuickPrint QR est une application web de soumission et de gestion d'impression de documents PDF. L'étudiant scanne un QR Code affiché à l'imprimerie, ouvre une page web sur son téléphone et envoie un ou plusieurs fichiers PDF. L'administrateur retrouve immédiatement les documents dans son tableau de bord, peut les prévisualiser et lancer leur impression.

Le projet est développé sous forme de **monorepo** contenant le frontend React, le backend NestJS et les fichiers Supabase.

---

## Sommaire

- [Objectif](#objectif)
- [Fonctionnalités prévues](#fonctionnalités-prévues)
- [Parcours utilisateur](#parcours-utilisateur)
- [Stack technique](#stack-technique)
- [Structure du dépôt](#structure-du-dépôt)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Démarrage](#démarrage)
- [Variables d'environnement](#variables-denvironnement)
- [Sécurité](#sécurité)
- [Documentation](#documentation)
- [État d'avancement](#état-davancement)

---

## Objectif

Dans une imprimerie, la collecte des fichiers se fait souvent par clé USB, par e-mail ou par messagerie : les files d'attente s'allongent, les fichiers se perdent et les formats posent problème.

QuickPrint QR répond à ce besoin avec un parcours simple :

1. L'administrateur ouvre une **session de réception** et affiche son QR Code.
2. L'étudiant scanne le QR Code avec son téléphone.
3. La page de dépôt s'ouvre **sans installation ni création de compte**.
4. Les PDF sont envoyés dans un **stockage privé**.
5. Le tableau de bord de l'administrateur est actualisé automatiquement.
6. L'administrateur prévisualise les documents et lance l'impression.

La version initiale fonctionne par Internet : l'étudiant utilise sa propre connexion ou ses données mobiles, sans devoir se connecter au Wi-Fi de l'imprimerie.

## Fonctionnalités prévues

### Côté étudiant

- Accès par QR Code, sans compte ni application à installer.
- Dépôt d'un ou plusieurs fichiers PDF.
- Affichage des noms et tailles des fichiers sélectionnés, avec possibilité de les retirer.
- Progression et résultat de chaque envoi.
- Messages clairs lorsque la session est invalide, fermée ou expirée.

### Côté administrateur

- Connexion sécurisée par e-mail et mot de passe (Supabase Auth).
- Création, fermeture et renouvellement de sessions de réception temporaires.
- Génération et affichage du QR Code de dépôt.
- Tableau de bord avec compteurs, recherche, filtres et sélection multiple.
- Actualisation en temps réel à l'arrivée de nouveaux documents.
- Prévisualisation des PDF (navigation, zoom, nombre de pages).
- Impression d'un document ou d'une sélection, avec historique des lots.
- Historique des documents et des impressions.
- Gestion des statuts : reçu, imprimé, supprimé.

## Parcours utilisateur

```text
Administrateur                          Étudiant
     |                                      |
     |-- Crée une session ----------------->|
     |-- Affiche le QR Code                 |
     |                                      |-- Scanne le QR Code
     |                                      |-- Sélectionne ses PDF
     |                                      |-- Envoie les fichiers
     |<-- Notification temps réel ----------|
     |-- Prévisualise --------------------->|
     |-- Imprime et marque comme imprimé    |
```

## Stack technique

| Couche | Technologies |
|---|---|
| **Frontend** | React, Vite, TypeScript, `lucide-react`, `axios`, `react-router-dom`, `@supabase/supabase-js`, `qrcode.react`, `pdfjs-dist`, `pdf-lib` |
| **Backend** | NestJS, TypeScript, API REST, validation des requêtes, Swagger |
| **Base de données** | Supabase PostgreSQL, migrations SQL versionnées |
| **Stockage** | Supabase Storage (bucket privé `quickprint-documents`) |
| **Authentification** | Supabase Auth (administrateurs uniquement) |
| **Temps réel** | Supabase Realtime |
| **Hébergement** | Render (frontend statique + backend web service) |

## Structure du dépôt

```text
quickprint-qr/
├── apps/
│   ├── frontend/          # Application React + Vite + TypeScript
│   └── backend/           # API NestJS
├── supabase/
│   ├── migrations/        # Migrations SQL versionnées
│   ├── seed.sql           # Données initiales (sans secret)
│   └── config.toml        # Configuration Supabase CLI
├── docs/                  # Plan, structure et documentation technique
├── .gitignore
├── package.json           # Workspaces npm et scripts racine
└── README.md
```

Le monorepo utilise **npm workspaces** (`apps/*`) : une seule installation à la racine, des scripts communs et des dépendances isolées par application.

## Prérequis

- **Node.js** `>= 20.19.0`
- **npm** `>= 10.0.0`
- **Git**
- Un projet **Supabase** (base de données, Auth et Storage)
- **Docker Desktop** (uniquement pour l'option Supabase local)
- Un compte **Render** pour le déploiement (à partir de la Phase 8)

## Installation

```bash
git clone https://github.com/DEVTahina/quickprint-qr.git
cd quickprint-qr
npm install
```

## Démarrage

```bash
# Frontend (Vite) — http://localhost:5173
npm run dev:frontend

# Backend (NestJS) — http://localhost:3000
npm run dev:backend
```

Le développement utilise le projet **Supabase en ligne**. Renseigner les fichiers
`.env` (voir [`docs/authentication.md`](docs/authentication.md)), appliquer les
migrations puis créer le compte administrateur.

### Base de données locale (optionnelle)

Pour travailler sans projet distant, Supabase peut aussi tourner dans Docker :

```bash
npx supabase start     # PostgreSQL, Auth et Storage locaux
npx supabase db reset  # applique les migrations et seed.sql
```

L'API locale est disponible sur `http://127.0.0.1:54321` et PostgreSQL sur
`postgresql://postgres:postgres@127.0.0.1:54322/postgres`. Le schéma et les
politiques d'accès sont décrits dans [`docs/database.md`](docs/database.md).

Autres scripts racine :

```bash
npm run build   # Build de toutes les applications
npm run lint    # Lint de toutes les applications
npm run test    # Tests de toutes les applications
```

Une fois les deux serveurs lancés :

| Service | URL |
|---|---|
| Frontend | <http://localhost:5173> |
| API | <http://localhost:3000> |
| Health check | <http://localhost:3000/health> |
| Documentation Swagger | <http://localhost:3000/api/docs> |

Le frontend expose la page d'accueil (`/`), la connexion administrateur (`/admin/login`), l'espace protégé (`/admin`), la gestion des sessions (`/admin/sessions`) et la page publique ouverte par un QR Code (`/depot/:token`). L'API expose `GET /health`, `GET /auth/me`, les routes `/sessions` protégées, `GET /public/sessions/:token` et sa documentation OpenAPI.

## Variables d'environnement

Chaque application dispose d'un fichier `.env.example` (créé en Phase 1) listant les variables nécessaires. Copier ce fichier en `.env` puis renseigner les valeurs localement.

| Application | Variable | Rôle |
|---|---|---|
| Frontend | `VITE_API_URL` | URL de base de l'API backend |
| Frontend | `VITE_SUPABASE_URL` | URL du projet Supabase |
| Frontend | `VITE_SUPABASE_ANON_KEY` | Clé publique anonyme Supabase |
| Backend | `PORT` | Port d'écoute de l'API |
| Backend | `SUPABASE_URL` | URL du projet Supabase |
| Backend | `SUPABASE_SERVICE_ROLE_KEY` | Clé service role (serveur uniquement) |
| Backend | `FRONTEND_URL` | Origine autorisée pour CORS |
| Backend | `NODE_ENV` | Environnement d'exécution |

La connexion administrateur, la vérification du token et la création du premier compte sont décrites dans [`docs/authentication.md`](docs/authentication.md). Le cycle de vie des sessions et du QR Code est décrit dans [`docs/sessions.md`](docs/sessions.md).

> **Aucun fichier `.env` réel ni aucune clé ne doit être versionné.** Seuls les fichiers `.env.example` sans valeur secrète sont commités.

## Sécurité

Les principes suivants s'appliquent à toutes les phases :

- **La clé `SUPABASE_SERVICE_ROLE_KEY` reste exclusivement côté backend** et n'apparaît jamais dans le bundle frontend.
- **Row Level Security (RLS) est activé** sur toutes les tables ; les étudiants non authentifiés ne peuvent pas lire les données ni les documents.
- **Le bucket `quickprint-documents` est privé** ; l'accès se fait par URL signées à durée courte.
- **Les tokens de session ne sont jamais stockés en clair** : seule leur empreinte SHA-256 est conservée.
- **Le backend vérifie les autorisations** à chaque requête ; masquer un bouton dans l'interface ne protège rien.
- **Les fichiers sont validés côté serveur** (signature PDF, type MIME, taille, nombre).
- **Aucune inscription publique d'administrateur** : les comptes sont créés manuellement.
- **Limites d'upload et rate limiting** pour prévenir les abus.
- **Les logs ne contiennent aucun secret ni token.**

## Documentation

- [`docs/QuickPrint_QR_Plan_Developpement.md`](docs/QuickPrint_QR_Plan_Developpement.md) — plan de développement complet et prompts par phase
- [`docs/database.md`](docs/database.md) — schéma PostgreSQL, politiques RLS et stockage privé
- [`docs/authentication.md`](docs/authentication.md) — Supabase Auth, premier administrateur et protection des routes
- [`docs/sessions.md`](docs/sessions.md) — sessions temporaires, token SHA-256 et QR Code
- [`docs/Structure-dossier.md`](docs/Structure-dossier.md) — arborescence cible du projet
- [`docs/phase-developement/`](docs/phase-developement/) — consignes détaillées de chaque phase

`docs/architecture.md` et `docs/deployment.md` seront ajoutés en Phase 8.

## État d'avancement

| Phase | Contenu | Statut |
|---:|---|---|
| 0 | Dépôt GitHub et structure monorepo | ✅ Terminée |
| 1 | Initialisation frontend et backend | ✅ Terminée |
| 2 | Supabase, base de données, RLS et stockage | ✅ Terminée |
| 3 | Authentification et espace administrateur | ✅ Terminée |
| 4 | Sessions de réception et QR Code | ✅ Terminée |
| 5 | Réception et envoi sécurisé des PDF | ⏳ À venir |
| 6 | Tableau de bord et temps réel | ⏳ À venir |
| 7 | Prévisualisation et impression | ⏳ À venir |
| 8 | Historique, sécurité, tests et déploiement | ⏳ À venir |

---

Projet privé — tous droits réservés.
