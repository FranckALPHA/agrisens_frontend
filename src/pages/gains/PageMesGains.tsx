import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Wallet } from 'lucide-react';
import { EtatChargement } from '@/components/EtatChargement';
import { EtatErreur } from '@/components/EtatErreur';
import { formaterPrix } from '@/services/api/produits';
import { obtenirMesSoldes } from '@/services/api/soldes';
import { useSessionStore } from '@/stores/session';
import { MESSAGES } from '@/theme/messages';

/**
 * Page « Mes gains » (prompt F-10 frontend point 3, Q-11) — agriculteur,
 * livreur et ingénieur : décomposition du solde recalculé par l'API
 * (gains acquis − remboursements imputés − déjà reversé). Les montants
 * viennent toujours de l'API, jamais recalculés côté client.
 */
export const PageMesGains: React.FC = () => {
  const role = useSessionStore((s) => s.utilisateur?.role);

  const requete = useQuery({
    queryKey: ['mes-gains'],
    queryFn: obtenirMesSoldes,
    refetchOnWindowFocus: true,
  });

  if (requete.isLoading) return <EtatChargement message="Calcul de vos gains…" />;
  if (requete.isError)
    return <EtatErreur message={MESSAGES.erreurReseau} surReessayer={() => requete.refetch()} />;

  const solde = requete.data;
  if (!solde) return <EtatChargement message="Calcul de vos gains…" />;

  const cartes = [
    { id: 'gains_acquis', libelle: 'Gains acquis', valeur: solde.gains_acquis },
    {
      id: 'remboursements',
      libelle: 'Remboursements imputés',
      valeur: solde.remboursements_imputes,
    },
    { id: 'deja_reverse', libelle: 'Déjà reversé', valeur: solde.deja_reverse },
  ];

  return (
    <div className="py-6 flex flex-col gap-6" data-testid="page-mes-gains">
      <header>
        <h1 className="text-xl md:text-2xl font-bold text-texte">Mes gains</h1>
        <p className="text-sm text-texte-secondaire mt-1">
          {role === 'livreur'
            ? 'Frais de livraison des courses terminées, reversés manuellement par la plateforme.'
            : role === 'ingenieur_agronome'
              ? 'L’accompagnement agronomique payant arrive avec la feature suivante ; vos gains restent à zéro pour le moment.'
              : 'Gains des commandes livrées, nets de commission, moins les remboursements imputés.'}
        </p>
      </header>

      <section
        aria-label="Solde disponible"
        className="p-6 rounded-lg border border-bordure bg-surface flex items-center gap-4"
        data-testid="carte-solde"
      >
        <span className="w-12 h-12 rounded-full bg-primaire text-white flex items-center justify-center shrink-0">
          <Wallet size={24} aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs text-texte-secondaire uppercase tracking-wide">Solde disponible</p>
          <p className="text-3xl font-bold text-texte" data-testid="solde-moi">
            {formaterPrix(solde.solde)}
          </p>
        </div>
      </section>

      <section
        aria-label="Décomposition du solde"
        className="grid grid-cols-1 sm:grid-cols-3 gap-3"
        data-testid="decomposition-gains"
      >
        {cartes.map((carte) => (
          <div key={carte.id} className="p-4 rounded-lg border border-bordure bg-surface">
            <p className="text-xs text-texte-secondaire">{carte.libelle}</p>
            <p
              className="text-2xl font-bold text-texte leading-none mt-1"
              data-testid={`gain-${carte.id}`}
            >
              {formaterPrix(carte.valeur)}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
};

export default PageMesGains;
