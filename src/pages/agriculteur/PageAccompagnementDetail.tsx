import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeStatut } from '@/components/BadgeStatut';
import { Bouton } from '@/components/Bouton';
import { Champ } from '@/components/Champ';
import { EtatChargement } from '@/components/EtatChargement';
import { EtatErreur } from '@/components/EtatErreur';
import { Select } from '@/components/Select';
import { Timeline, type EtapeTimeline } from '@/components/Timeline';
import { STATUTS_ACCOMPAGNEMENT } from '@/theme/statuts';
import { formaterPrix } from '@/services/api/produits';
import { OPERATEURS_PAIEMENT, type OperateurPaiement } from '@/services/api/paiements';
import {
  annulerAccompagnement,
  changerIngenieur,
  confirmerAccompagnement,
  marquerManque,
  messageErreurAccompagnement,
  obtenirAccompagnement,
  type AccompagnementDetailApi,
} from '@/services/api/accompagnements';

/**
 * AGR-08 (détail, F-11) — suivi d'un accompagnement : timeline, confirmation
 * de RDV + paiement, annulation, changement d'ingénieur, marquage manqué.
 */
export const PageAccompagnementDetail: React.FC<{ vue?: 'agriculteur' | 'ingenieur' }> = ({
  vue = 'agriculteur',
}) => {
  const { identifiant = '' } = useParams<{ identifiant: string }>();
  const queryClient = useQueryClient();
  const requete = useQuery({
    queryKey: ['accompagnement', identifiant],
    queryFn: () => obtenirAccompagnement(identifiant),
    enabled: identifiant !== '',
  });
  const [erreur, setErreur] = useState<unknown>(null);
  const [enCours, setEnCours] = useState<string | null>(null);

  const rafraichir = () =>
    queryClient.invalidateQueries({ queryKey: ['accompagnement', identifiant] });

  const action = async (nom: string, fn: () => Promise<unknown>) => {
    setErreur(null);
    setEnCours(nom);
    try {
      await fn();
      rafraichir();
    } catch (cause) {
      setErreur(cause);
    } finally {
      setEnCours(null);
    }
  };

  if (requete.isLoading) return <EtatChargement message="Chargement de l'accompagnement…" />;
  if (requete.error)
    return (
      <EtatErreur
        message={messageErreurAccompagnement(requete.error)}
        surReessayer={() => void requete.refetch()}
      />
    );
  const a = requete.data as AccompagnementDetailApi;

  return (
    <div className="py-6 flex flex-col gap-5 max-w-3xl" data-testid="page-accompagnement-detail">
      <header className="flex justify-between items-start gap-3">
        <div>
          <h1 className="text-2xl font-bold text-texte">
            {a.exploitation_nom ?? 'Accompagnement'}
          </h1>
          <p className="text-sm text-texte-secondaire">
            {a.ingenieur_nom ?? 'En attente d’affectation'} ·{' '}
            {a.modalite === 'presentiel' ? 'Présentiel' : 'En ligne'}
          </p>
        </div>
        <BadgeStatut statut={a.statut} registre={STATUTS_ACCOMPAGNEMENT} />
      </header>

      {erreur ? (
        <p
          role="alert"
          className="text-sm text-erreur rounded bg-erreur-fond/30 border border-red-200 p-2"
        >
          {messageErreurAccompagnement(erreur)}
        </p>
      ) : null}

      <section className="rounded-lg border border-bordure bg-surface p-4">
        <h2 className="font-bold mb-2">Informations</h2>
        <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-texte-secondaire">Motif</dt>
          <dd>{a.motif}</dd>
          {a.description ? (
            <>
              <dt className="text-texte-secondaire">Description</dt>
              <dd>{a.description}</dd>
            </>
          ) : null}
          {a.date_rdv_debut ? (
            <>
              <dt className="text-texte-secondaire">RDV</dt>
              <dd>{new Date(a.date_rdv_debut).toLocaleString('fr-FR')}</dd>
            </>
          ) : null}
          {a.lieu_rdv_texte ? (
            <>
              <dt className="text-texte-secondaire">Lieu</dt>
              <dd>{a.lieu_rdv_texte}</dd>
            </>
          ) : null}
          {a.lien_visio ? (
            <>
              <dt className="text-texte-secondaire">Lien visio</dt>
              <dd>
                <a
                  className="text-primaire underline"
                  href={a.lien_visio}
                  target="_blank"
                  rel="noreferrer"
                >
                  Rejoindre
                </a>
              </dd>
            </>
          ) : null}
          {a.prix_consultation_fcfa !== null ? (
            <>
              <dt className="text-texte-secondaire">Consultation</dt>
              <dd>{formaterPrix(a.prix_consultation_fcfa)}</dd>
            </>
          ) : null}
          {a.frais_deplacement_fcfa !== null ? (
            <>
              <dt className="text-texte-secondaire">Déplacement</dt>
              <dd>{formaterPrix(a.frais_deplacement_fcfa)}</dd>
            </>
          ) : null}
          {a.prix_consultation_fcfa !== null ? (
            <>
              <dt className="text-texte-secondaire font-bold">Total</dt>
              <dd className="font-bold" data-testid="detail-total">
                {formaterPrix(a.prix_consultation_fcfa + (a.frais_deplacement_fcfa ?? 0))}
              </dd>
            </>
          ) : null}
        </dl>
        {a.observation ? (
          <div className="mt-3 p-3 rounded bg-surface-survol">
            <h3 className="font-semibold text-sm mb-1">Compte rendu</h3>
            <p className="text-sm whitespace-pre-wrap" data-testid="detail-observation">
              {a.observation}
            </p>
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-bordure bg-surface p-4">
        <h2 className="font-bold mb-3">Suivi</h2>
        <Timeline etapes={construireEtapes(a)} />
      </section>

      {vue === 'agriculteur' ? (
        <ActionsAgriculteur
          accompagnement={a}
          enCours={enCours}
          surAction={(nom, fn) => void action(nom, fn)}
        />
      ) : (
        <ActionsIngenieur
          accompagnement={a}
          enCours={enCours}
          surAction={(nom, fn) => void action(nom, fn)}
        />
      )}
    </div>
  );
};

const ActionsAgriculteur: React.FC<{
  accompagnement: AccompagnementDetailApi;
  enCours: string | null;
  surAction: (nom: string, fn: () => Promise<unknown>) => void;
}> = ({ accompagnement: a, enCours, surAction }) => {
  const [operateur, setOperateur] = useState<OperateurPaiement>('mtn_momo');
  const [nouvelIngenieur, setNouvelIngenieur] = useState('');

  const peutPayer = a.statut === 'acceptee' && a.date_rdv_debut !== null;
  const peutAnnuler = ['demandee', 'acceptee'].includes(a.statut);
  const peutChanger = ['demandee', 'acceptee'].includes(a.statut);

  return (
    <section className="rounded-lg border border-bordure bg-surface p-4 flex flex-col gap-3">
      <h2 className="font-bold">Actions</h2>

      {peutPayer ? (
        <div className="flex flex-col gap-2" data-testid="zone-paiement">
          <Select
            label="Opérateur mobile money"
            value={operateur}
            onChange={(e) => setOperateur(e.target.value as OperateurPaiement)}
            options={OPERATEURS_PAIEMENT.map((o) => ({ valeur: o.valeur, libelle: o.libelle }))}
          />
          <Bouton
            chargement={enCours === 'confirmer'}
            onClick={() =>
              surAction('confirmer', async () => {
                const rep = await confirmerAccompagnement(a.id, operateur as never);
                // Redirection externe vers NotchPay ; le retour est traité par
                // la page /agriculteur/accompagnement/:id qui recharge après polling.
                window.location.href = rep.url_paiement;
              })
            }
          >
            Confirmer et payer
          </Bouton>
        </div>
      ) : null}

      {peutChanger ? (
        <div className="flex gap-2 items-end">
          <Champ
            label="Changer d'ingénieur (id)"
            value={nouvelIngenieur}
            onChange={(e) => setNouvelIngenieur(e.target.value)}
            placeholder="id UUID du nouvel ingénieur"
          />
          <Bouton
            variante="secondaire"
            disabled={nouvelIngenieur === ''}
            chargement={enCours === 'changer'}
            onClick={() => surAction('changer', () => changerIngenieur(a.id, nouvelIngenieur))}
          >
            Changer
          </Bouton>
        </div>
      ) : null}

      {peutAnnuler ? (
        <Bouton
          variante="danger"
          chargement={enCours === 'annuler'}
          onClick={() => surAction('annuler', () => annulerAccompagnement(a.id))}
        >
          Annuler ma demande
        </Bouton>
      ) : null}

      {a.statut === 'planifiee' ? (
        <div className="flex gap-2">
          <Bouton
            variante="secondaire"
            chargement={enCours === 'manque-ing'}
            onClick={() => surAction('manque-ing', () => marquerManque(a.id, 'ingenieur'))}
          >
            L'ingénieur était absent
          </Bouton>
          <Bouton
            variante="discret"
            chargement={enCours === 'manque-agri'}
            onClick={() => surAction('manque-agri', () => marquerManque(a.id, 'agriculteur'))}
          >
            J'étais absent
          </Bouton>
        </div>
      ) : null}
    </section>
  );
};

const ActionsIngenieur: React.FC<{
  accompagnement: AccompagnementDetailApi;
  enCours: string | null;
  surAction: (nom: string, fn: () => Promise<unknown>) => void;
}> = ({ accompagnement: a, enCours, surAction }) => (
  <section className="rounded-lg border border-bordure bg-surface p-4 flex flex-col gap-3">
    <h2 className="font-bold">Actions ingénieur</h2>
    {a.statut === 'planifiee' ? (
      <>
        <Bouton
          variante="secondaire"
          chargement={enCours === 'manque'}
          onClick={() => surAction('manque', () => marquerManque(a.id, 'agriculteur'))}
        >
          Marquer l'absence de l'agriculteur
        </Bouton>
        <TerminerForm
          enCours={enCours === 'terminer'}
          surValider={(observation) =>
            surAction('terminer', () => terminerPromise(a.id, observation))
          }
        />
      </>
    ) : null}
  </section>
);

async function terminerPromise(id: string, observation: string) {
  const { terminerAccompagnement } = await import('@/services/api/accompagnements');
  return terminerAccompagnement(id, observation);
}

const TerminerForm: React.FC<{
  enCours: boolean;
  surValider: (observation: string) => void;
}> = ({ enCours, surValider }) => {
  const [valeur, setValeur] = useState('');
  return (
    <div className="flex flex-col gap-2">
      <Champ
        label="Compte rendu (observation)"
        value={valeur}
        onChange={(e) => setValeur(e.target.value)}
        placeholder="Recommandations agronomiques…"
      />
      <Bouton
        disabled={valeur.trim() === ''}
        chargement={enCours}
        onClick={() => surValider(valeur)}
      >
        Terminer l'accompagnement
      </Bouton>
    </div>
  );
};

function construireEtapes(a: AccompagnementDetailApi): EtapeTimeline[] {
  const ordre: Array<{ cle: string; titre: string }> = [
    { cle: 'demandee', titre: 'Demande envoyée' },
    { cle: 'acceptee', titre: 'Acceptée par l’ingénieur' },
    { cle: 'planifiee', titre: 'Rendez-vous planifié & payé' },
    { cle: 'terminee', titre: 'Accompagnement terminé' },
  ];
  const indexActuel = ordre.findIndex((e) => e.cle === a.statut);
  return ordre.map((etape, index) => ({
    id: etape.cle,
    titre: etape.titre,
    statut:
      a.statut === 'refusee' || a.statut === 'annulee' || a.statut === 'manquee'
        ? index <= indexActuel
          ? 'complete'
          : 'a_venir'
        : index < indexActuel
          ? 'complete'
          : index === indexActuel
            ? 'courante'
            : 'a_venir',
  }));
}
