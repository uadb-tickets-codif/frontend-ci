# UADB Services — Frontend

Interface responsive de la plateforme UADB de gestion des tickets de restauration et de la codification étudiante. L’interface est en français et reprend le bleu du logo de l’Université Alioune Diop de Bambey.

## Démarrer

Prérequis : Node.js 22 et npm.

```bash
npm install
npm run dev
```

Ouvrir ensuite [http://localhost:3000](http://localhost:3000).

## Configuration et authentification

Copier `.env.example` vers `.env.local`, puis définir `NEXT_PUBLIC_API_URL` avec l’URL racine de l’API (par exemple `http://localhost:3001`). En développement, démarrer l’API du dépôt `backend-ci` séparément. Les requêtes d’authentification sont exécutées dans le navigateur ; le build Next.js ne contacte pas le backend. L’URL `NEXT_PUBLIC_` est publique et intégrée au bundle lors du build Docker : elle doit donc être renseignée avant la construction de l’image, mais l’API n’a pas besoin d’être démarrée.

L’inscription appelle `POST /auth/register` et crée uniquement un compte étudiant. La connexion appelle `POST /auth/login`, conserve le JWT dans le stockage local du navigateur, puis vérifie la session avec `GET /auth/me` au chargement. Les rôles `STUDENT`, `CONTROLLER` et `ADMIN` ouvrent leur espace correspondant ; la navigation de l’interface limite l’accès aux écrans de chaque rôle. La déconnexion et les réponses 401 suppriment le jeton. Les erreurs 403 et 5xx sont présentées en français.

Les nouveaux contrôleurs et administrateurs doivent être provisionnés par le backend : l’inscription publique ne permet pas de choisir un rôle. Cette intégration concerne l’authentification ; les opérations métier ci-dessous ne sont pas encore reliées à des endpoints.

## Écrans de démonstration

- **Étudiant** : tableau de bord, achat de tickets, recharge simulée avec succès/échec, historique, QR code et codification avec vérification des informations, dépôt local des pièces et filtres de lits.
- **Contrôleur** : scan QR par caméra dans les navigateurs compatibles, avec simulation des résultats (valide, déjà servi, invalide ou solde insuffisant).
- **Administration** : statistiques, examen et décision sur les dossiers, import CSV, blocage des chambres pour maintenance et réglage des tarifs et de la fenêtre de codification.

Les opérations métier, importations CSV et changements d’administration restent en mémoire et sont réinitialisés au rechargement. Les fichiers sélectionnés ne quittent pas l’appareil ; leurs formats et tailles sont vérifiés localement. Le scan caméra utilise `BarcodeDetector` lorsqu’il est pris en charge par le navigateur et nécessite HTTPS ou localhost. Le QR code étudiant affiché est une illustration et ne contient aucune donnée de solde.

## Vérifications

```bash
npm run lint
npm test
npm run build
```

## Stack

- Next.js 16 avec App Router
- React 19 et TypeScript
- Tailwind CSS 4 et styles CSS du portail
