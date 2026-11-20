# Guide complet de déploiement — QuickPrint QR sur Render

Ce guide décrit, de A à Z, comment mettre en production l'application
QuickPrint QR avec :

- **Supabase** pour la base de données, l'authentification et le stockage privé ;
- **Render** pour le backend NestJS et le frontend React statique.

Aucune vraie clé n'est fournie ici : remplacez les valeurs entre `<...>`
par les vôtres.

---

## 0. Prérequis

- Compte GitHub avec le dépôt QuickPrint QR poussé.
- Compte Supabase (projet déjà créé ou à créer).
- Compte Render.
- Node.js 20+ et npm installés localement.
- Supabase CLI installée si vous voulez appliquer les migrations en ligne de
  commande : `npm install -g supabase`.

Vérifiez localement avant de déployer :

```bash
npm ci
npm run test --workspaces --if-present
npm run build --workspaces --if-present
```

Les deux builds et les tests doivent réussir.

---

## 1. Préparer le dépôt GitHub

1. Vérifiez que `.env` et `.env.local` ne sont **pas** versionnés.
2. Vérifiez qu'aucune clé n'est dans le code :
   ```bash
   grep -R "service_role\|SUPABASE_SERVICE_ROLE_KEY" apps/frontend/src || echo "aucune fuite cote frontend"
   ```
3. Poussez la branche principale :
   ```bash
   git push origin main
   ```
4. Notez l'URL du dépôt : `https://github.com/<utilisateur>/<repo>`.

---

## 2. Configurer Supabase

### 2.1 Créer le projet

1. Dans Supabase, créez un nouveau projet.
2. Notez :
   - **Project URL** : `https://<ref>.supabase.co`
   - **anon key** (publique)
   - **service_role key** (secrète, serveur uniquement)
3. Gardez la région proche de vos utilisateurs.

### 2.2 Appliquer les migrations

Option A — CLI :

```bash
supabase login
supabase link --project-ref <ref-projet>
supabase db push
```

Option B — éditeur SQL :

1. Ouvrez `supabase/migrations`.
2. Exécutez les fichiers dans l'ordre alphabétique dans l'éditeur SQL.
3. Vérifiez qu'aucune erreur n'apparaît.

### 2.3 Vérifier le stockage et la sécurité

1. Vérifiez que le bucket `quickprint-documents` existe.
2. Il doit être **privé**, limité à 20 Mio par fichier et aux PDF.
3. Vérifiez que RLS est actif sur les six tables principales.
4. Vérifiez que les politiques RLS sont bien appliquées.

### 2.4 Créer l'administrateur

1. Dans Supabase Auth, créez manuellement un utilisateur avec e-mail et mot
   de passe.
2. Dans la table `admin_profiles`, insérez le profil correspondant avec le même
   `id` que l'utilisateur Auth.
3. Désactivez les inscriptions publiques dans les réglages Auth.
4. Dans les réglages d'authentification, renseignez l'URL du frontend comme
   **Site URL** pour les liens de récupération.
5. Ne donnez aucun droit d'inscription libre.

---

## 3. Créer le backend sur Render

### 3.1 Créer le service

1. Dans Render, cliquez sur **New +** puis **Web Service**.
2. Connectez votre dépôt GitHub.
3. Choisissez la branche principale.
4. Configurez :
   - **Name** : `quickprint-api` (ou autre)
   - **Root Directory** : laisser vide (racine du dépôt)
   - **Environment** : `Node`
   - **Build Command** :
     ```bash
     npm ci && npm run build --workspace @quickprint/backend
     ```
   - **Start Command** :
     ```bash
     node apps/backend/dist/main.js
     ```
   - **Health Check Path** : `/health`

### 3.2 Variables d'environnement backend

Dans l'onglet **Environment**, ajoutez :

| Clé | Valeur |
|---|---|
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | clé service role Supabase |
| `FRONTEND_URL` | URL exacte du site frontend, sans slash final |
| `NODE_ENV` | `production` |
| `MAX_PDF_SIZE_BYTES` | `20971520` (facultatif) |
| `UPLOAD_INTENT_TTL_SECONDS` | `900` (facultatif) |
| `PORT` | fourni automatiquement par Render — ne pas le définir |

`FRONTEND_URL` conditionne CORS : toute origine absente de cette liste est
refusée. Vous pouvez mettre plusieurs origines séparées par des virgules.

### 3.3 Vérifier le déploiement backend

1. Cliquez sur **Create Web Service**.
2. Attendez la fin du build.
3. Ouvrez `https://<api>.onrender.com/health`.
4. Vous devez obtenir :
   ```json
   {"status":"ok","service":"quickprint-qr-api","version":"0.1.0",...}
   ```
5. Ouvrez `https://<api>.onrender.com/api/docs` pour Swagger.
6. Testez qu'une requête sans token renvoie `401` :
   ```bash
   curl -i https://<api>.onrender.com/documents
   ```

---

## 4. Créer le frontend sur Render

### 4.1 Créer le site statique

1. Dans Render, cliquez sur **New +** puis **Static Site**.
2. Connectez le même dépôt GitHub.
3. Configurez :
   - **Name** : `quickprint-web` (ou autre)
   - **Build Command** :
     ```bash
     npm ci && npm run build --workspace @quickprint/frontend
     ```
   - **Publish Directory** : `apps/frontend/dist`

### 4.2 Rewrite SPA

Ajoutez une règle de réécriture :

- **Source** : `/*`
- **Destination** : `/index.html`
- **Action** : Rewrite

Sans cette règle, un rechargement sur `/admin/documents/...` renvoie 404.

### 4.3 Variables d'environnement frontend

Ces variables doivent être définies **avant le build**, car Vite les intègre au
bundle :

| Clé | Valeur |
|---|---|
| `VITE_API_URL` | URL HTTPS complète du backend, ex. `https://quickprint-api.onrender.com` |
| `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | clé publique anon |

En production, ne laissez pas `VITE_API_URL=/api` : Render ne proxyfie pas
`/api` vers le backend. Utilisez l'URL complète du service web.

### 4.4 Vérifier le déploiement frontend

1. Lancez le build.
2. Ouvrez l'URL du site.
3. Vérifiez que la page d'accueil s'affiche.
4. Vérifiez qu'un rechargement sur une route protégée fonctionne.

---

## 5. Ordre recommandé de déploiement

1. Supabase prêt (migrations, bucket, administrateur).
2. Backend déployé et `/health` à `200`.
3. `FRONTEND_URL` du backend renseigné avec l'URL future du frontend.
4. Frontend déployé avec `VITE_API_URL` pointant vers le backend.
5. Vérifications ci-dessous, puis premier QR Code réel.

Si vous utilisez le Blueprint `render.yaml`, Render créera les deux services
avec les commandes et règles déjà définies. Il restera à saisir les variables
secrètes dans l'interface.

---

## 6. Vérifications après déploiement

- `GET https://<api>/health` renvoie `200`.
- `GET https://<api>/api/docs` s'ouvre.
- `GET /documents` sans token renvoie `401`.
- La connexion administrateur fonctionne, puis le tableau de bord charge les
  données.
- Un dépôt depuis un téléphone en données mobiles aboutit.
- Le PDF apparaît dans le dashboard sans rechargement.
- L'aperçu PDF et une impression simple fonctionnent.
- Le lot apparaît dans l'historique.
- Une origine inconnue est refusée par CORS.
- Le HTML du site ne contient ni `service_role`, ni clé secrète :
  ```bash
  grep -r "service_role" apps/frontend/dist
  ```
  doit être vide.
- Le bucket reste inaccessible sans URL signée.

---

## 7. Limites des offres gratuites

À vérifier sur les pages tarifaires actuelles, car elles évoluent :

- **Render Web Service gratuit** : le service s'endort après inactivité ; la
  première requête suivante peut prendre plusieurs dizaines de secondes.
- **Render Static Site gratuit** : bande passante mensuelle limitée et builds
  mensuels plafonnés.
- **Supabase Free** : quotas de base de données, de stockage et de bande
  passante ; le projet peut être mis en pause après une longue inactivité.
- Un PDF de 20 Mio par dépôt remplit 1 Gio en une cinquantaine de fichiers.

Pour une imprimerie active, prévoir rapidement une offre payante côté backend
(pas de mise en veille) et surveiller le stockage Supabase.

---

## 8. Précautions sur les fichiers stockés

- Le bucket reste **privé** ; aucun objet ne doit être rendu public.
- La suppression d'un document est logique en base **et** retire l'objet du
  bucket.
- Les fichiers des envois abandonnés sont nettoyés toutes les dix minutes par
  le backend.
- Les URL signées expirent en 60 secondes et ne doivent jamais être
  journalisées ni partagées.
- Sauvegarder régulièrement la base et vérifier la politique de sauvegarde de
  l'offre Supabase choisie.
- Ne jamais exposer `SUPABASE_SERVICE_ROLE_KEY` au navigateur. En cas de fuite
  présumée, la régénérer dans Supabase et redéployer le backend.
- Les logs Render ne doivent contenir ni token de session ni clé.

---

## 9. Dépannage

### Le frontend affiche « Service indisponible »

- Le backend n'est pas démarré ou `VITE_API_URL` est incorrect.
- Vérifiez `https://<api>/health`.
- En local, lancez `npm run dev:backend` et `npm run dev:frontend`.

### Erreur `EADDRINUSE: address already in use :::3000`

- Une autre instance écoute déjà sur le port 3000.
- Sous Git Bash :
  ```bash
  netstat -ano | grep ":3000 .*LISTENING"
  taskkill //F //PID <PID> //T
  ```

### CORS refusé

- `FRONTEND_URL` ne contient pas l'origine exacte du frontend.
- Vérifiez qu'il n'y a pas de slash final.
- Plusieurs origines : séparez-les par des virgules.

### Rechargement sur `/admin/...` renvoie 404

- La règle de rewrite SPA `/*` vers `/index.html` est absente.
- Vérifiez le Static Site sur Render.

### Le QR Code n'est plus affiché après rechargement

- C'est le comportement normal si le lien secret n'a pas été conservé.
- Créez ou renouvelez la session pour réafficher le QR Code.

### Le bucket ou la base est inaccessible

- Vérifiez les migrations, le bucket privé et les politiques RLS.
- Vérifiez que la clé service role est correcte côté backend.

---

## 10. Checklist de mise en production

- [ ] Migrations appliquées, bucket privé et RLS vérifiés.
- [ ] Administrateur créé manuellement, inscription publique désactivée.
- [ ] Tests backend et builds frontend/backend réussis localement.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` absente du dépôt et du bundle frontend.
- [ ] Backend Render démarré, `/health` à `200`, `NODE_ENV=production`.
- [ ] `FRONTEND_URL` contient l'URL exacte du site, CORS vérifié.
- [ ] Frontend déployé avec `VITE_API_URL` HTTPS complet et rewrite SPA actif.
- [ ] Dépôt mobile réel, aperçu, impression et historique testés en production.
- [ ] Mots de passe de test changés, accès administrateur limité.
- [ ] Stockage et base surveillés ; sauvegarde ou export planifié.

---

Pour plus de détails sur l'authentification, les sessions, les uploads et la base
de données, consultez les fichiers du dossier `docs/`.
