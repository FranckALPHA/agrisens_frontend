import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeStatut } from '@/components/BadgeStatut';
import { Bouton } from '@/components/Bouton';
import { Champ } from '@/components/Champ';
import { Select } from '@/components/Select';
import { EtatChargement } from '@/components/EtatChargement';
import { EtatErreur } from '@/components/EtatErreur';
import { EtatVide } from '@/components/EtatVide';
import { BandeauAvertissementIA } from '@/components/ia/BandeauAvertissementIA';
import { STATUTS_GENERATION } from '@/theme/statuts';
import { listerExploitations, type ExploitationApi } from '@/services/api/exploitations';
import {
  genererPlanning,
  genererRecommandation,
  listerPlannings,
  messageErreurPlannings,
  obtenirGeneration,
  obtenirQuota,
  lireReponsePlanning,
  lireReponseRecommandation,
  type GenerationIADetailApi,
  type GenerationIAListApi,
  type PlanningReponse,
  type RecommandationReponse,
} from '@/services/api/plannings';

type Onglet = 'planning' | 'recommandation';

/**
 * AGR-07 (F-12) — planning & recommandations IA côté agriculteur.
 * Formulaires par onglet, aperçu des données envoyées (aucune donnée
 * personnelle), résultat rendu avec bandeau d'avertissement permanent, quota
 * mensuel, historique et lien vers une vérification humaine (AGR-08).
 */
export const PagePlanning: React.FC = () => {
  const [onglet, setOnglet] = useState<Onglet>('planning');
  const [exploitationId, setExploitationId] = useState('');

  const exploitations = useQuery({ queryKey: ['exploitations'], queryFn: listerExploitations });
  const quota = useQuery({ queryKey: ['ia-quota'], queryFn: obtenirQuota });

  return (
    <div className="py-6 flex flex-col gap-6" data-testid="page-planning">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-texte">Planning & conseils IA</h1>
          <p className="text-sm text-texte-secondaire">
            Générez un planning cultural ou une recommandation agronomique assistés par l’IA.
          </p>
        </div>
        <CompteurQuota
          consomme={
            onglet === 'planning'
              ? (quota.data?.planning.consomme ?? 0)
              : (quota.data?.recommandation.consomme ?? 0)
          }
          limite={
            onglet === 'planning'
              ? (quota.data?.planning.limite ?? 0)
              : (quota.data?.recommandation.limite ?? 0)
          }
          type={onglet}
          reinitialisation={quota.data?.date_reinitialisation}
        />
      </header>

      <div role="tablist" className="flex gap-2 border-b border-bordure">
        <BoutonOnglet
          id="planning"
          actif={onglet === 'planning'}
          onClick={() => setOnglet('planning')}
        >
          Planning cultural
        </BoutonOnglet>
        <BoutonOnglet
          id="recommandation"
          actif={onglet === 'recommandation'}
          onClick={() => setOnglet('recommandation')}
        >
          Recommandations
        </BoutonOnglet>
      </div>

      {exploitations.isLoading ? (
        <EtatChargement message="Chargement de vos exploitations…" />
      ) : exploitations.error ? (
        <EtatErreur
          message={messageErreurPlannings(exploitations.error)}
          surReessayer={() => void exploitations.refetch()}
        />
      ) : (exploitations.data ?? []).length === 0 ? (
        <EtatVide
          titre="Aucune exploitation"
          message="Créez d'abord une exploitation pour utiliser l'assistant IA."
        />
      ) : (
        <div className="flex flex-col gap-4">
          <Select
            label="Exploitation"
            required
            placeholder="Choisir une exploitation"
            value={exploitationId}
            onChange={(e) => setExploitationId(e.target.value)}
            options={(exploitations.data ?? []).map((x: ExploitationApi) => ({
              valeur: x.id,
              libelle: `${x.nom} — ${x.region}`,
            }))}
          />

          {exploitationId ? (
            onglet === 'planning' ? (
              <SectionPlanning key={exploitationId} exploitationId={exploitationId} />
            ) : (
              <SectionRecommandation key={exploitationId} exploitationId={exploitationId} />
            )
          ) : (
            <p className="text-sm text-texte-muet">Sélectionnez une exploitation pour continuer.</p>
          )}

          {exploitationId ? <Historique exploitationId={exploitationId} /> : null}
        </div>
      )}
    </div>
  );
};

const BoutonOnglet: React.FC<{
  id: Onglet;
  actif: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ id, actif, onClick, children }) => (
  <button
    type="button"
    role="tab"
    aria-selected={actif}
    data-testid={`onglet-${id}`}
    onClick={onClick}
    className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
      actif
        ? 'border-primaire text-primaire'
        : 'border-transparent text-texte-secondaire hover:text-texte'
    }`}
  >
    {children}
  </button>
);

const CompteurQuota: React.FC<{
  consomme: number;
  limite: number;
  type: Onglet;
  reinitialisation?: string;
}> = ({ consomme, limite, type, reinitialisation }) => (
  <div
    data-testid="compteur-quota"
    className="rounded-md border border-bordure bg-surface px-3 py-2 text-sm text-texte-secondaire"
  >
    <span className="font-bold text-texte">
      {consomme}/{limite}
    </span>{' '}
    {type === 'planning' ? 'plannings' : 'recommandations'} ce mois
    {reinitialisation ? (
      <span className="text-texte-muet"> · remise à zéro le {reinitialisation}</span>
    ) : null}
  </div>
);

/** Panneau repliable affichant le payload exact envoyé à l'IA. */
const PanneauDonneesEnvoyees: React.FC<{ entrees: unknown; apercu?: Record<string, unknown> }> = ({
  entrees,
  apercu,
}) => {
  const payload = entrees ?? apercu ?? {};
  return (
    <details
      data-testid="donnees-envoyees"
      className="rounded-md border border-bordure bg-surface-survol p-3 text-sm"
    >
      <summary className="cursor-pointer font-medium text-texte">
        Données envoyées à l’IA (aucune donnée personnelle)
      </summary>
      <pre className="mt-2 overflow-auto text-xs text-texte-secondaire">
        {JSON.stringify(payload, null, 2)}
      </pre>
    </details>
  );
};

const SectionPlanning: React.FC<{ exploitationId: string }> = ({ exploitationId }) => {
  const navigation = useNavigate();
  const clientRequete = useQueryClient();
  const annulateur = useRef<AbortController | null>(null);

  const [culture, setCulture] = useState('');
  const [debut, setDebut] = useState('');
  const [fin, setFin] = useState('');
  const [infos, setInfos] = useState('');
  const [resultat, setResultat] = useState<GenerationIADetailApi | null>(null);
  const [annule, setAnnule] = useState(false);

  const mutation = useMutation({
    mutationFn: () => {
      const controller = new AbortController();
      annulateur.current = controller;
      setAnnule(false);
      return genererPlanning(
        exploitationId,
        {
          culture,
          periode_debut: debut,
          periode_fin: fin,
          ...(infos.trim() ? { infos_agronomiques: infos } : {}),
        },
        { cleIdempotence: crypto.randomUUID(), signal: controller.signal }
      );
    },
    onSuccess: (g) => {
      setResultat(g);
      void clientRequete.invalidateQueries({ queryKey: ['plannings', exploitationId] });
      void clientRequete.invalidateQueries({ queryKey: ['ia-quota'] });
    },
  });

  const apercu = useMemo(
    () => ({ culture, periode: { debut, fin }, infos_agronomiques: infos || null }),
    [culture, debut, fin, infos]
  );

  return (
    <section className="rounded-lg border border-bordure bg-surface p-5 flex flex-col gap-4">
      {/* Avertissement toujours visible (AGR-07) : tant qu'aucun résultat
          réussi n'affiche son propre bandeau, celui-ci rappelle que l'IA
          recommande sans poser de diagnostic, y compris pendant un
          chargement, une annulation ou un échec. */}
      {resultat && resultat.statut !== 'echouee' ? null : <BandeauAvertissementIA />}
      <Champ
        label="Culture"
        required
        value={culture}
        onChange={(e) => setCulture(e.target.value)}
        placeholder="Ex. maïs, tomate, arachide…"
      />
      <div className="grid grid-cols-2 gap-3">
        <Champ
          label="Début de période"
          type="date"
          required
          value={debut}
          onChange={(e) => setDebut(e.target.value)}
        />
        <Champ
          label="Fin de période"
          type="date"
          required
          value={fin}
          onChange={(e) => setFin(e.target.value)}
        />
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-texte">
          Informations agronomiques (optionnel)
        </span>
        <textarea
          data-testid="planning-infos"
          value={infos}
          onChange={(e) => setInfos(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-bordure bg-surface px-3 py-2 text-sm"
          placeholder="Rotation, précédent cultural, contraintes…"
        />
      </label>

      <PanneauDonneesEnvoyees entrees={resultat?.entrees} apercu={apercu} />

      <div className="flex gap-2">
        <Bouton
          chargement={mutation.isPending}
          disabled={culture.trim() === '' || debut === '' || fin === ''}
          onClick={() => mutation.mutate()}
        >
          Générer le planning
        </Bouton>
        {mutation.isPending ? (
          <Bouton
            variante="secondaire"
            data-testid="planning-annuler"
            onClick={() => {
              annulateur.current?.abort();
              setAnnule(true);
            }}
          >
            Annuler
          </Bouton>
        ) : null}
      </div>

      {annule ? (
        <p className="text-sm text-avertissement-texte" data-testid="planning-annule">
          Requête annulée, mais la génération se poursuit côté serveur et pourra consommer votre
          quota.
        </p>
      ) : null}

      {mutation.error ? (
        <EtatErreur
          message={messageErreurPlannings(mutation.error)}
          surReessayer={() => mutation.mutate()}
        />
      ) : null}

      {resultat ? (
        <div className="flex flex-col gap-3">
          {resultat.statut === 'echouee' ? (
            <p className="text-sm text-erreur">
              Échec de la génération : {resultat.erreur ?? 'erreur inconnue'}. Aucune quota
              consommé.
            </p>
          ) : (
            <ResultatPlanning reponse={lireReponsePlanning(resultat.reponse_originale)} />
          )}
          <Bouton
            variante="secondaire"
            taille="sm"
            data-testid="demander-verification-humaine"
            onClick={() =>
              navigation(
                `/agriculteur/accompagnement?exploitation=${exploitationId}&motif=${encodeURIComponent(
                  `Vérification du planning IA #${resultat.id}`
                )}`
              )
            }
          >
            Demander une vérification humaine
          </Bouton>
        </div>
      ) : null}
    </section>
  );
};

const ResultatPlanning: React.FC<{ reponse: PlanningReponse | null }> = ({ reponse }) => {
  if (!reponse) {
    return <BandeauAvertissementIA />;
  }
  return (
    <div className="flex flex-col gap-3" data-testid="resultat-planning">
      <BandeauAvertissementIA message={reponse.avertissement} />
      {reponse.resume ? <p className="text-sm text-texte">{reponse.resume}</p> : null}
      <ol className="flex flex-col gap-2" data-testid="planning-etapes">
        {(reponse.etapes ?? []).map((etape, i) => (
          <li
            key={`${etape.date_debut}-${i}`}
            data-testid="planning-etape"
            className="rounded border border-bordure p-3"
          >
            <div className="flex justify-between gap-2">
              <span className="font-bold text-sm">{etape.activite}</span>
              <span className="text-xs text-texte-muet">
                {etape.date_debut} → {etape.date_fin}
              </span>
            </div>
            {etape.details ? (
              <p className="text-sm text-texte-secondaire mt-1">{etape.details}</p>
            ) : null}
            {etape.intrants && etape.intrants.length > 0 ? (
              <p className="text-xs text-texte-muet mt-1">Intrants : {etape.intrants.join(', ')}</p>
            ) : null}
          </li>
        ))}
      </ol>
      {reponse.risques && reponse.risques.length > 0 ? (
        <div>
          <h4 className="text-sm font-bold">Risques</h4>
          <ul className="list-disc pl-5 text-sm text-texte-secondaire">
            {reponse.risques.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {reponse.conseils && reponse.conseils.length > 0 ? (
        <div>
          <h4 className="text-sm font-bold">Conseils</h4>
          <ul className="list-disc pl-5 text-sm text-texte-secondaire">
            {reponse.conseils.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
};

const SectionRecommandation: React.FC<{ exploitationId: string }> = ({ exploitationId }) => {
  const clientRequete = useQueryClient();
  const annulateur = useRef<AbortController | null>(null);

  const [sujet, setSujet] = useState('');
  const [culture, setCulture] = useState('');
  const [contexte, setContexte] = useState('');
  const [resultat, setResultat] = useState<GenerationIADetailApi | null>(null);
  const [annule, setAnnule] = useState(false);

  const mutation = useMutation({
    mutationFn: () => {
      const controller = new AbortController();
      annulateur.current = controller;
      setAnnule(false);
      return genererRecommandation(
        exploitationId,
        {
          sujet,
          ...(culture.trim() ? { culture } : {}),
          ...(contexte.trim() ? { contexte } : {}),
        },
        { cleIdempotence: crypto.randomUUID(), signal: controller.signal }
      );
    },
    onSuccess: (g) => {
      setResultat(g);
      void clientRequete.invalidateQueries({ queryKey: ['plannings', exploitationId] });
      void clientRequete.invalidateQueries({ queryKey: ['ia-quota'] });
    },
  });

  return (
    <section className="rounded-lg border border-bordure bg-surface p-5 flex flex-col gap-4">
      {/* Même règle d'avertissement permanent que l'onglet planning. */}
      {resultat && resultat.statut !== 'echouee' ? null : <BandeauAvertissementIA />}
      <Champ
        label="Sujet"
        required
        value={sujet}
        onChange={(e) => setSujet(e.target.value)}
        placeholder="Ex. jaunissement des feuilles de tomate"
      />
      <Champ
        label="Culture (optionnel)"
        value={culture}
        onChange={(e) => setCulture(e.target.value)}
      />
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-texte">Contexte (optionnel)</span>
        <textarea
          value={contexte}
          onChange={(e) => setContexte(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-bordure bg-surface px-3 py-2 text-sm"
        />
      </label>

      <PanneauDonneesEnvoyees
        entrees={resultat?.entrees}
        apercu={{ sujet, culture: culture || null, contexte: contexte || null }}
      />

      <div className="flex gap-2">
        <Bouton
          chargement={mutation.isPending}
          disabled={sujet.trim() === ''}
          onClick={() => mutation.mutate()}
        >
          Demander une recommandation
        </Bouton>
        {mutation.isPending ? (
          <Bouton
            variante="secondaire"
            onClick={() => {
              annulateur.current?.abort();
              setAnnule(true);
            }}
          >
            Annuler
          </Bouton>
        ) : null}
      </div>

      {annule ? (
        <p className="text-sm text-avertissement-texte">
          Requête annulée, mais la génération se poursuit côté serveur.
        </p>
      ) : null}

      {mutation.error ? <EtatErreur message={messageErreurPlannings(mutation.error)} /> : null}

      {resultat ? (
        resultat.statut === 'echouee' ? (
          <p className="text-sm text-erreur">Échec : {resultat.erreur ?? 'erreur inconnue'}.</p>
        ) : (
          <ResultatRecommandation reponse={lireReponseRecommandation(resultat.reponse_originale)} />
        )
      ) : null}
    </section>
  );
};

const ResultatRecommandation: React.FC<{ reponse: RecommandationReponse | null }> = ({
  reponse,
}) => {
  if (!reponse) {
    return <BandeauAvertissementIA />;
  }
  return (
    <div className="flex flex-col gap-3" data-testid="resultat-recommandation">
      <BandeauAvertissementIA message={reponse.avertissement} />
      <ul className="flex flex-col gap-2" role="list">
        {reponse.recommandations.map((r, i) => (
          <li key={i} className="rounded border border-bordure p-3">
            <div className="flex justify-between gap-2">
              <span className="font-bold text-sm">{r.titre}</span>
              <span className="text-xs uppercase text-texte-muet">{r.priorite}</span>
            </div>
            <p className="text-sm text-texte-secondaire mt-1">{r.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  );
};

const Historique: React.FC<{ exploitationId: string }> = ({ exploitationId }) => {
  const historique = useQuery({
    queryKey: ['plannings', exploitationId],
    queryFn: () => listerPlannings(exploitationId),
  });

  return (
    <section className="flex flex-col gap-2" data-testid="historique-plannings">
      <h2 className="text-lg font-bold text-texte">Historique</h2>
      {historique.isLoading ? (
        <EtatChargement message="Chargement de l'historique…" />
      ) : historique.error ? (
        <p className="text-sm text-erreur">{messageErreurPlannings(historique.error)}</p>
      ) : (historique.data?.elements.length ?? 0) === 0 ? (
        <p className="text-sm text-texte-muet">Aucune génération pour le moment.</p>
      ) : (
        <ul className="flex flex-col gap-2" role="list">
          {(historique.data?.elements ?? []).map((g: GenerationIAListApi) => (
            <CarteHistorique key={g.id} generation={g} />
          ))}
        </ul>
      )}
    </section>
  );
};

const CarteHistorique: React.FC<{ generation: GenerationIAListApi }> = ({ generation }) => {
  const [ouvert, setOuvert] = useState(false);
  const detail = useQuery({
    queryKey: ['generation', generation.id],
    queryFn: () => obtenirGeneration(generation.id),
    enabled: ouvert,
  });

  return (
    <li
      data-testid={`historique-item-${generation.id}`}
      className="rounded border border-bordure p-3 flex flex-col gap-2"
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <span className="font-medium text-sm">{generation.culture || generation.type}</span>
          <span className="text-xs text-texte-muet ml-2">
            {generation.type} · {generation.cree_le.slice(0, 10)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <BadgeStatut statut={generation.statut} registre={STATUTS_GENERATION} />
          <Bouton
            taille="sm"
            variante="secondaire"
            aria-expanded={ouvert}
            onClick={() => setOuvert((v) => !v)}
          >
            {ouvert ? 'Masquer' : 'Voir'}
          </Bouton>
        </div>
      </div>
      {ouvert ? (
        detail.isLoading ? (
          <EtatChargement message="Chargement…" />
        ) : detail.error ? (
          <p className="text-sm text-erreur">{messageErreurPlannings(detail.error)}</p>
        ) : detail.data ? (
          detail.data.type === 'recommandation' ? (
            <ResultatRecommandation
              reponse={lireReponseRecommandation(detail.data.reponse_originale)}
            />
          ) : (
            <ResultatPlanning reponse={lireReponsePlanning(detail.data.reponse_originale)} />
          )
        ) : null
      ) : null}
    </li>
  );
};
