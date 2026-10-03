import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { BadgeStatut } from '@/components/BadgeStatut';
import { Bouton } from '@/components/Bouton';
import { Champ } from '@/components/Champ';
import { Select } from '@/components/Select';
import { EtatChargement } from '@/components/EtatChargement';
import { EtatErreur } from '@/components/EtatErreur';
import { EtatVide } from '@/components/EtatVide';
import { ErreurApi } from '@/services/api/client';
import { STATUTS_ACCOMPAGNEMENT } from '@/theme/statuts';
import { listerExploitations, type ExploitationApi } from '@/services/api/exploitations';
import { listerIngenieurs, type IngenieurPublicApi } from '@/services/api/profils';
import { formaterPrix } from '@/services/api/produits';
import {
  creerAccompagnement,
  listerAccompagnements,
  messageErreurAccompagnement,
  obtenirDevis,
  type AccompagnementApi,
  type DevisReponseApi,
  type ModaliteApi,
} from '@/services/api/accompagnements';

/**
 * AGR-08 (F-11) — accompagnement agronomique côté agriculteur : demande,
 * sélection d'un ingénieur filtré par zone, devis en ligne, puis suivi.
 */
export const PageAccompagnement: React.FC = () => {
  const navigation = useNavigate();
  const [ouvrirFormulaire, setOuvrirFormulaire] = useState(false);

  const liste = useQuery({
    queryKey: ['accompagnements-agriculteur'],
    queryFn: listerAccompagnements,
  });

  return (
    <div className="py-6 flex flex-col gap-6" data-testid="page-accompagnement">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-texte">Accompagnement agronomique</h1>
          <p className="text-sm text-texte-secondaire">
            Choisissez un ingénieur, recevez un devis, payez en ligne puis suivez le rendez-vous.
          </p>
        </div>
        <Bouton
          onClick={() => setOuvrirFormulaire((v) => !v)}
          variante={ouvrirFormulaire ? 'secondaire' : 'primaire'}
        >
          {ouvrirFormulaire ? 'Fermer' : 'Nouvelle demande'}
        </Bouton>
      </header>

      {ouvrirFormulaire ? (
        <FormulaireDemande
          onCree={(id) => {
            setOuvrirFormulaire(false);
            navigation(`/agriculteur/accompagnement/${id}`);
          }}
        />
      ) : null}

      {liste.isLoading ? (
        <EtatChargement message="Chargement de vos accompagnements…" />
      ) : liste.error ? (
        <EtatErreur
          message={messageErreurAccompagnement(liste.error)}
          surReessayer={() => void liste.refetch()}
        />
      ) : liste.data && liste.data.elements.length === 0 ? (
        <EtatVide
          titre="Aucune demande"
          message="Lancez votre première demande d'accompagnement."
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2" role="list">
          {(liste.data?.elements ?? []).map((a) => (
            <CarteAccompagnement key={a.id} accompagnement={a} />
          ))}
        </ul>
      )}
    </div>
  );
};

const CarteAccompagnement: React.FC<{ accompagnement: AccompagnementApi }> = ({
  accompagnement,
}) => (
  <li>
    <article
      data-testid={`accompagnement-carte-${accompagnement.id}`}
      className="rounded-lg border border-bordure bg-surface p-4 shadow-sm flex flex-col gap-2"
    >
      <div className="flex justify-between items-start gap-2">
        <div>
          <h2 className="font-bold">{accompagnement.exploitation_nom ?? 'Exploitation'}</h2>
          <p className="text-sm text-texte-secondaire">
            {accompagnement.ingenieur_nom ?? 'Ingénieur non attribué'} ·{' '}
            {accompagnement.modalite === 'presentiel' ? 'Présentiel' : 'En ligne'}
          </p>
        </div>
        <BadgeStatut statut={accompagnement.statut} registre={STATUTS_ACCOMPAGNEMENT} />
      </div>
      <p className="text-sm">{accompagnement.motif}</p>
      <div className="flex justify-between items-center mt-2">
        {accompagnement.prix_consultation_fcfa !== null ? (
          <span className="text-sm text-texte-secondaire">
            {formaterPrix(
              accompagnement.prix_consultation_fcfa + (accompagnement.frais_deplacement_fcfa ?? 0)
            )}
          </span>
        ) : (
          <span className="text-xs text-texte-muet">Devis en attente</span>
        )}
        <Bouton
          taille="sm"
          variante="secondaire"
          to={`/agriculteur/accompagnement/${accompagnement.id}`}
        >
          Suivre
        </Bouton>
      </div>
    </article>
  </li>
);

const FormulaireDemande: React.FC<{ onCree: (id: string) => void }> = ({ onCree }) => {
  const [exploitationId, setExploitationId] = useState('');
  const [ingenieurId, setIngenieurId] = useState('');
  const [modalite, setModalite] = useState<ModaliteApi>('presentiel');
  const [motif, setMotif] = useState('');
  const [description, setDescription] = useState('');
  const [erreur, setErreur] = useState<unknown>(null);

  const exploitations = useQuery({ queryKey: ['exploitations'], queryFn: listerExploitations });
  const ingenieurs = useQuery({
    queryKey: ['ingenieurs-z', exploitationId],
    queryFn: () => listerIngenieurs({ exploitation_id: exploitationId || undefined }),
    enabled: exploitationId !== '',
  });

  const devis = useQuery({
    queryKey: ['devis-accompagnement', exploitationId, ingenieurId, modalite],
    queryFn: () =>
      obtenirDevis({ exploitation_id: exploitationId, ingenieur_id: ingenieurId, modalite }),
    enabled: exploitationId !== '' && ingenieurId !== '',
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: () =>
      creerAccompagnement({
        exploitation_id: exploitationId,
        ingenieur_id: ingenieurId,
        modalite,
        motif,
        description: description || null,
      }),
    onSuccess: (a) => onCree(a.id),
    onError: (cause) => setErreur(cause),
  });

  const exploitationChoisie = useMemo(
    () => (exploitations.data ?? []).find((e: ExploitationApi) => e.id === exploitationId),
    [exploitations.data, exploitationId]
  );

  return (
    <section
      aria-label="Nouvelle demande"
      data-testid="form-accompagnement"
      className="rounded-lg border border-bordure bg-surface p-5 flex flex-col gap-4"
    >
      <Select
        label="Exploitation"
        required
        placeholder="Choisir une exploitation"
        value={exploitationId}
        onChange={(e) => {
          setExploitationId(e.target.value);
          setIngenieurId('');
        }}
        options={(exploitations.data ?? []).map((e: ExploitationApi) => ({
          valeur: e.id,
          libelle: `${e.nom} — ${e.region}`,
        }))}
      />

      <Select
        label="Modalité"
        required
        value={modalite}
        onChange={(e) => setModalite(e.target.value as ModaliteApi)}
        options={[
          { valeur: 'presentiel', libelle: 'Présentiel (déplacement inclus)' },
          { valeur: 'en_ligne', libelle: 'En ligne (visioconférence)' },
        ]}
      />

      <Select
        label="Ingénieur"
        required
        placeholder={exploitationChoisie ? 'Choisir un ingénieur' : 'Sélectionnez une exploitation'}
        value={ingenieurId}
        disabled={!exploitationChoisie || ingenieurs.isLoading}
        onChange={(e) => setIngenieurId(e.target.value)}
        options={(ingenieurs.data?.elements ?? []).map((i: IngenieurPublicApi) => ({
          valeur: i.id ?? '',
          libelle: `${i.nom ?? 'Ingénieur'} — ${formaterPrix(i.tarif_consultation_fcfa ?? 0)}`,
        }))}
      />

      <Champ
        label="Motif"
        required
        value={motif}
        onChange={(e) => setMotif(e.target.value)}
        placeholder="Ex. conseil fertilisation, maladie fongique…"
      />

      <Champ
        label="Description (optionnelle)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Précisions pour l'ingénieur"
      />

      <div
        data-testid="devis-accompagnement"
        aria-live="polite"
        className="rounded border border-bordure p-3 text-sm flex flex-col gap-1"
      >
        <h3 className="font-bold">Devis estimé</h3>
        {devis.isLoading ? <span>Calcul…</span> : null}
        {devis.error ? (
          <span role="alert" className="text-erreur">
            {messageErreurAccompagnement(devis.error)}
          </span>
        ) : null}
        {devis.data ? <LigneDevis devis={devis.data} /> : null}
        {!exploitationChoisie || ingenieurId === '' ? (
          <span className="text-texte-muet">Sélectionnez une exploitation puis un ingénieur.</span>
        ) : null}
      </div>

      {erreur ? (
        <p role="alert" className="text-sm text-erreur">
          {erreur instanceof ErreurApi
            ? messageErreurAccompagnement(erreur)
            : 'Création impossible.'}
        </p>
      ) : null}

      <Bouton
        pleineLargeur
        chargement={mutation.isPending}
        disabled={!devis.data || motif.trim() === ''}
        onClick={() => mutation.mutate()}
      >
        Envoyer la demande
      </Bouton>
    </section>
  );
};

const LigneDevis: React.FC<{ devis: DevisReponseApi }> = ({ devis }) => (
  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
    <dt className="text-texte-secondaire">Consultation</dt>
    <dd>{formaterPrix(devis.consultation_fcfa)}</dd>
    <dt className="text-texte-secondaire">Déplacement</dt>
    <dd>
      {formaterPrix(devis.deplacement_fcfa)}
      {devis.distance_km_aller !== null ? (
        <span className="text-texte-muet"> ({devis.distance_km_aller} km aller)</span>
      ) : null}
    </dd>
    <dt className="text-texte-secondaire font-bold">Total</dt>
    <dd className="font-bold" data-testid="devis-total">
      {formaterPrix(devis.total_fcfa)}
    </dd>
  </dl>
);
