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
import { PageNotifications } from '@/pages/notifications/PageNotifications';
import { PageProfilPro } from '@/pages/ingenieur/PageProfilPro';
import { PageDisponibilite } from '@/pages/livreur/PageDisponibilite';
import { PageUtilisateursAdmin } from '@/pages/admin/PageUtilisateursAdmin';
import { PageConditions, PageConfidentialite } from '@/pages/legal/PagesLegales';
import { EtatVide } from '@/components/EtatVide';
import { PageExploitations } from '@/pages/agriculteur/PageExploitations';
import { PageFormulaireExploitation } from '@/pages/agriculteur/PageFormulaireExploitation';
import { PageMesProduits } from '@/pages/agriculteur/PageMesProduits';
import { PageFormulaireProduit } from '@/pages/agriculteur/PageFormulaireProduit';
import { PageCatalogue } from '@/pages/catalogue/PageCatalogue';
import { PageDetailProduit } from '@/pages/catalogue/PageDetailProduit';
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
      { path: 'catalogue', element: <PageCatalogue /> },
      { path: 'catalogue/:identifiant', element: <PageDetailProduit /> },
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
      // La barre de navigation (logo, cloche) reste accessible aux comptes en attente :
      // chaque page interne rejoue la garde (ING-02 est autorisée, D-13).
      <RouteProtegee autoriserEnAttente>
        <MiseEnPageConnectee />
      </RouteProtegee>
    ),
    children: [
      {
        path: 'acheteur',
        element: <EspaceRole role="acheteur" rolesAutorises={['acheteur', 'super_admin']} />,
      },
      {
        path: 'agriculteur',
        element: <EspaceRole role="agriculteur" rolesAutorises={['agriculteur', 'super_admin']} />,
      },
      {
        // Espace ingénieur (F-03) : tableau de bord + ING-02 accessible en attente (D-13).
        path: 'ingenieur',
        children: [
          {
            index: true,
            element: (
              <EspaceRole
                role="ingenieur_agronome"
                rolesAutorises={['ingenieur_agronome', 'super_admin']}
              />
            ),
          },
          {
            path: 'profil-pro',
            element: (
              <RouteProtegee
                rolesAutorises={['ingenieur_agronome', 'super_admin']}
                autoriserEnAttente
              >
                <PageProfilPro />
              </RouteProtegee>
            ),
          },
        ],
      },
      {
        // Espace livreur (F-03) : tableau de bord + LIV-01 disponibilité.
        path: 'livreur',
        children: [
          {
            index: true,
            element: <EspaceRole role="livreur" rolesAutorises={['livreur', 'super_admin']} />,
          },
          {
            path: 'disponibilite',
            element: (
              <RouteProtegee rolesAutorises={['livreur', 'super_admin']}>
                <PageDisponibilite />
              </RouteProtegee>
            ),
          },
        ],
      },
      {
        // Espace administration (F-03) : tableau de bord + ADM-02 utilisateurs.
        path: 'admin',
        children: [
          {
            index: true,
            element: <EspaceRole role="admin" rolesAutorises={['admin', 'super_admin']} />,
          },
          {
            path: 'utilisateurs',
            element: (
              <RouteProtegee rolesAutorises={['admin', 'super_admin']}>
                <PageUtilisateursAdmin />
              </RouteProtegee>
            ),
          },
        ],
      },
      { path: 'profil', element: <PageProfil /> },
      { path: 'notifications', element: <PageNotifications /> },
      {
        path: 'agriculteur/exploitations',
        element: (
          <RouteProtegee rolesAutorises={['agriculteur', 'super_admin']}>
            <PageExploitations />
          </RouteProtegee>
        ),
      },
      {
        path: 'agriculteur/exploitations/nouvelle',
        element: (
          <RouteProtegee rolesAutorises={['agriculteur', 'super_admin']}>
            <PageFormulaireExploitation />
          </RouteProtegee>
        ),
      },
      {
        // La route ne filtre pas par rôle : l'API transforme l'accès d'Amina en 404.
        path: 'agriculteur/exploitations/:identifiant',
        element: (
          <RouteProtegee>
            <PageFormulaireExploitation />
          </RouteProtegee>
        ),
      },
      {
        path: 'agriculteur/produits',
        element: (
          <RouteProtegee rolesAutorises={['agriculteur', 'super_admin']}>
            <PageMesProduits />
          </RouteProtegee>
        ),
      },
      {
        path: 'agriculteur/produits/nouveau',
        element: (
          <RouteProtegee rolesAutorises={['agriculteur', 'super_admin']}>
            <PageFormulaireProduit />
          </RouteProtegee>
        ),
      },
      {
        path: 'agriculteur/produits/:identifiant',
        element: (
          <RouteProtegee rolesAutorises={['agriculteur', 'super_admin']}>
            <PageFormulaireProduit />
          </RouteProtegee>
        ),
      },
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
