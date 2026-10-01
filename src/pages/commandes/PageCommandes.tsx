import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BadgeStatut } from '@/components/BadgeStatut';
import { EtatChargement } from '@/components/EtatChargement';
import { EtatErreur } from '@/components/EtatErreur';
import { EtatVide } from '@/components/EtatVide';
import { Select } from '@/components/Select';
import { STATUTS_COMMANDE } from '@/theme/statuts';
import { listerMesAchats, listerMesVentes, messageErreurCommande } from '@/services/api/commandes';
import { formaterPrix } from '@/services/api/produits';

const FILTRES_ACHETEUR = [
  { valeur: '', libelle: 'Tous statuts' },
  { valeur: 'en_attente', libelle: 'En attente' },
  { valeur: 'acceptee', libelle: 'Acceptée' },
  { valeur: 'rejetee', libelle: 'Rejetée' },
  { valeur: 'annulee', libelle: 'Annulée' },
  { valeur: 'payee', libelle: 'Payée' },
  { valeur: 'preparation', libelle: 'En préparation' },
  { valeur: 'livree', libelle: 'Livrée' },
];

/** Liste des commandes (ACH-06 mes achats, AGR-06 mes ventes selon `vue`). */
export const ListeCommandes: React.FC<{ vue: 'achats' | 'ventes' }> = ({ vue }) => {
  const [statut, setStatut] = useState('');
  const requete = useQuery({
    queryKey: [vue === 'achats' ? 'mes-achats' : 'mes-ventes', statut],
    queryFn: () =>
      vue === 'achats'
        ? listerMesAchats(statut || undefined)
        : listerMesVentes(statut || undefined),
  });
  const baseLien = vue === 'achats' ? '/commandes' : '/agriculteur/commandes';

  if (requete.isLoading) {
    return <EtatChargement pleinePage message="Chargement des commandes…" />;
  }
  if (requete.isError || !requete.data) {
    return (
      <EtatErreur
        pleinePage
        message={messageErreurCommande(requete.error)}
        surReessayer={() => requete.refetch()}
      />
    );
  }

  return (
    <div
      className="py-6 flex flex-col gap-4"
      data-testid={vue === 'achats' ? 'page-mes-commandes' : 'page-ventes'}
    >
      <header>
        <h1 className="text-2xl font-bold text-texte">
          {vue === 'achats' ? 'Mes commandes' : 'Commandes reçues'}
        </h1>
        <p className="text-sm text-texte-secondaire mt-1">
          {vue === 'achats'
            ? 'Suivez vos achats, du panier à la livraison.'
            : 'Acceptez, rejetez et préparez les commandes de vos clients.'}
        </p>
      </header>

      <div className="w-full sm:w-56">
        <Select
          label="Filtrer par statut"
          value={statut}
          onChange={(e) => setStatut(e.target.value)}
          options={FILTRES_ACHETEUR}
          data-testid="filtre-statut-commande"
        />
      </div>

      {requete.data.elements.length === 0 ? (
        <EtatVide
          titre="Aucune commande"
          message={
            vue === 'achats'
              ? 'Vos commandes apparaîtront ici après votre premier achat.'
              : 'Les commandes de vos clients apparaîtront ici.'
          }
          action={
            vue === 'achats' ? (
              <Link to="/catalogue" className="text-primaire underline">
                Voir le catalogue
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {requete.data.elements.map((commande) => (
            <li
              key={commande.id}
              className="rounded-lg border border-bordure bg-surface p-4 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between gap-2">
                <Link
                  to={`${baseLien}/${commande.id}`}
                  className="font-bold text-texte hover:text-primaire"
                >
                  {commande.reference}
                </Link>
                <BadgeStatut
                  statut={commande.statut ?? ''}
                  registre={STATUTS_COMMANDE}
                  taille="sm"
                />
              </div>
              <p className="text-sm text-texte-secondaire">
                {vue === 'achats'
                  ? `Vendeur : ${commande.agriculteur_nom}`
                  : `Client : ${commande.acheteur_nom}`}{' '}
                · {commande.nombre_lignes} ligne(s)
              </p>
              <p className="text-sm font-bold text-texte">{formaterPrix(commande.total_fcfa)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/** ACH-06 — mes achats. */
export const PageMesCommandes: React.FC = () => <ListeCommandes vue="achats" />;

/** AGR-06 (liste) — mes ventes. */
export const PageVentes: React.FC = () => <ListeCommandes vue="ventes" />;
