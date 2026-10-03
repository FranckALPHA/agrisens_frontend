import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BadgeStatut } from '@/components/BadgeStatut';
import { EtatChargement } from '@/components/EtatChargement';
import { listerMesRemboursements } from '@/services/api/litiges';
import { formaterPrix } from '@/services/api/produits';
import { STATUTS_REMBOURSEMENT } from '@/theme/statuts';

/**
 * ACH-07 — suivi du statut d'un remboursement demandé sur cette commande.
 * Affiche l'état d'avancement, le montant accordé, le motif de décision et
 * la référence du renvoi une fois le remboursement effectué.
 */
export const SuiviRemboursement: React.FC<{ commandeId: string }> = ({ commandeId }) => {
  const requete = useQuery({
    queryKey: ['mes-remboursements'],
    queryFn: listerMesRemboursements,
    retry: false,
  });

  if (requete.isLoading) return <EtatChargement message="Chargement du remboursement…" />;
  const remboursement = (requete.data ?? []).find((r) => r.commande === commandeId);
  if (!remboursement) return null;

  return (
    <section
      aria-label="Suivi du remboursement"
      className="rounded-lg border border-bordure bg-surface p-4 flex flex-col gap-2"
      data-testid="suivi-remboursement"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold text-texte">Remboursement</h3>
        <BadgeStatut statut={remboursement.statut} registre={STATUTS_REMBOURSEMENT} taille="sm" />
      </div>
      <dl className="text-sm grid grid-cols-2 gap-y-1">
        <dt className="text-texte-muet">Montant demandé</dt>
        <dd className="text-texte">{formaterPrix(remboursement.montant_demande_fcfa)}</dd>
        {remboursement.montant_accorde_fcfa !== null && (
          <>
            <dt className="text-texte-muet">Montant accordé</dt>
            <dd className="text-texte" data-testid="remboursement-accorde">
              {formaterPrix(remboursement.montant_accorde_fcfa)}
            </dd>
          </>
        )}
      </dl>
      {remboursement.motif_decision && (
        <p className="text-sm text-texte-secondaire" data-testid="remboursement-motif-decision">
          Décision : {remboursement.motif_decision}
        </p>
      )}
      {remboursement.reference_operateur && (
        <p className="text-sm text-texte" data-testid="remboursement-reference">
          Référence du renvoi : {remboursement.reference_operateur}
        </p>
      )}
      {remboursement.statut === 'effectue' && (
        <p className="text-sm font-medium text-succes" data-testid="remboursement-rembourse">
          Commande remboursée.
        </p>
      )}
    </section>
  );
};
