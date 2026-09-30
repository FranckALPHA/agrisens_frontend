/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { MiseEnPagePublique } from '@/components/layout/MiseEnPagePublique';
import { MiseEnPageConnectee } from '@/components/layout/MiseEnPageConnectee';
import { PageAccueil } from '@/pages/Accueil';
import { PageEtat } from '@/pages/Etat';
import { Page404 } from '@/pages/Page404';
import { PageAccesInterdit } from '@/pages/PageAccesInterdit';
import { RouteProtegee } from '@/pages/RouteProtegee';
import { PageTableauDeBord } from '@/pages/PageTableauDeBord';
import { PageConnexion } from '@/pages/auth/PageConnexion';
import { PageInscription } from '@/pages/auth/PageInscription';
import { PageMotDePasseOublie } from '@/pages/auth/PageMotDePasseOublie';
import { PageProfil } from '@/pages/profil/PageProfil';
import { PageConditions, PageConfidentialite } from '@/pages/legal/PagesLegales';
import { EtatVide } from '@/components/EtatVide';
import type { RoleUtilisateur } from '@/app/menus';

// Pages provisoires en attente des features verticales dédiées
const PageProvisoire: React.FC<{ titre: string; message: string }> = ({ titre, message }) => (
  <div className="py-12">
    <EtatVide titre={titre} message={message} pleinePage />
  </div>
);

/** Tableau de bord provisoire d'un rôle (F-02 point 6), réservé à ce rôle. */
const EspaceRole: React.FC<{ role: RoleUtilisateur; rolesAutorises: RoleUtilisateur[] }> = ({
  role,
  rolesAutorises,
}) => (
  <RouteProtegee rolesAutorises={rolesAutorises}>
    <PageTableauDeBord role={role} />
  </RouteProtegee>
);

export const router = createBrowserRouter([
  // 1. Parcours public
  {
    path: '/',
    element: <MiseEnPagePublique />,
    children: [
      { index: true, element: <PageAccueil /> },
      { path: 'etat', element: <PageEtat /> },
      {
        path: 'catalogue',
        element: (
          <PageProvisoire
            titre="Catalogue des produits"
            message="Le catalogue complet des récoltes locales sera accessible avec la feature F-05."
          />
        ),
      },
      { path: 'connexion', element: <PageConnexion /> },
      { path: 'inscription', element: <PageInscription /> },
      { path: 'mot-de-passe-oublie', element: <PageMotDePasseOublie /> },
      { path: 'conditions', element: <PageConditions /> },
      { path: 'confidentialite', element: <PageConfidentialite /> },
      {
        path: 'contact',
        element: (
          <PageProvisoire
            titre="Contact & Assistance"
            message="Support technique AgriSens Cameroun — coordonnées définitives en pré-production (F-16)."
          />
        ),
      },
      { path: 'acces-interdit', element: <PageAccesInterdit /> },
    ],
  },

  // 2. Démonstration de mise en page connectée (PW-F01-05)
  {
    path: '/connecte',
    element: <MiseEnPageConnectee />,
    children: [
      {
        index: true,
        element: (
          <div data-testid="espace-connecte" className="py-6">
            <h1 className="text-xl font-bold text-texte">Espace connecté</h1>
            <p className="text-sm text-texte-secondaire mt-1">Interface responsive AgriSens.</p>
          </div>
        ),
      },
    ],
  },

  // 3. Espaces connectés protégés par rôle
  {
    path: '/',
    element: (
      <RouteProtegee>
        <MiseEnPageConnectee />
      </RouteProtegee>
    ),
    children: [
      {
        path: 'acheteur/*',
        element: <EspaceRole role="acheteur" rolesAutorises={['acheteur', 'super_admin']} />,
      },
      {
        path: 'agriculteur/*',
        element: <EspaceRole role="agriculteur" rolesAutorises={['agriculteur', 'super_admin']} />,
      },
      {
        path: 'ingenieur/*',
        element: (
          <EspaceRole
            role="ingenieur_agronome"
            rolesAutorises={['ingenieur_agronome', 'super_admin']}
          />
        ),
      },
      {
        path: 'livreur/*',
        element: <EspaceRole role="livreur" rolesAutorises={['livreur', 'super_admin']} />,
      },
      {
        path: 'admin/*',
        element: <EspaceRole role="admin" rolesAutorises={['admin', 'super_admin']} />,
      },
      { path: 'profil', element: <PageProfil /> },
      {
        path: 'panier',
        element: (
          <PageProvisoire
            titre="Mon Panier"
            message="Votre panier sera disponible avec la feature F-05."
          />
        ),
      },
      {
        path: 'commandes',
        element: (
          <PageProvisoire
            titre="Mes Commandes"
            message="Le suivi de vos commandes sera disponible avec la feature F-06."
          />
        ),
      },
    ],
  },

  // 4. Page 404 globale
  {
    path: '*',
    element: <MiseEnPagePublique />,
    children: [{ path: '*', element: <Page404 /> }],
  },
]);
