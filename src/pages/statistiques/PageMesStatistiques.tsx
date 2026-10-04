import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { EtatChargement } from '@/components/EtatChargement';
import { EtatErreur } from '@/components/EtatErreur';
import { EtatVide } from '@/components/EtatVide';
import { GrapheBarres } from '@/components/GrapheBarres';
import { formaterPrix } from '@/services/api/produits';
import {
  formaterPeriode,
  obtenirMesVentes,
  type FiltreStatistique,
} from '@/services/api/statistiques';
import { CarteStat } from '@/pages/statistiques/CarteStat';
import { SelecteurPeriode } from '@/pages/statistiques/SelecteurPeriode';
import { MESSAGES } from '@/theme/messages';

/**
 * AGR-09 (partie statistiques, F-14) — ventes de l'agriculteur : cartes de
 * chiffres clés, graphique du chiffre d'affaires par période et produits les
 * plus vendus. Les totaux viennent de `GET /statistiques/mes-ventes` (données
 * confirmées uniquement — jamais recalculés côté client).
 */
export const PageMesStatistiques: React.FC = () => {
  const [filtre, setFiltre] = useState<FiltreStatistique>({ granularite: 'mois' });

  const requete = useQuery({
    queryKey: ['statistiques', 'mes-ventes', filtre],
    queryFn: () => obtenirMesVentes(filtre),
  });

  if (requete.isLoading) return <EtatChargement message="Calcul de vos statistiques…" />;
  if (requete.isError) {
    return <EtatErreur message={MESSAGES.erreurReseau} surReessayer={() => requete.refetch()} />;
  }

  const stats = requete.data;
  if (!stats) return <EtatChargement message="Calcul de vos statistiques…" />;
  const granularite = filtre.granularite ?? 'mois';
  const points = stats.serie.map((p) => ({
    libelle: formaterPeriode(p.periode, granularite),
    valeur: p.montant_fcfa,
  }));

  return (
    <div className="py-6 flex flex-col gap-6" data-testid="page-mes-statistiques">
      <header>
        <h1 className="text-xl md:text-2xl font-bold text-texte">Mes statistiques</h1>
        <p className="text-sm text-texte-secondaire mt-1">
          Ventes confirmées (commandes livrées), filtrables par période.
        </p>
      </header>

      <SelecteurPeriode valeur={filtre} onChange={setFiltre} />

      <section
        aria-label="Chiffres clés"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
        data-testid="cartes-mes-ventes"
      >
        <CarteStat
          id="revenu_net"
          libelle="Revenu net"
          valeur={formaterPrix(stats.revenu_net_fcfa)}
          detail="Chiffre d'affaires moins commissions"
        />
        <CarteStat
          id="ca_brut"
          libelle="Chiffre d’affaires brut"
          valeur={formaterPrix(stats.chiffre_affaires_brut_fcfa)}
        />
        <CarteStat
          id="nb_ventes"
          libelle="Commandes livrées"
          valeur={String(stats.nombre_ventes)}
          detail={
            stats.commissions_fcfa > 0
              ? `Commissions : ${formaterPrix(stats.commissions_fcfa)}`
              : undefined
          }
        />
        <CarteStat
          id="quantite"
          libelle="Quantités vendues"
          valeur={stats.quantite_totale.toLocaleString('fr-FR', { maximumFractionDigits: 3 })}
          detail="Toutes unités confondues"
        />
      </section>

      <section
        aria-label="Chiffre d’affaires par période"
        className="p-4 rounded-lg border border-bordure bg-surface"
        data-testid="section-graphe-ventes"
      >
        <h2 className="text-sm font-semibold text-texte mb-3">
          Chiffre d’affaires — {granularite}
        </h2>
        <GrapheBarres
          points={points}
          titre="Chiffre d’affaires par période"
          formater={formaterPrix}
          testid="graphe-mes-ventes"
        />
      </section>

      <section aria-label="Produits les plus vendus" data-testid="section-produits-populaires">
        <h2 className="text-sm font-semibold text-texte mb-2">Produits les plus vendus</h2>
        {stats.produits_populaires.length === 0 ? (
          <EtatVide
            titre="Aucune vente"
            message="Vos produits apparaîtront ici dès la première commande livrée."
          />
        ) : (
          <ul className="divide-y divide-bordure rounded-lg border border-bordure bg-surface">
            {stats.produits_populaires.map((produit) => (
              <li
                key={produit.nom_produit}
                className="p-3 flex items-center justify-between gap-3"
                data-testid={`produit-populaire-${produit.nom_produit}`}
              >
                <span className="text-sm font-medium text-texte">{produit.nom_produit}</span>
                <span className="text-sm text-texte-secondaire text-right">
                  {produit.unites.toLocaleString('fr-FR', { maximumFractionDigits: 3 })} unités ·{' '}
                  {formaterPrix(produit.total_fcfa)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default PageMesStatistiques;
