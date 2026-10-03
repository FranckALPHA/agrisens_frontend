import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { Bouton } from '@/components/Bouton';
import { Champ } from '@/components/Champ';
import { EtatChargement } from '@/components/EtatChargement';
import { ErreurApi } from '@/services/api/client';
import { creerEvaluation, messageErreurLitige, obtenirEvaluation } from '@/services/api/litiges';

/** Sélection de 1 à 5 étoiles. */
const NoteEtoiles: React.FC<{
  label: string;
  valeur: number | null;
  onChange: (note: number) => void;
  testid: string;
}> = ({ label, valeur, onChange, testid }) => (
  <div className="flex flex-col gap-1" data-testid={testid}>
    <span className="text-sm font-medium text-texte">{label}</span>
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((note) => (
        <button
          key={note}
          type="button"
          aria-label={`${label} : ${note} sur 5`}
          onClick={() => onChange(note)}
          className="p-1"
        >
          <Star
            size={26}
            className={
              valeur !== null && note <= valeur ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
            }
            aria-hidden="true"
          />
        </button>
      ))}
    </div>
  </div>
);

/**
 * ACH-08 — évaluation après livraison (prompt F-09 frontend point 1) :
 * note de l'agriculteur obligatoire, note du livreur si la commande a été
 * livrée par un livreur, commentaire facultatif. Une seule évaluation par
 * commande ; le backend refuse avant `livree` et à la seconde demande.
 */
export const FormulaireEvaluation: React.FC<{
  commandeId: string;
  aUnLivreur: boolean;
}> = ({ commandeId, aUnLivreur }) => {
  const clientRequete = useQueryClient();
  const [noteAgriculteur, setNoteAgriculteur] = useState<number | null>(null);
  const [noteLivreur, setNoteLivreur] = useState<number | null>(null);
  const [commentaire, setCommentaire] = useState('');
  const [erreur, setErreur] = useState<unknown>(null);
  const [travail, setTravail] = useState(false);

  const requete = useQuery({
    queryKey: ['evaluation', commandeId],
    queryFn: () => obtenirEvaluation(commandeId),
    retry: false,
  });

  if (requete.isLoading) return <EtatChargement message="Chargement de l’évaluation…" />;

  const dejaFaite = Boolean(requete.data);
  if (dejaFaite) {
    const evaluation = requete.data!;
    return (
      <section
        aria-label="Évaluation de la commande"
        className="rounded-lg border border-bordure bg-surface p-4"
        data-testid="evaluation-deja-faite"
      >
        <h3 className="font-bold text-texte mb-1">Votre évaluation</h3>
        <p className="text-sm text-texte" data-testid="evaluation-resume">
          Agriculteur : {evaluation.note_agriculteur}/5
          {evaluation.note_livreur !== null ? ` · Livreur : ${evaluation.note_livreur}/5` : ''}
        </p>
        {evaluation.commentaire && (
          <p className="text-sm text-texte-secondaire mt-1">« {evaluation.commentaire} »</p>
        )}
        <p className="text-xs text-texte-muet mt-2">Une seule évaluation par commande.</p>
      </section>
    );
  }

  const soumettre = async () => {
    if (noteAgriculteur === null) return;
    setErreur(null);
    setTravail(true);
    try {
      await creerEvaluation(commandeId, {
        note_agriculteur: noteAgriculteur,
        note_livreur: aUnLivreur ? noteLivreur : null,
        commentaire: commentaire.trim() || null,
      });
      setCommentaire('');
      await clientRequete.invalidateQueries({ queryKey: ['evaluation', commandeId] });
    } catch (cause) {
      setErreur(cause);
    } finally {
      setTravail(false);
    }
  };

  return (
    <section
      aria-label="Évaluer la commande"
      className="rounded-lg border border-bordure bg-surface p-4 flex flex-col gap-3"
      data-testid="formulaire-evaluation"
    >
      <h3 className="font-bold text-texte">Évaluer cette commande</h3>
      <NoteEtoiles
        label="Qualité du produit / agriculteur"
        valeur={noteAgriculteur}
        onChange={setNoteAgriculteur}
        testid="note-agriculteur"
      />
      {aUnLivreur && (
        <NoteEtoiles
          label="Livraison / livreur"
          valeur={noteLivreur}
          onChange={setNoteLivreur}
          testid="note-livreur"
        />
      )}
      <Champ
        label="Commentaire (facultatif)"
        value={commentaire}
        onChange={(e) => setCommentaire(e.target.value)}
        placeholder="Votre retour d’expérience…"
        data-testid="champ-commentaire-evaluation"
      />
      {erreur ? (
        <p role="alert" className="rounded border border-red-200 bg-red-50 p-2 text-sm text-erreur">
          {erreur instanceof ErreurApi ? messageErreurLitige(erreur) : 'Évaluation impossible.'}
        </p>
      ) : null}
      <div>
        <Bouton
          chargement={travail}
          disabled={noteAgriculteur === null}
          onClick={() => void soumettre()}
          data-testid="bouton-envoyer-evaluation"
        >
          Envoyer l’évaluation
        </Bouton>
      </div>
    </section>
  );
};
