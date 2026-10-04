import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { EtatChargement } from '@/components/EtatChargement';
import { EtatErreur } from '@/components/EtatErreur';
import { GrapheBarres } from '@/components/GrapheBarres';
import { formaterPrix } from '@/services/api/produits';
import {
  formaterPeriode,
  obtenirStatistiquesPlateforme,
  type FiltreStatistique,
} from '@/services/api/statistiques';
import { CarteStat } from '@/pages/statistiques/CarteStat';
import { SelecteurPeriode } from '@/pages/statistiques/SelecteurPeriode';
import { MESSAGES } from '@/theme/messages';

/** Libellés français des statuts connus des agrégats plateforme. */
const LIBELLES_STATUT: Record<string, string> = {
  en_attente: 'En attente',
  acceptee: 'Acceptée',
  paiement_en_attente: 'Paiement en attente',
  payee: 'Payée',
  preparation: 'En préparation',
  remise_au_livreur: 'Remise au livreur',
  livree: 'Livrée',
  rejetee: 'Rejetée',
  annulee: 'Annulée',
  client_absent: 'Client absent',
  echec_livraison: 'Échec livraison',
  remboursement_en_attente: 'Remboursement en attente',
  remboursee: 'Remboursée',
  proposee: 'Proposée',
  en_cours: 'En cours',
  demandee: 'Demandée',
  refusee: 'Refusée',
  planifiee: 'Planifiée',
  terminee: 'Terminée',
  manquee: 'Manquée',
  reussie: 'Réussie',
  echouee: 'Échouée',
  annulee_ia: 'Annulée',
  agriculteur: 'Agriculteurs',
  acheteur: 'Acheteurs',
  ingenieur_agronome: 'Ingénieurs',
  livreur: 'Livreurs',
  admin: 'Administrateurs',
  super_admin: 'Super-admins',
};

function libelleStatut(statut: string): string {
  return LIBELLES_STATUT[statut] ?? statut;
}

function BlocRepartition({
  titre,
  repartition,
  testid,
}: {
  titre: string;
  repartition: Record<string, number>;
  testid: string;
}) {
  const entrees = Object.entries(repartition).sort((a, b) => b[1] - a[1]);
  return (
    <section
      aria-label={titre}
      className="p-4 rounded-lg border border-bordure bg-surface"
      data-testid={testid}
    >
      <h2 className="text-sm font-semibold text-texte mb-2">{titre}</h2>
      {entrees.length === 0 ? (
        <p className="text-sm text-texte-muet">Aucune donnée sur la période.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {entrees.map(([statut, nombre]) => (
            <li key={statut} className="flex items-center justify-between text-sm">
              <span className="text-texte-secondaire">{libelleStatut(statut)}</span>
              <span className="font-semibold text-texte" data-testid={`${testid}-${statut}`}>
                {nombre}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * ADM-01 statistiques (F-14) — vue globale de la plateforme pour admin et
 * super-admin : utilisateurs, volumes, revenus, remboursements, livraisons,
 * accompagnements, générations IA et série du chiffre d'affaires. Tout vient
 * de `GET /statistiques/plateforme` (données confirmées).
 */
export const PageStatistiquesAdmin: React.FC = () => {
  const [filtre, setFiltre] = useState<FiltreStatistique>({ granularite: 'mois' });

  const requete = useQuery({
    queryKey: ['statistiques', 'plateforme', filtre],
    queryFn: () => obtenirStatistiquesPlateforme(filtre),
  });

  if (requete.isLoading)
    return <EtatChargement message="Agrégation des statistiques plateforme…" />;
  if (requete.isError) {
    return <EtatErreur message={MESSAGES.erreurReseau} surReessayer={() => requete.refetch()} />;
  }

  const stats = requete.data;
  if (!stats) return <EtatChargement message="Agrégation des statistiques plateforme…" />;

  const granularite = filtre.granularite ?? 'mois';
  const points = stats.serie.map((p) => ({
    libelle: formaterPeriode(p.periode, granularite),
    valeur: p.montant_fcfa,
  }));

  return (
    <div className="py-6 flex flex-col gap-6" data-testid="page-statistiques-admin">
      <header>
        <h1 className="text-xl md:text-2xl font-bold text-texte">Statistiques de la plateforme</h1>
        <p className="text-sm text-texte-secondaire mt-1">
          Volumétrie et revenus sur les données confirmées, filtrables par période.
        </p>
      </header>

      <SelecteurPeriode valeur={filtre} onChange={setFiltre} testid="selecteur-periode-admin" />

      <section
        aria-label="Chiffres clés"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
        data-testid="cartes-plateforme"
      >
        <CarteStat
          id="total_utilisateurs"
          libelle="Utilisateurs"
          valeur={String(stats.total_utilisateurs)}
        />
        <CarteStat
          id="total_commandes"
          libelle="Commandes"
          valeur={String(stats.total_commandes)}
        />
        <CarteStat
          id="chiffre_affaires"
          libelle="Chiffre d’affaires"
          valeur={formaterPrix(stats.chiffre_affaires_fcfa)}
          detail="Commandes livrées"
        />
        <CarteStat
          id="revenus"
          libelle="Revenus plateforme"
          valeur={formaterPrix(stats.revenus_plateforme_fcfa)}
          detail="Commissions commandes + accompagnements"
        />
        <CarteStat
          id="remboursements"
          libelle="Remboursements"
          valeur={String(stats.remboursements.nombre)}
          detail={`${formaterPrix(stats.remboursements.montant_effectue_fcfa)} effectués`}
        />
        <CarteStat id="livraisons" libelle="Livraisons" valeur={String(stats.total_livraisons)} />
        <CarteStat
          id="accompagnements"
          libelle="Accompagnements"
          valeur={String(stats.total_accompagnements)}
        />
        <CarteStat
          id="generations_ia"
          libelle="Générations IA"
          valeur={String(stats.total_generations_ia)}
        />
      </section>

      <section
        aria-label="Volume du chiffre d’affaires par période"
        className="p-4 rounded-lg border border-bordure bg-surface"
        data-testid="section-graphe-plateforme"
      >
        <h2 className="text-sm font-semibold text-texte mb-3">
          Commandes et volume — {granularite}
        </h2>
        <GrapheBarres
          points={points}
          titre="Volume du chiffre d’affaires par période"
          formater={formaterPrix}
          testid="graphe-plateforme"
        />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <BlocRepartition
          titre="Utilisateurs par rôle"
          repartition={stats.utilisateurs_par_role}
          testid="repartition-utilisateurs"
        />
        <BlocRepartition
          titre="Commandes par statut"
          repartition={stats.commandes_par_statut}
          testid="repartition-commandes"
        />
        <BlocRepartition
          titre="Livraisons par statut"
          repartition={stats.livraisons_par_statut}
          testid="repartition-livraisons"
        />
        <BlocRepartition
          titre="Accompagnements par statut"
          repartition={stats.accompagnements_par_statut}
          testid="repartition-accompagnements"
        />
        <BlocRepartition
          titre="Générations IA par statut"
          repartition={stats.generations_ia_par_statut}
          testid="repartition-generations-ia"
        />
      </div>
    </div>
  );
};

export default PageStatistiquesAdmin;
