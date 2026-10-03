import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeStatut } from '@/components/BadgeStatut';
import { Bouton } from '@/components/Bouton';
import { Champ } from '@/components/Champ';
import { EtatChargement } from '@/components/EtatChargement';
import { EtatErreur } from '@/components/EtatErreur';
import { STATUTS_ACCOMPAGNEMENT } from '@/theme/statuts';
import { formaterPrix } from '@/services/api/produits';
import {
  accepterAccompagnement,
  marquerManque,
  messageErreurAccompagnement,
  obtenirAccompagnement,
  planifierAccompagnement,
  refuserAccompagnement,
  terminerAccompagnement,
} from '@/services/api/accompagnements';

/**
 * ING-04 (F-11) — détail d'un accompagnement côté ingénieur : accepter/refuser,
 * planifier (conflit créneau → 409), terminer (observation obligatoire) et
 * marquer le RDV manqué.
 */
export const PageAccompagnementDetailIngenieur: React.FC = () => {
  const { identifiant = '' } = useParams<{ identifiant: string }>();
  const queryClient = useQueryClient();
  const requete = useQuery({
    queryKey: ['accompagnement', identifiant],
    queryFn: () => obtenirAccompagnement(identifiant),
    enabled: identifiant !== '',
  });
  const [messageErreur, setMessageErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<string | null>(null);

  const executer = async (nom: string, fn: () => Promise<unknown>) => {
    setMessageErreur(null);
    setEnCours(nom);
    try {
      await fn();
      await queryClient.invalidateQueries({ queryKey: ['accompagnement', identifiant] });
    } catch (cause) {
      setMessageErreur(messageErreurAccompagnement(cause));
    } finally {
      setEnCours(null);
    }
  };

  if (requete.isLoading) return <EtatChargement message="Chargement…" />;
  if (requete.error)
    return (
      <EtatErreur
        message={messageErreurAccompagnement(requete.error)}
        surReessayer={() => void requete.refetch()}
      />
    );

  const a = requete.data;
  if (!a) return null;

  return (
    <div className="py-6 flex flex-col gap-5 max-w-3xl" data-testid="page-ing-detail">
      <header className="flex justify-between items-start gap-3">
        <div>
          <h1 className="text-2xl font-bold text-texte">{a.agriculteur_nom}</h1>
          <p className="text-sm text-texte-secondaire">
            {a.exploitation_nom ?? 'Exploitation'} ·{' '}
            {a.modalite === 'presentiel' ? 'Présentiel' : 'En ligne'}
          </p>
        </div>
        <BadgeStatut statut={a.statut} registre={STATUTS_ACCOMPAGNEMENT} />
      </header>

      <section className="rounded-lg border border-bordure bg-surface p-4">
        <h2 className="font-bold mb-2">Demande</h2>
        <p className="text-sm">{a.motif}</p>
        {a.description ? (
          <p className="text-sm mt-2 text-texte-secondaire">{a.description}</p>
        ) : null}
        {a.prix_consultation_fcfa !== null ? (
          <p className="mt-3 text-sm">
            <strong>Total :</strong>{' '}
            <span data-testid="ing-detail-total">
              {formaterPrix(a.prix_consultation_fcfa + (a.frais_deplacement_fcfa ?? 0))}
            </span>
            {a.distance_km !== null ? (
              <span className="text-texte-muet"> · {a.distance_km} km aller</span>
            ) : null}
          </p>
        ) : null}
        {a.date_rdv_debut ? (
          <p className="mt-2 text-sm">
            RDV prévu le <strong>{new Date(a.date_rdv_debut).toLocaleString('fr-FR')}</strong>
            {a.lieu_rdv_texte ? <> — {a.lieu_rdv_texte}</> : null}
          </p>
        ) : null}
        {a.observation ? (
          <p className="mt-3 text-sm" data-testid="ing-observation">
            <strong>Compte rendu : </strong>
            {a.observation}
          </p>
        ) : null}
      </section>

      {messageErreur ? (
        <p
          role="alert"
          className="text-sm text-erreur rounded bg-erreur-fond/30 border border-red-200 p-2"
        >
          {messageErreur}
        </p>
      ) : null}

      {a.statut === 'demandee' ? (
        <div className="flex flex-col gap-3">
          <FormulaireRefus
            chargement={enCours === 'refuser'}
            surRefuser={(motif) => executer('refuser', () => refuserAccompagnement(a.id, motif))}
          />
          <Bouton
            chargement={enCours === 'accepter'}
            onClick={() => executer('accepter', () => accepterAccompagnement(a.id))}
          >
            Accepter la demande
          </Bouton>
        </div>
      ) : null}

      {a.statut === 'acceptee' || a.statut === 'manquee' ? (
        <FormulairePlanification
          modalite={a.modalite}
          chargement={enCours === 'planifier'}
          surPlanifier={(corps) =>
            executer('planifier', () => planifierAccompagnement(a.id, corps))
          }
        />
      ) : null}

      {a.statut === 'planifiee' ? (
        <div className="flex flex-col gap-3">
          <FormulaireTerminer
            chargement={enCours === 'terminer'}
            surTerminer={(observation) =>
              executer('terminer', () => terminerAccompagnement(a.id, observation))
            }
          />
          <Bouton
            variante="discret"
            chargement={enCours === 'manque'}
            onClick={() => executer('manque', () => marquerManque(a.id, 'agriculteur'))}
          >
            L'agriculteur était absent
          </Bouton>
          <Bouton
            variante="danger"
            chargement={enCours === 'manque-ing'}
            onClick={() => executer('manque-ing', () => marquerManque(a.id, 'ingenieur'))}
          >
            J'étais absent (remboursement auto)
          </Bouton>
        </div>
      ) : null}
    </div>
  );
};

const FormulaireRefus: React.FC<{
  chargement: boolean;
  surRefuser: (motif: string) => void;
}> = ({ chargement, surRefuser }) => {
  const [motif, setMotif] = useState('');
  return (
    <div className="rounded-lg border border-bordure bg-surface p-4 flex flex-col gap-2">
      <Champ
        label="Motif du refus"
        value={motif}
        onChange={(e) => setMotif(e.target.value)}
        placeholder="Ex. spécialité différente, zone trop éloignée…"
      />
      <Bouton
        variante="danger"
        disabled={motif.trim() === ''}
        chargement={chargement}
        onClick={() => surRefuser(motif)}
      >
        Refuser
      </Bouton>
    </div>
  );
};

const FormulairePlanification: React.FC<{
  modalite: 'presentiel' | 'en_ligne';
  chargement: boolean;
  surPlanifier: (corps: {
    date_debut: string;
    date_fin: string;
    lieu_rdv_texte?: string;
    lien_visio?: string;
  }) => void;
}> = ({ modalite, chargement, surPlanifier }) => {
  const [debut, setDebut] = useState('');
  const [fin, setFin] = useState('');
  const [lieu, setLieu] = useState('');
  const [lien, setLien] = useState('');
  const valide =
    debut !== '' && fin !== '' && (modalite === 'presentiel' ? lieu !== '' : lien !== '');
  return (
    <section
      className="rounded-lg border border-bordure bg-surface p-4 flex flex-col gap-2"
      data-testid="form-planifier"
    >
      <h2 className="font-bold">Planifier le rendez-vous</h2>
      <Champ
        label="Début"
        type="datetime-local"
        value={debut}
        onChange={(e) => setDebut(e.target.value)}
      />
      <Champ
        label="Fin"
        type="datetime-local"
        value={fin}
        onChange={(e) => setFin(e.target.value)}
      />
      {modalite === 'presentiel' ? (
        <Champ
          label="Lieu"
          value={lieu}
          onChange={(e) => setLieu(e.target.value)}
          placeholder="Adresse ou repère"
        />
      ) : (
        <Champ
          label="Lien visio"
          type="url"
          value={lien}
          onChange={(e) => setLien(e.target.value)}
          placeholder="https://…"
        />
      )}
      <Bouton
        disabled={!valide}
        chargement={chargement}
        onClick={() =>
          surPlanifier({
            date_debut: new Date(debut).toISOString(),
            date_fin: new Date(fin).toISOString(),
            ...(modalite === 'presentiel' ? { lieu_rdv_texte: lieu } : { lien_visio: lien }),
          })
        }
      >
        Confirmer le créneau
      </Bouton>
    </section>
  );
};

const FormulaireTerminer: React.FC<{
  chargement: boolean;
  surTerminer: (observation: string) => void;
}> = ({ chargement, surTerminer }) => {
  const [observation, setObservation] = useState('');
  return (
    <section
      className="rounded-lg border border-bordure bg-surface p-4 flex flex-col gap-2"
      data-testid="form-terminer"
    >
      <h2 className="font-bold">Clôturer l'accompagnement</h2>
      <Champ
        label="Compte rendu (observation)"
        value={observation}
        onChange={(e) => setObservation(e.target.value)}
        placeholder="Conseils donnés, recommandations…"
      />
      <Bouton
        disabled={observation.trim() === ''}
        chargement={chargement}
        onClick={() => surTerminer(observation)}
      >
        Terminer
      </Bouton>
    </section>
  );
};
