import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { TeleversementFichier } from '@/components/TeleversementFichier';
import { Bouton } from '@/components/Bouton';
import { Champ } from '@/components/Champ';
import { Select } from '@/components/Select';
import { ErreurApi } from '@/services/api/client';
import {
  demanderRemboursement,
  messageErreurLitige,
  MOTIFS_JUSTIFICATIF_REQUIS,
  MOTIFS_REMBOURSEMENT,
  type MotifRemboursementApi,
} from '@/services/api/litiges';
import { formaterPrix } from '@/services/api/produits';
import type { FichierApi } from '@/services/api/fichiers';

/**
 * ACH-07 — « Demander un remboursement » (prompt F-09 frontend point 1) :
 * motif, montant (≤ paiement), justificatifs (photo) et délai restant.
 * Le contrôle réel (délai 48 h, justificatif obligatoire, montant ≤ payé)
 * est fait par le service backend ; l'interface guide et affiche l'erreur.
 */
export const DemandeRemboursement: React.FC<{
  commandeId: string;
  montantPayeFcfa: number;
  onDemande?: () => void;
}> = ({ commandeId, montantPayeFcfa, onDemande }) => {
  const clientRequete = useQueryClient();
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState<MotifRemboursementApi>('produit_endommage');
  const [montant, setMontant] = useState('');
  const [justificatifs, setJustificatifs] = useState<FichierApi[]>([]);
  const [erreur, setErreur] = useState<unknown>(null);
  const [travail, setTravail] = useState(false);

  const justificatifRequis = MOTIFS_JUSTIFICATIF_REQUIS.has(motif);
  const montantNum = Number.parseInt(montant, 10);
  const montantValide =
    Number.isFinite(montantNum) && montantNum > 0 && montantNum <= montantPayeFcfa;
  const photoManquante = justificatifRequis && justificatifs.length === 0;
  const peutSoumettre = montantValide && !photoManquante && !travail;

  const soumettre = async () => {
    setErreur(null);
    setTravail(true);
    try {
      await demanderRemboursement({
        commande_id: commandeId,
        motif,
        montant_demande_fcfa: montantNum,
        justificatifs: justificatifs.map((f) => f.id),
      });
      await clientRequete.invalidateQueries({ queryKey: ['mes-remboursements'] });
      await clientRequete.invalidateQueries({ queryKey: ['commande', commandeId] });
      setOuvert(false);
      setMontant('');
      setJustificatifs([]);
      onDemande?.();
    } catch (cause) {
      setErreur(cause);
    } finally {
      setTravail(false);
    }
  };

  if (!ouvert) {
    return (
      <div className="flex flex-col gap-2">
        <Bouton
          variante="secondaire"
          onClick={() => setOuvert(true)}
          data-testid="bouton-demander-remboursement"
        >
          Demander un remboursement
        </Bouton>
        <p className="text-xs text-texte-secondaire">
          Vous disposez de 48 h après la livraison pour demander un remboursement.
        </p>
      </div>
    );
  }

  return (
    <section
      aria-label="Demande de remboursement"
      className="rounded-lg border border-bordure bg-surface p-4 flex flex-col gap-3"
      data-testid="formulaire-remboursement"
    >
      <h3 className="font-bold text-texte">Demander un remboursement</h3>
      <p className="text-xs text-texte-secondaire">
        Délai : 48 h après la livraison. Montant maximum : {formaterPrix(montantPayeFcfa)}.
      </p>

      <Select
        label="Motif"
        value={motif}
        onChange={(e) => setMotif(e.target.value as MotifRemboursementApi)}
        options={MOTIFS_REMBOURSEMENT.map((m) => ({ valeur: m.valeur, libelle: m.libelle }))}
        data-testid="selecteur-motif-remboursement"
      />

      <Champ
        label="Montant demandé (FCFA)"
        type="number"
        value={montant}
        onChange={(e) => setMontant(e.target.value)}
        aide={`Entre 1 et ${montantPayeFcfa} FCFA.`}
        data-testid="champ-montant-remboursement"
      />

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-texte">
          Justificatifs {justificatifRequis ? '(obligatoires pour ce motif)' : '(facultatifs)'}
        </p>
        <TeleversementFichier
          contexte="justificatif"
          limiteImageMo={5}
          limiteDocumentMo={10}
          accept="image/jpeg,image/png"
          libelle="Ajouter une photo"
          onTeleverse={(fichier) => setJustificatifs((prec) => [...prec, fichier])}
        />
        {justificatifs.length > 0 && (
          <ul
            className="text-xs text-texte-secondaire flex flex-col gap-1"
            data-testid="liste-justificatifs"
          >
            {justificatifs.map((f) => (
              <li key={f.id}>📎 {f.nom_original}</li>
            ))}
          </ul>
        )}
        {photoManquante && (
          <p className="text-xs text-erreur" data-testid="aide-justificatif-requis">
            Ce motif exige au moins une photo ou un justificatif.
          </p>
        )}
      </div>

      {erreur ? (
        <p role="alert" className="rounded border border-red-200 bg-red-50 p-2 text-sm text-erreur">
          {erreur instanceof ErreurApi ? messageErreurLitige(erreur) : 'Demande impossible.'}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Bouton
          chargement={travail}
          disabled={!peutSoumettre}
          onClick={() => void soumettre()}
          data-testid="bouton-confirmer-remboursement"
        >
          Envoyer la demande
        </Bouton>
        <Bouton variante="secondaire" onClick={() => setOuvert(false)}>
          Annuler
        </Bouton>
      </div>
    </section>
  );
};
