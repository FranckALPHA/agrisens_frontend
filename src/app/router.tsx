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
import { EtatVide } from '@/components/EtatVide';

// Pages provisoires en attente des features verticales dédiées
const PageProvisoire: React.FC<{ titre: string; message: string }> = ({ titre, message }) => (
  <div className="py-12">
    <EtatVide titre={titre} message={message} pleinePage />
  </div>
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
      {
        path: 'connexion',
        element: (
          <PageProvisoire
            titre="Connexion"
            message="L'authentification par téléphone et mot de passe sera activée avec la feature F-02."
          />
        ),
      },
      {
        path: 'inscription',
        element: (
          <PageProvisoire
            titre="Créer un compte"
            message="L'inscription des acheteurs, producteurs, ingénieurs et livreurs sera livrée en F-02."
          />
        ),
      },
      {
        path: 'conditions',
        element: (
          <PageProvisoire
            titre="Conditions Générales d'Utilisation"
            message="Plateforme AgriSens régie par le droit camerounais."
          />
        ),
      },
      {
        path: 'confidentialite',
        element: (
          <PageProvisoire
            titre="Politique de Confidentialité"
            message="Vos données personnelles (téléphone, géolocalisation) sont protégées et chiffrées."
          />
        ),
      },
      {
        path: 'contact',
        element: (
          <PageProvisoire
            titre="Contact & Assistance"
            message="Support technique AgriSens Cameroun disponible 7j/7."
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
        path: 'agriculteur/*',
        element: (
          <RouteProtegee rolesAutorises={['agriculteur', 'super_admin']}>
            <PageProvisoire
              titre="Espace Agriculteur"
              message="Gestion de vos parcelles et récoltes livrées en F-04."
            />
          </RouteProtegee>
        ),
      },
      {
        path: 'ingenieur/*',
        element: (
          <RouteProtegee rolesAutorises={['ingenieur_agronome', 'super_admin']}>
            <PageProvisoire
              titre="Espace Ingénieur Agronome"
              message="Suivi agronomique et validation des missions livrés en F-03 et F-11."
            />
          </RouteProtegee>
        ),
      },
      {
        path: 'livreur/*',
        element: (
          <RouteProtegee rolesAutorises={['livreur', 'super_admin']}>
            <PageProvisoire
              titre="Espace Livreur"
              message="Gestion des livraisons et validation par code remise livrées en F-08."
            />
          </RouteProtegee>
        ),
      },
      {
        path: 'admin/*',
        element: (
          <RouteProtegee rolesAutorises={['admin', 'super_admin']}>
            <PageProvisoire
              titre="Espace Administration"
              message="Tableau de bord administrateur et paramètres livrés en F-10."
            />
          </RouteProtegee>
        ),
      },
      {
        path: 'profil',
        element: (
          <PageProvisoire
            titre="Mon Profil"
            message="Gestion de vos informations et adresses livrée en F-02."
          />
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
