import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeStatut } from '@/components/BadgeStatut';
import { Bouton } from '@/components/Bouton';
import { EtatChargement } from '@/components/EtatChargement';
import { EtatErreur } from '@/components/EtatErreur';
import { BandeauAvertissementIA } from '@/components/ia/BandeauAvertissementIA';
import { STATUTS_GENERATION } from '@/theme/statuts';
import {
  creerCorrection,
  messageErreurPlannings,
  obtenirGeneration,
  type CorrectionIAApi,
} from '@/services/api/plannings';

/**
 * ING-05 (F-12) — correction d'une génération IA par un ingénieur affecté.
 * Affiche côte à côte la proposition de l'IA (jamais mutée) et le dernier
 * corrigé. La création d'une correction n'écrase jamais `reponse_originale`.
 * Hypothèse Q-45 : pas de pièce jointe (aucun contexte FICHIER « ia » en V1).
 */
export const PageGenerationIA: React.FC = () => {
  const { identifiant } = useParams<{ identifiant: string }>();
  const generation = useQuery({
    queryKey: ['generation', identifiant],
    queryFn: () => obtenirGeneration(identifiant as string),
    enabled: Boolean(identifiant),
  });

  if (!identifiant) {
    return <EtatErreur message="Identifiant de génération manquant." />;
  }
  if (generation.isLoading) {
    return <EtatChargement message="Chargement de la génération…" />;
  }
  if (generation.error) {
    return (
      <EtatErreur
        message={messageErreurPlannings(generation.error)}
        surReessayer={() => void generation.refetch()}
      />
    );
  }

  const g = generation.data;
  const corrections = g?.corrections ?? [];
  const derniere = corrections.length > 0 ? corrections[corrections.length - 1] : null;

  return (
    <div className="py-6 flex flex-col gap-6" data-testid="page-generation-ia">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-texte">Correction d'une génération IA</h1>
          <p className="text-sm text-texte-secondaire">
            {g?.type === 'recommandation' ? 'Recommandation' : 'Planning'} · {g?.culture} ·{' '}
            {g?.periode_debut} → {g?.periode_fin}
          </p>
        </div>
        {g ? <BadgeStatut statut={g.statut} registre={STATUTS_GENERATION} /> : null}
      </header>

      <BandeauAvertissementIA message={g?.avertissement ?? undefined} />

      <div className="grid md:grid-cols-2 gap-4">
        <section className="rounded-lg border border-bordure bg-surface p-4 flex flex-col gap-2">
          <h2 className="font-bold">Proposition de l’IA</h2>
          <pre
            data-testid="proposition-ia"
            className="overflow-auto text-xs text-texte-secondaire whitespace-pre-wrap"
          >
            {JSON.stringify(g?.reponse_originale ?? {}, null, 2)}
          </pre>
          {g?.statut === 'echouee' ? (
            <p className="text-sm text-erreur">Échec : {g.erreur ?? 'erreur inconnue'}.</p>
          ) : null}
        </section>

        <section className="rounded-lg border border-bordure bg-surface p-4 flex flex-col gap-2">
          <h2 className="font-bold">Corrigé par l’ingénieur</h2>
          {derniere ? (
            <div data-testid="correction-derniere" className="flex flex-col gap-2">
              <p className="text-xs text-texte-muet">
                Par {derniere.ingenieur_nom} · {derniere.cree_le.slice(0, 10)}
              </p>
              <p className="text-sm">{derniere.commentaire}</p>
              {derniere.contenu_corrige ? (
                <pre className="overflow-auto text-xs whitespace-pre-wrap">
                  {JSON.stringify(derniere.contenu_corrige, null, 2)}
                </pre>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-texte-muet">Aucune correction enregistrée pour l’instant.</p>
          )}
          <ul className="flex flex-col gap-1 mt-2">
            {corrections.map((c: CorrectionIAApi) => (
              <li key={c.id} className="text-xs text-texte-secondaire">
                {c.cree_le.slice(0, 10)} — {c.ingenieur_nom}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <FormulaireCorrection
        identifiant={identifiant}
        proposition={g?.reponse_originale}
        surCree={() => void generation.refetch()}
      />
    </div>
  );
};

const FormulaireCorrection: React.FC<{
  identifiant: string;
  proposition: unknown;
  surCree: () => void;
}> = ({ identifiant, proposition, surCree }) => {
  const clientRequete = useQueryClient();
  const [commentaire, setCommentaire] = useState('');
  const [contenu, setContenu] = useState('');
  const [erreurJson, setErreurJson] = useState<string | null>(null);

  const propositionTexte = useMemo(() => JSON.stringify(proposition ?? {}, null, 2), [proposition]);

  const mutation = useMutation({
    mutationFn: (corpsCorrige: unknown) =>
      creerCorrection(identifiant, {
        commentaire,
        ...(corpsCorrige === undefined ? {} : { contenu_corrige: corpsCorrige }),
      }),
    onSuccess: () => {
      void clientRequete.invalidateQueries({ queryKey: ['generation', identifiant] });
      setCommentaire('');
      setContenu('');
      surCree();
    },
  });

  const soumettre = () => {
    const texte = contenu.trim();
    if (texte === '') {
      setErreurJson(null);
      mutation.mutate(undefined);
      return;
    }
    try {
      mutation.mutate(JSON.parse(texte));
      setErreurJson(null);
    } catch {
      setErreurJson('Le contenu corrigé doit être un JSON valide.');
    }
  };

  return (
    <section
      data-testid="form-correction"
      className="rounded-lg border border-bordure bg-surface p-5 flex flex-col gap-4"
    >
      <h2 className="font-bold">Ajouter une correction</h2>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-texte">Commentaire *</span>
        <textarea
          data-testid="correction-commentaire"
          value={commentaire}
          onChange={(e) => setCommentaire(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-bordure bg-surface px-3 py-2 text-sm"
          placeholder="Observations de terrain, ajustements recommandés…"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-texte">Contenu corrigé (JSON, optionnel)</span>
        <textarea
          data-testid="correction-contenu"
          value={contenu}
          onChange={(e) => setContenu(e.target.value)}
          rows={8}
          className="w-full rounded-md border border-bordure bg-surface px-3 py-2 text-xs font-mono"
          placeholder={propositionTexte}
        />
        {erreurJson ? (
          <span className="text-xs text-erreur" role="alert">
            {erreurJson}
          </span>
        ) : null}
      </label>

      {mutation.error ? (
        <p className="text-sm text-erreur" role="alert">
          {messageErreurPlannings(mutation.error)}
        </p>
      ) : null}

      <Bouton
        data-testid="correction-soumettre"
        chargement={mutation.isPending}
        disabled={commentaire.trim() === ''}
        onClick={soumettre}
      >
        Enregistrer la correction
      </Bouton>
    </section>
  );
};
