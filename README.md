# AgriSens — Frontend

PWA React (TypeScript, Vite) de la plateforme AgriSens, responsive et
installable, avec les tests E2E Playwright de toute l'application.

Ce dépôt est vide à dessein : le code est produit feature par feature
à partir de la spécification située dans `../docs/` (même espace de
travail). Commencer par `AGENTS.md`, puis le prompt
`../docs/prompts/F-01-socle-frontend.md` (après F-00).

## Stack technique
- **Framework** : React 18 + TypeScript strict + Vite 6
- **PWA** : vite-plugin-pwa (Workbox, manifest standalone, lang fr)
- **Style** : Tailwind CSS branché sur les variables CSS de `src/theme/`
- **Gestion d'état** : Zustand (session JWT en mémoire), TanStack Query (cache serveur)
- **Formulaires & validation** : React Hook Form + Zod
- **Client API** : openapi-fetch (typé depuis openapi.json du backend)
- **Tests unitaires** : Vitest + Testing Library + MSW
- **Tests E2E** : Playwright (projets Ordinateur et Mobile Pixel 5)

## Démarrage rapide

```bash
# Installation des dépendances
npm install

# Démarrage du serveur de développement (http://localhost:5173)
npm run dev

# Génération des types API depuis le backend
npm run api:types

# Exécution des tests unitaires
npm run test

# Exécution des tests E2E Playwright
npm run e2e

# Build de production et prévisualisation PWA
npm run build
npm run preview
```

