/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { MiseEnPagePublique } from '@/components/layout/MiseEnPagePublique';
import { MiseEnPageConnectee } from '@/components/layout/MiseEnPageConnectee';
import { MiseEnPageAdaptative } from '@/components/layout/MiseEnPageAdaptative';
import { PageAccueil } from '@/pages/Accueil';
import { PageEtat } from '@/pages/Etat';
import { Page404 } from '@/pages/Page404';
import { PageAccesInterdit } from '@/pages/PageAccesInterdit';
import { PageHorsConnexion } from '@/pages/PageHorsConnexion';
import { RouteProtegee } from '@/pages/RouteProtegee';
import { PageTableauDeBord } from '@/pages/PageTableauDeBord';
import { PageConnexion } from '@/pages/auth/PageConnexion';
import { PageInscription } from '@/pages/auth/PageInscription';
import { PageMotDePasseOublie } from '@/pages/auth/PageMotDePasseOublie';
import { PageProfil } from '@/pages/profil/PageProfil';
import { PageNotifications } from '@/pages/notifications/PageNotifications';
import { PageProfilPro } from '@/pages/ingenieur/PageProfilPro';
import { PageDisponibilite } from '@/pages/livreur/PageDisponibilite';
import { PageCoursesLivreur } from '@/pages/livreur/PageCoursesLivreur';
import { PageCourseDetail } from '@/pages/livreur/PageCourseDetail';
import { PageUtilisateursAdmin } from '@/pages/admin/PageUtilisateursAdmin';
import { PageLitigesAdmin } from '@/pages/admin/PageLitigesAdmin';
import { PageParametresAdmin } from '@/pages/admin/PageParametresAdmin';
import { PageAuditAdmin } from '@/pages/admin/PageAuditAdmin';
import { PageSoldesAdmin } from '@/pages/admin/PageSoldesAdmin';
import { PageMesGains } from '@/pages/gains/PageMesGains';
import { PageConditions, PageConfidentialite } from '@/pages/legal/PagesLegales';
import { EtatVide } from '@/components/EtatVide';
import { PageExploitations } from '@/pages/agriculteur/PageExploitations';
import { PageFormulaireExploitation } from '@/pages/agriculteur/PageFormulaireExploitation';
import { PageMesProduits } from '@/pages/agriculteur/PageMesProduits';
import { PageFormulaireProduit } from '@/pages/agriculteur/PageFormulaireProduit';
import { PagePanier } from '@/pages/panier/PagePanier';
import { PageMesCommandes, PageVentes } from '@/pages/commandes/PageCommandes';
import { PageDetailCommande } from '@/pages/commandes/PageDetailCommande';
import { PageConfirmationCommande } from '@/pages/commandes/PageConfirmationCommande';
import { PageRetourPaiement } from '@/pages/paiements/PageRetourPaiement';
import { PageCatalogue } from '@/pages/catalogue/PageCatalogue';
import { PageDetailProduit } from '@/pages/catalogue/PageDetailProduit';
import { PageAccompagnement } from '@/pages/agriculteur/PageAccompagnement';
import { PageAccompagnementDetail } from '@/pages/agriculteur/PageAccompagnementDetail';
import { PageAccompagnementsListe } from '@/pages/ingenieur/PageAccompagnementsListe';
import { PageAccompagnementDetailIngenieur } from '@/pages/ingenieur/PageAccompagnementDetail';
import { PageGenerationIA } from '@/pages/ingenieur/PageGenerationIA';
import { PagePlanning } from '@/pages/agriculteur/PagePlanning';
import { PageMesStatistiques } from '@/pages/statistiques/PageMesStatistiques';
import { PageStatistiquesAdmin } from '@/pages/statistiques/PageStatistiquesAdmin';
import { PageConversations } from '@/pages/messages/PageConversations';
import { PageConversationDetail } from '@/pages/messages/PageConversationDetail';
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
      { path: 'hors-connexion', element: <PageHorsConnexion /> },
    ],
  },

  // 1b. Catalogue : layout adaptatif (public pour les visiteurs, connecté si session).
  // Le backend sert `Cache-Control: public, max-age=60` + ETag sur /api/v1/produits,
  // donc le service worker Workbox met les réponses en StaleWhileRevalidate que
  // l'utilisateur soit connecté ou non — la route HTTP reste strictement identique.
  {
    path: '/catalogue',
    element: <MiseEnPageAdaptative />,
    children: [
      { index: true, element: <PageCatalogue /> },
      { path: ':identifiant', element: <PageDetailProduit /> },
    ],
  },

  // 1c. Accès interdit : layout adaptatif, même rationale que /catalogue.
  // Atteignable par un visiteur (URL directe) ou par un connecté redirigé par
  // RouteProtegee (rôle non autorisé) — ce dernier doit garder sa sidebar.
  {
    path: '/acces-interdit',
    element: <MiseEnPageAdaptative />,
    children: [{ index: true, element: <PageAccesInterdit /> }],
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
          {
            // ING-03 (F-11) — demandes reçues + missions en cours.
            path: 'accompagnements',
            element: (
              <RouteProtegee rolesAutorises={['ingenieur_agronome', 'super_admin']}>
                <PageAccompagnementsListe />
              </RouteProtegee>
            ),
          },
          {
            // ING-04 (F-11) — détail d'un accompagnement (accepter/planifier/terminer).
            path: 'accompagnements/:identifiant',
            element: (
              <RouteProtegee rolesAutorises={['ingenieur_agronome', 'super_admin']}>
                <PageAccompagnementDetailIngenieur />
              </RouteProtegee>
            ),
          },
          {
            // ING-05 (F-12) — correction d'une génération IA (ingénieur affecté).
            path: 'generations/:identifiant',
            element: (
              <RouteProtegee rolesAutorises={['ingenieur_agronome', 'super_admin']}>
                <PageGenerationIA />
              </RouteProtegee>
            ),
          },
          {
            // ING-01 placeholder — agenda synthétique (F-11, complété par la suite).
            path: 'rendez-vous',
            element: (
              <RouteProtegee rolesAutorises={['ingenieur_agronome', 'super_admin']}>
                <PageProvisoire
                  titre="Agenda des rendez-vous"
                  message="Vue agrégée des rendez-vous à venir ; en attente de la feature planning."
                />
              </RouteProtegee>
            ),
          },
        ],
      },
      {
        // Espace livreur : tableau de bord, disponibilité (LIV-01) et courses (LIV-02/03).
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
          {
            path: 'courses',
            element: (
              <RouteProtegee rolesAutorises={['livreur', 'super_admin']}>
                <PageCoursesLivreur />
              </RouteProtegee>
            ),
          },
          {
            path: 'courses/:identifiant',
            element: (
              <RouteProtegee rolesAutorises={['livreur', 'super_admin']}>
                <PageCourseDetail />
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
          {
            // ADM-03 (F-09) : file des remboursements et file des signalements.
            path: 'litiges',
            element: (
              <RouteProtegee rolesAutorises={['admin', 'super_admin']}>
                <PageLitigesAdmin />
              </RouteProtegee>
            ),
          },
          {
            // ADM-04 (F-10) : paramètres/offres/référentiels — admin en lecture
            // seule, écritures réservées au super-admin (vérifiées côté API).
            path: 'parametres',
            element: (
              <RouteProtegee rolesAutorises={['admin', 'super_admin']}>
                <PageParametresAdmin />
              </RouteProtegee>
            ),
          },
          {
            // ADM-05 (F-10) : journal d'audit, réservé super-admin (docs/03).
            path: 'audit',
            element: (
              <RouteProtegee rolesAutorises={['super_admin']}>
                <PageAuditAdmin />
              </RouteProtegee>
            ),
          },
          {
            // Soldes et reversements (F-10, Q-11).
            path: 'soldes',
            element: (
              <RouteProtegee rolesAutorises={['admin', 'super_admin']}>
                <PageSoldesAdmin />
              </RouteProtegee>
            ),
          },
          {
            // ADM-01 statistiques (F-14) — agrégats plateforme, admin et super-admin.
            path: 'statistiques',
            element: (
              <RouteProtegee rolesAutorises={['admin', 'super_admin']}>
                <PageStatistiquesAdmin />
              </RouteProtegee>
            ),
          },
        ],
      },
      {
        // « Mes gains » (F-10) : bénéficiaires de reversements (agr/liv/ing).
        path: 'mes-gains',
        element: (
          <RouteProtegee rolesAutorises={['agriculteur', 'livreur', 'ingenieur_agronome']}>
            <PageMesGains />
          </RouteProtegee>
        ),
      },
      { path: 'profil', element: <PageProfil /> },
      { path: 'notifications', element: <PageNotifications /> },
      {
        // F-13 — chat temps réel : tous les rôles connectés (la partie de la
        // relation est contrôlée par l'API, non par un garde de rôle).
        path: 'messages',
        element: (
          <RouteProtegee>
            <PageConversations />
          </RouteProtegee>
        ),
      },
      {
        path: 'messages/:identifiant',
        element: (
          <RouteProtegee>
            <PageConversationDetail />
          </RouteProtegee>
        ),
      },
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
          <RouteProtegee rolesAutorises={['acheteur', 'super_admin']}>
            <PagePanier />
          </RouteProtegee>
        ),
      },
      {
        path: 'commandes/confirmation',
        element: (
          <RouteProtegee rolesAutorises={['acheteur', 'super_admin']}>
            <PageConfirmationCommande />
          </RouteProtegee>
        ),
      },
      {
        path: 'paiements/retour',
        element: (
          <RouteProtegee rolesAutorises={['acheteur', 'super_admin']}>
            <PageRetourPaiement />
          </RouteProtegee>
        ),
      },
      {
        path: 'commandes',
        element: (
          <RouteProtegee rolesAutorises={['acheteur', 'super_admin']}>
            <PageMesCommandes />
          </RouteProtegee>
        ),
      },
      {
        path: 'commandes/:identifiant',
        element: (
          <RouteProtegee>
            <PageDetailCommande vue="achats" />
          </RouteProtegee>
        ),
      },
      {
        path: 'agriculteur/commandes',
        element: (
          <RouteProtegee rolesAutorises={['agriculteur', 'super_admin']}>
            <PageVentes />
          </RouteProtegee>
        ),
      },
      {
        path: 'agriculteur/commandes/:identifiant',
        element: (
          <RouteProtegee>
            <PageDetailCommande vue="ventes" />
          </RouteProtegee>
        ),
      },
      {
        // AGR-08 (F-11) — accompagnement agronomique côté agriculteur.
        path: 'agriculteur/accompagnement',
        element: (
          <RouteProtegee rolesAutorises={['agriculteur', 'super_admin']}>
            <PageAccompagnement />
          </RouteProtegee>
        ),
      },
      {
        path: 'agriculteur/accompagnement/:identifiant',
        element: (
          <RouteProtegee rolesAutorises={['agriculteur', 'super_admin']}>
            <PageAccompagnementDetail vue="agriculteur" />
          </RouteProtegee>
        ),
      },
      {
        // AGR-07 (F-12) — planning & recommandations IA côté agriculteur.
        path: 'agriculteur/planning',
        element: (
          <RouteProtegee rolesAutorises={['agriculteur', 'super_admin']}>
            <PagePlanning />
          </RouteProtegee>
        ),
      },
      {
        // AGR-09 (partie statistiques, F-14) — ventes, revenus, série et produits populaires.
        path: 'agriculteur/statistiques',
        element: (
          <RouteProtegee rolesAutorises={['agriculteur', 'super_admin']}>
            <PageMesStatistiques />
          </RouteProtegee>
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
