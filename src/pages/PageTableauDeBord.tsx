import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useSessionStore } from '@/stores/session';
import { obtenirMenuRole, type RoleUtilisateur } from '@/app/menus';
import { CompteursAdmin } from '@/pages/admin/CompteursAdmin';
import { CarteStat } from '@/pages/statistiques/CarteStat';
import { EtatChargement } from '@/components/EtatChargement';
import { EtatErreur } from '@/components/EtatErreur';
import { formaterPrix } from '@/services/api/produits';
import { listerMesVentes, listerMesAchats } from '@/services/api/commandes';
import { listerDemandes } from '@/services/api/accompagnements';
import { listerLivraisonsDisponibles } from '@/services/api/livraisons';
import { obtenirCompteurNotifications } from '@/services/api/notifications';
import {
  obtenirMesVentes,
  obtenirMesLivraisons,
  obtenirMesAccompagnements,
  obtenirStatistiquesPlateforme,
} from '@/services/api/statistiques';
import { MESSAGES } from '@/theme/messages';

const TITRES_PAR_ROLE: Record<RoleUtilisateur, string> = {
  agriculteur: 'Espace Agriculteur',
  acheteur: 'Espace Acheteur',
  ingenieur_agronome: 'Espace Ingénieur Agronome',
  livreur: 'Espace Livreur',
  admin: 'Espace Administration',
  super_admin: 'Espace Super Administration',
};

/** Premier jour du mois courant (ISO, filtre `du` des statistiques). */
function debutDuMois(): string {
  const maintenant = new Date();
  return `${maintenant.getFullYear()}-${String(maintenant.getMonth() + 1).padStart(2, '0')}-01`;
}

const grilleCartes = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3';

interface ActionRapide {
  id: string;
  libelle: string;
  chemin: string;
}

const ActionsRapides: React.FC<{ actions: ActionRapide[]; testid: string }> = ({
  actions,
  testid,
}) => (
  <nav aria-label="Actions rapides" className="flex flex-wrap gap-2" data-testid={testid}>
    {actions.map((action) => (
      <Link
        key={action.id}
        to={action.chemin}
        className="min-h-tactile px-4 py-2 rounded-lg border border-bordure bg-surface text-sm font-medium text-texte hover:border-primaire hover:text-primaire transition-colors"
        data-testid={`action-rapide-${action.id}`}
      >
        {action.libelle}
      </Link>
    ))}
  </nav>
);

/** Bloc chiffres clés avec ses états chargement / erreur (jamais de crash du tableau de bord). */
function gardeBloc<T>(requete: ReturnType<typeof useQuery<T>>) {
  if (requete.isLoading) return <EtatChargement message="Chargement de vos chiffres…" />;
  if (requete.isError || requete.data === undefined)
    return <EtatErreur message={MESSAGES.erreurReseau} surReessayer={() => requete.refetch()} />;
  return null;
}

// --- AGR-01 — tableau de bord agriculteur ----------------------------------

const TableauDeBordAgriculteur: React.FC = () => {
  const statistiques = useQuery({
    queryKey: ['statistiques', 'mes-ventes', 'mois-courant'],
    queryFn: () => obtenirMesVentes({ du: debutDuMois() }),
  });
  const aTraiter = useQuery({
    queryKey: ['commandes', 'mes-ventes', 'en_attente'],
    queryFn: () => listerMesVentes('en_attente'),
  });

  const garde = gardeBloc(statistiques);
  if (garde) return garde;
  const stats = statistiques.data!;

  const gardeAttente = gardeBloc(aTraiter);
  const enAttente = gardeAttente ? null : aTraiter.data!.total;

  return (
    <section
      aria-label="Statistiques de ventes"
      className="flex flex-col gap-3"
      data-testid="tb-agriculteur"
    >
      <div className={grilleCartes}>
        <CarteStat
          id="ca_mois"
          libelle="Chiffre d’affaires du mois"
          valeur={formaterPrix(stats.chiffre_affaires_brut_fcfa)}
        />
        <CarteStat
          id="revenu_mois"
          libelle="Revenu net du mois"
          valeur={formaterPrix(stats.revenu_net_fcfa)}
        />
        <CarteStat
          id="ventes_mois"
          libelle="Commandes livrées ce mois"
          valeur={String(stats.nombre_ventes)}
        />
        {enAttente !== null ? (
          <Link to="/agriculteur/commandes?statut=en_attente" data-testid="tb-commandes-a-traiter">
            <CarteStat
              id="a_traiter"
              libelle="Commandes reçues à traiter"
              valeur={String(enAttente)}
              testid="carte-stat-a_traiter-lien"
            />
          </Link>
        ) : (
          <CarteStat id="a_traiter" libelle="Commandes reçues à traiter" valeur="…" />
        )}
      </div>
      <ActionsRapides
        testid="actions-agriculteur"
        actions={[
          { id: 'statistiques', libelle: 'Mes statistiques', chemin: '/agriculteur/statistiques' },
          { id: 'produit', libelle: 'Ajouter un produit', chemin: '/agriculteur/produits/nouveau' },
          { id: 'planning', libelle: 'Planning IA', chemin: '/agriculteur/planning' },
        ]}
      />
    </section>
  );
};

// --- ACH-01 — tableau de bord acheteur --------------------------------------

const STATUTS_EN_COURS = new Set([
  'en_attente',
  'acceptee',
  'paiement_en_attente',
  'payee',
  'preparation',
  'remise_au_livreur',
]);

const TableauDeBordAcheteur: React.FC = () => {
  const achats = useQuery({
    queryKey: ['commandes', 'mes-achats'],
    queryFn: () => listerMesAchats(),
  });
  const notifications = useQuery({
    queryKey: ['notifications', 'compteur'],
    queryFn: obtenirCompteurNotifications,
    refetchInterval: 60_000,
  });

  const garde = gardeBloc(achats);
  if (garde) return garde;
  const enCours = achats.data!.elements.filter((c) => STATUTS_EN_COURS.has(c.statut ?? '')).length;

  const notifs = notifications.data;

  return (
    <section
      aria-label="Activité acheteur"
      className="flex flex-col gap-3"
      data-testid="tb-acheteur"
    >
      <div className={grilleCartes}>
        <CarteStat id="achats_en_cours" libelle="Commandes en cours" valeur={String(enCours)} />
        <CarteStat
          id="notifications"
          libelle="Notifications non lues"
          valeur={notifs === undefined ? '…' : String(notifs)}
        />
      </div>
      <ActionsRapides
        testid="actions-acheteur"
        actions={[
          { id: 'catalogue', libelle: 'Parcourir le catalogue', chemin: '/catalogue' },
          { id: 'panier', libelle: 'Mon panier', chemin: '/panier' },
          { id: 'commandes', libelle: 'Mes commandes', chemin: '/commandes' },
        ]}
      />
    </section>
  );
};

// --- ING-01 — tableau de bord ingénieur -------------------------------------

const TableauDeBordIngenieur: React.FC = () => {
  const statistiques = useQuery({
    queryKey: ['statistiques', 'mes-accompagnements'],
    queryFn: () => obtenirMesAccompagnements(),
  });
  const demandes = useQuery({
    queryKey: ['accompagnements', 'demandes'],
    queryFn: listerDemandes,
  });

  const garde = gardeBloc(statistiques);
  if (garde) return garde;
  const stats = statistiques.data!;
  const enCours =
    (stats.accompagnements_par_statut['acceptee'] ?? 0) +
    (stats.accompagnements_par_statut['planifiee'] ?? 0) +
    (stats.accompagnements_par_statut['en_cours'] ?? 0);

  const gardeDemandes = gardeBloc(demandes);
  const nouvellesDemandes = gardeDemandes
    ? null
    : demandes.data!.filter((d) => d.statut === 'demandee').length;

  return (
    <section
      aria-label="Activité ingénieur"
      className="flex flex-col gap-3"
      data-testid="tb-ingenieur"
    >
      <div className={grilleCartes}>
        <CarteStat id="missions" libelle="Missions en cours" valeur={String(enCours)} />
        <CarteStat
          id="terminees"
          libelle="Accompagnements terminés"
          valeur={String(stats.terminees)}
        />
        <CarteStat
          id="revenu"
          libelle="Revenu net cumulé"
          valeur={formaterPrix(stats.revenu_net_fcfa)}
        />
        {nouvellesDemandes !== null ? (
          <Link to="/ingenieur/accompagnements" data-testid="tb-demandes-nouvelles">
            <CarteStat
              id="demandes"
              libelle="Nouvelles demandes"
              valeur={String(nouvellesDemandes)}
              testid="carte-stat-demandes-lien"
            />
          </Link>
        ) : (
          <CarteStat id="demandes" libelle="Nouvelles demandes" valeur="…" />
        )}
      </div>
      <ActionsRapides
        testid="actions-ingenieur"
        actions={[
          { id: 'missions', libelle: 'Mes missions', chemin: '/ingenieur/accompagnements' },
          { id: 'profil', libelle: 'Profil professionnel', chemin: '/ingenieur/profil-pro' },
        ]}
      />
    </section>
  );
};

// --- LIV-01 — tableau de bord livreur ---------------------------------------

const TableauDeBordLivreur: React.FC = () => {
  const statistiques = useQuery({
    queryKey: ['statistiques', 'mes-livraisons'],
    queryFn: () => obtenirMesLivraisons(),
  });
  const disponibles = useQuery({
    queryKey: ['livraisons', 'disponibles'],
    queryFn: listerLivraisonsDisponibles,
  });

  const garde = gardeBloc(statistiques);
  if (garde) return garde;
  const stats = statistiques.data!;

  const gardeDispo = gardeBloc(disponibles);
  const propositions = gardeDispo ? null : disponibles.data!.length;

  return (
    <section aria-label="Activité livreur" className="flex flex-col gap-3" data-testid="tb-livreur">
      <div className={grilleCartes}>
        <CarteStat
          id="livraisons"
          libelle="Courses au total"
          valeur={String(stats.nombre_livraisons)}
        />
        <CarteStat id="livrees" libelle="Courses livrées" valeur={String(stats.livrees)} />
        <CarteStat
          id="frais"
          libelle="Frais cumulés (livrées)"
          valeur={formaterPrix(stats.frais_cumules_fcfa)}
        />
        {propositions !== null ? (
          <Link to="/livreur/courses" data-testid="tb-courses-disponibles">
            <CarteStat
              id="disponibles"
              libelle="Courses disponibles"
              valeur={String(propositions)}
              testid="carte-stat-disponibles-lien"
            />
          </Link>
        ) : (
          <CarteStat id="disponibles" libelle="Courses disponibles" valeur="…" />
        )}
      </div>
      <ActionsRapides
        testid="actions-livreur"
        actions={[
          { id: 'courses', libelle: 'Mes courses', chemin: '/livreur/courses' },
          { id: 'disponibilite', libelle: 'Ma disponibilité', chemin: '/livreur/disponibilite' },
        ]}
      />
    </section>
  );
};

// --- ADM-01 — tableau de bord administration --------------------------------

const TableauDeBordAdmin: React.FC = () => {
  const statistiques = useQuery({
    queryKey: ['statistiques', 'plateforme', 'mois-courant'],
    queryFn: () => obtenirStatistiquesPlateforme({ du: debutDuMois() }),
    refetchInterval: 120_000,
  });

  const garde = gardeBloc(statistiques);
  if (garde) return garde;
  const stats = statistiques.data!;

  return (
    <section
      aria-label="Statistiques plateforme"
      className="flex flex-col gap-3"
      data-testid="tb-admin"
    >
      <div className={grilleCartes}>
        <CarteStat
          id="commandes_mois"
          libelle="Commandes ce mois"
          valeur={String(stats.total_commandes)}
        />
        <CarteStat
          id="ca_mois"
          libelle="Chiffre d’affaires du mois"
          valeur={formaterPrix(stats.chiffre_affaires_fcfa)}
        />
        <CarteStat
          id="revenus_mois"
          libelle="Revenus plateforme du mois"
          valeur={formaterPrix(stats.revenus_plateforme_fcfa)}
        />
        <Link to="/admin/statistiques" data-testid="tb-statistiques-completes">
          <CarteStat
            id="detail"
            libelle="Statistiques complètes"
            valeur="→"
            detail="Volumes, répartitions, séries"
            testid="carte-stat-detail-lien"
          />
        </Link>
      </div>
    </section>
  );
};

// --- Page -------------------------------------------------------------------

/**
 * Tableaux de bord par rôle (F-14, AGR-01 / ACH-01 / ING-01 / LIV-01 / ADM-01) :
 * chiffres clés issus des endpoints de statistiques (données confirmées),
 * éléments en attente et actions rapides ; le menu complet reste en accès
 * rapide. Les blocs chiffrés ne sont demandés que si l'espace visité
 * correspond au rôle réel de la session (un super-admin qui consulte l'espace
 * agriculteur ne reçoit pas de 403 — les endpoints sont réservés par rôle).
 */
export const PageTableauDeBord: React.FC<{ role?: RoleUtilisateur }> = ({ role }) => {
  const utilisateur = useSessionStore((s) => s.utilisateur);
  const roleEffectif = (utilisateur?.role ?? role ?? 'acheteur') as RoleUtilisateur;
  const menu = obtenirMenuRole(roleEffectif);
  const memeRole = utilisateur?.role === roleEffectif;

  return (
    <div className="py-6 flex flex-col gap-8" data-testid="tableau-de-bord">
      <section>
        <h1 className="text-2xl font-bold text-texte">
          {TITRES_PAR_ROLE[roleEffectif] || 'Bienvenue'}
        </h1>
        <p className="text-sm text-texte-secondaire mt-1">
          Bienvenue{utilisateur?.nom ? `, ${utilisateur.nom}` : ''} — votre session est ouverte.
        </p>
      </section>

      {/* ADM-01 : compteurs d'attention puis chiffres plateforme (F-03 + F-14). */}
      {(roleEffectif === 'admin' || roleEffectif === 'super_admin') && (
        <>
          <CompteursAdmin />
          {memeRole && <TableauDeBordAdmin />}
        </>
      )}

      {memeRole && roleEffectif === 'agriculteur' && <TableauDeBordAgriculteur />}
      {memeRole && roleEffectif === 'acheteur' && <TableauDeBordAcheteur />}
      {memeRole && roleEffectif === 'ingenieur_agronome' && <TableauDeBordIngenieur />}
      {memeRole && roleEffectif === 'livreur' && <TableauDeBordLivreur />}

      <nav aria-label="Accès rapide" className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-xl">
        {menu.map((item) => (
          <Link
            key={item.id}
            to={item.chemin}
            className="p-4 rounded-lg border border-bordure bg-surface text-sm font-medium text-texte hover:border-primaire hover:text-primaire transition-colors min-h-tactile flex items-center"
          >
            {item.libelle}
          </Link>
        ))}
      </nav>
    </div>
  );
};
