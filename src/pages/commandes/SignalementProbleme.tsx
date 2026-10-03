import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { TeleversementFichier } from '@/components/TeleversementFichier';
import { Bouton } from '@/components/Bouton';
import { Champ } from '@/components/Champ';
import { Select } from '@/components/Select';
import { ErreurApi } from '@/services/api/client';
import type { FichierApi } from '@/services/api/fichiers';
import { creerSignalement, messageErreurLitige, MOTIFS_SIGNALEMENT } from '@/services/api/litiges';

/**
 * ACH-07 / ACH-08 — « Signaler un problème » (prompt F-09 frontend point 1) :
 * signalement sur la commande courante, motif + description + photo. La
 * création d'un signalement est possible pour tout utilisateur authentifié ;
 * l'accès et la cible sont vérifiés par l'API (404 sinon).
 */
export const SignalementProbleme: React.FC<{ cibleId: string }> = ({ cibleId }) => {
  const clientRequete = useQueryClient();
  const [ouvert, setOuvert] = useState(false);
  const [motif, setMotif] = useState<string>(MOTIFS_SIGNALEMENT[0]!.valeur);
  const [description, setDescription] = useState('');
  const [fichiers, setFichiers] = useState<FichierApi[]>([]);
  const [erreur, setErreur] = useState<unknown>(null);
  const [travail, setTravail] = useState(false);

  const peutSoumettre = description.trim().length > 0 && !travail;

  const soumettre = async () => {
    setErreur(null);
    setTravail(true);
    try {
      await creerSignalement({
        cible_type: 'commande',
        cible_id: cibleId,
        motif,
        description: description.trim(),
        fichier_ids: fichiers.map((f) => f.id),
      });
      await clientRequete.invalidateQueries({ queryKey: ['mes-signalements'] });
      setOuvert(false);
      setDescription('');
      setFichiers([]);
    } catch (cause) {
      setErreur(cause);
    } finally {
      setTravail(false);
    }
  };

  if (!ouvert) {
    return (
      <Bouton
        variante="secondaire"
        onClick={() => setOuvert(true)}
        data-testid="bouton-signaler-probleme"
      >
        Signaler un problème
      </Bouton>
    );
  }

  return (
    <section
      aria-label="Signaler un problème"
      className="rounded-lg border border-bordure bg-surface p-4 flex flex-col gap-3"
      data-testid="formulaire-signalement"
    >
      <h3 className="font-bold text-texte">Signaler un problème</h3>
      <Select
        label="Motif"
        value={motif}
        onChange={(e) => setMotif(e.target.value)}
        options={MOTIFS_SIGNALEMENT.map((m) => ({ valeur: m.valeur, libelle: m.libelle }))}
        data-testid="selecteur-motif-signalement"
      />
      <Champ
        label="Description (obligatoire)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Décrivez le problème rencontré…"
        data-testid="champ-description-signalement"
      />
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-texte">Photo (facultative)</p>
        <TeleversementFichier
          contexte="signalement"
          limiteImageMo={5}
          limiteDocumentMo={10}
          accept="image/jpeg,image/png"
          libelle="Ajouter une photo"
          onTeleverse={(fichier) => setFichiers((prec) => [...prec, fichier])}
        />
        {fichiers.length > 0 && (
          <ul className="text-xs text-texte-secondaire" data-testid="liste-fichiers-signalement">
            {fichiers.map((f) => (
              <li key={f.id}>📎 {f.nom_original}</li>
            ))}
          </ul>
        )}
      </div>
      {erreur ? (
        <p role="alert" className="rounded border border-red-200 bg-red-50 p-2 text-sm text-erreur">
          {erreur instanceof ErreurApi ? messageErreurLitige(erreur) : 'Signalement impossible.'}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Bouton
          chargement={travail}
          disabled={!peutSoumettre}
          onClick={() => void soumettre()}
          data-testid="bouton-envoyer-signalement"
        >
          Envoyer le signalement
        </Bouton>
        <Bouton variante="secondaire" onClick={() => setOuvert(false)}>
          Annuler
        </Bouton>
      </div>
    </section>
  );
};
