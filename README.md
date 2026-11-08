# UADB Services — Frontend

Maquette responsive de la plateforme UADB de gestion des tickets de restauration et de la codification étudiante. L’interface est en français et reprend le bleu du logo de l’Université Alioune Diop de Bambey.

## Démarrer

Prérequis : Node.js 22 et npm.

```bash
npm install
npm run dev
```

Ouvrir ensuite [http://localhost:3000](http://localhost:3000).

## Écrans de démonstration

Depuis l’écran de connexion, les accès rapides permettent de prévisualiser les trois espaces :

- **Étudiant** : tableau de bord, achat de tickets, recharge simulée avec succès/échec, historique, QR code et codification avec vérification des informations, dépôt local des pièces et filtres de lits.
- **Contrôleur** : scan QR par caméra dans les navigateurs compatibles, avec simulation des résultats (valide, déjà servi, invalide ou solde insuffisant).
- **Administration** : statistiques, examen et décision sur les dossiers, import CSV, blocage des chambres pour maintenance et réglage des tarifs et de la fenêtre de codification.

Les parcours sont des démonstrations côté navigateur : aucun backend, authentification réelle, paiement ou réservation réelle n’est connecté. Les opérations, importations CSV et changements d’administration restent en mémoire et sont réinitialisés au rechargement. Les fichiers sélectionnés ne quittent pas l’appareil; leurs formats et tailles sont vérifiés localement. Le scan caméra utilise `BarcodeDetector` lorsqu’il est pris en charge par le navigateur et nécessite HTTPS ou localhost. Le QR code étudiant affiché est une illustration et ne contient aucune donnée de solde.

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
