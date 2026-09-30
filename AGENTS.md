# AGENTS.md — agrisens-frontend

Dépôt de la PWA AgriSens (React, TypeScript strict, Vite,
vite-plugin-pwa) et des tests E2E Playwright de l'application.

## À lire avant tout

1. `../AGENTS.md` — règles communes, ordre de priorité des documents.
2. `../docs/04-journal-decisions.md` — décisions (prime sur tout),
   notamment Q-18, Q-24, Q-25.
3. `../docs/01-conventions-techniques.md` §1bis et §7.
4. `../docs/09-dossier-frontend.md` — pages, composants, parcours.
5. Le prompt de la feature en cours dans `../docs/prompts/`.

## Rappels propres au frontend

- Arborescence imposée : `../docs/10-dossier-final-agent-code.md` §4.
- Couleurs, typographies, logo, espacements : uniquement `src/theme/`.
- Textes en français, centralisés pour permettre l'anglais plus tard.
- Types d'API générés depuis `../agrisens-backend/openapi.json` ; ne
  jamais les écrire à la main.
- Montants, frais et statuts de paiement : toujours ceux renvoyés par
  l'API, jamais recalculés ni supposés côté client.
- Chaque page : chargement, vide, erreur, succès, accès interdit,
  connexion faible.
- Jeton d'accès en mémoire seulement ; rafraîchissement par cookie
  `httpOnly` (Q-25).
- Les guards de rôle sont un confort : la sécurité est dans l'API.

## Commandes

À compléter par F-01 avec les commandes réelles :

    # installer
    # démarrer en développement
    # générer les types d'API
    # tests unitaires
    # tests E2E (backend lancé)
    # lint, format, types
    # build de production
