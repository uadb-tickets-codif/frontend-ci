# frontend-ci

Interface web de la plateforme **UADB Services** : achat de tickets de restauration, QR code, contrôle à l'entrée du restaurant, et codification étudiante. L'interface est en français et reprend le bleu de l'Université Alioune Diop de Bambey.

Projet de l'examen pratique DevOps, Master 2 SI-SR, UADB, 2026-2027.

## Le projet en bref

Le projet est réparti en trois dépôts Git, chacun avec son propre pipeline :

| Dépôt | Rôle | Image Docker Hub |
|---|---|---|
| [backend-ci](https://github.com/uadb-tickets-codif/backend-ci) | API NestJS, CI backend | `groupe9/backend` |
| **frontend-ci** (ce dépôt) | Interface Next.js, CI frontend | `groupe9/frontend` |
| [deployment-cd](https://github.com/uadb-tickets-codif/deployment-cd) | Docker Compose, Jenkins, déploiement CD | n/a |

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Docker, Jenkins, Trivy.

## Espaces de l'application

| Espace | Contenu |
|---|---|
| **Étudiant** | Tableau de bord, achat et recharge, historique, QR code, codification (vérification des informations, dépôt des pièces, choix du lit) |
| **Contrôleur** | Scan du QR code par la caméra, résultat affiché clairement : valide, déjà servi, invalide, solde insuffisant |
| **Administration** | Statistiques, import CSV des étudiants codifiables, validation des dossiers, gestion des chambres, tarifs et fenêtre de codification |

Le QR code ne contient aucune donnée de solde : le solde est lu côté serveur au moment du scan.

### État de l'intégration avec l'API

L'interface a d'abord été développée en mode démonstration (données en mémoire), puis branchée progressivement sur l'API du dépôt [backend-ci](https://github.com/uadb-tickets-codif/backend-ci). La connexion et l'inscription utilisent l'API réelle avec les jetons JWT. Les écrans dont l'intégration n'est pas terminée restent en mode démonstration : leurs données sont alors locales et se réinitialisent au rechargement de la page.

## Prérequis

- Node.js 22 et npm
- Le backend en fonctionnement pour les écrans connectés (voir le dépôt backend-ci)

## Démarrage local

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Ouvrir `http://localhost:3000`. Sous PowerShell, remplacer `cp` par `Copy-Item`, et `npm` par `npm.cmd` si l'exécution de scripts est bloquée.

## Variables d'environnement

Modèle dans `.env.example`. Le fichier `.env.local` n'est jamais versionné.

| Variable | Lue | Rôle |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Dans le navigateur, **figée à la construction de l'image** | Adresse de l'API vue par le navigateur (par exemple `http://localhost:3001`) |
| `API_URL` | Côté serveur Next.js, à l'exécution | Adresse de l'API vue par le conteneur (en déploiement : `http://proxy:3001`) |

Les variables `NEXT_PUBLIC_*` sont remplacées dans le code au moment du build. Pour changer l'adresse publique de l'API, il faut reconstruire l'image avec `--build-arg NEXT_PUBLIC_API_URL=...`.

## Commandes

| Commande | Description |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production (`output: standalone`) |
| `npm run start` | Démarre le build de production |
| `npm run lint` | Vérification ESLint |
| `npm test` | Tests unitaires (exécuteur de tests de Node) |

## Structure

```text
src/
  app/                  Pages (App Router)
  lib/                  Client API, utilitaires (par exemple l'analyse du CSV)
public/                 Fichiers statiques
Dockerfile              Image de production (multi-étapes)
Jenkinsfile             Pipeline CI
next.config.ts          Configuration (output: standalone)
```

## Image Docker

Le `Dockerfile` construit l'application en deux étapes puis copie uniquement la sortie `standalone` de Next.js dans une image légère, exécutée avec l'utilisateur `node` sur le port 3000.

```sh
docker build --build-arg NEXT_PUBLIC_API_URL=http://localhost:3001 -t groupe9/frontend:test .
docker run --rm -p 3000:3000 groupe9/frontend:test
```

## Pipeline CI (Jenkins)

Le job est un *Multibranch Pipeline* : chaque push détecte la branche et lance le `Jenkinsfile`.

| Étape | Rôle |
|---|---|
| Checkout | Récupération du code |
| Installation | `npm ci` |
| Lint | `npm run lint` |
| Tests | `npm test` |
| Scan du code | `npm audit` (rapport archivé, une alerte élevée marque l'étape comme instable sans bloquer) |
| Build | `npm run build` |
| Build image Docker | Image `groupe9/frontend:1.0.<n° de build>` et `latest`, avec `NEXT_PUBLIC_API_URL` en argument de build |
| Scan Trivy | Vulnérabilités de l'image (HIGH et CRITICAL), rapport archivé |
| Push Docker Hub | Publication, avec le credential Jenkins `dockerhub-creds` |
| Déclencher le déploiement | Lance le job `deployment-cd` avec le tag construit |

Le push et le déclenchement du déploiement ne se font que sur les branches `develop` et `main`.

## Notes techniques

- **Caméra** : la lecture du QR code utilise `BarcodeDetector`, disponible dans les navigateurs récents basés sur Chromium. Elle exige **HTTPS ou `localhost`**. Pour une démonstration sur téléphone, prévoir un tunnel HTTPS.
- **Vulnérabilités `npm audit`** : les alertes de gravité modérée viennent de l'outillage de lint (`minimatch` via ESLint), utilisé uniquement en développement et absent de l'image de production. Le correctif proposé (`npm audit fix --force`) est un changement majeur, non appliqué avant le rendu.

## Branches et contributions

`main` (stable), `develop` (intégration), `feature/<tâche>` (une branche par carte Trello). Toute modification passe par une Pull Request relue par un autre membre.

## Équipe

| Membre | Rôle |
|---|---|
| Mamadou WADE | Frontend |
| Ibrahima SYLLA | Backend : codification, aide sur les écrans de codification |
| Serigne Ismaila SOUANE | Backend : authentification, tickets |
| Ibrahima WATT | Administration système : Dockerfiles, CI, sécurité des images |
| Mouhamadou Lamine COLY | Scrum master, administration système : Jenkins, CD, coordination |
