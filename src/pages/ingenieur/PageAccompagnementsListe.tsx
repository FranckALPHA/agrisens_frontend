import React from 'react';
import { BadgeStatut } from '@/components/BadgeStatut';
import { Bouton } from '@/components/Bouton';
import { EtatChargement } from '@/components/EtatChargement';
import { EtatErreur } from '@/components/EtatErreur';
import { EtatVide } from '@/components/EtatVide';
import { STATUTS_ACCOMPAGNEMENT } from '@/theme/statuts';
import {
  listerAccompagnements,
  listerDemandes,
  messageErreurAccompagnement,
  type AccompagnementApi,
} from '@/services/api/accompagnements';
import { useQuery } from '@tanstack/react-query';

/**
 * ING-03 (F-11) — missions de l'ingénieur : demandes reçues + RDV actifs.
 */
export const PageAccompagnementsListe: React.FC = () => {
  const demandes = useQuery({ queryKey: ['accompagnements-demandes'], queryFn: listerDemandes });
  const missions = useQuery({
    queryKey: ['accompagnements-ingenieur'],
    queryFn: listerAccompagnements,
  });

  if (demandes.isLoading || missions.isLoading)
    return <EtatChargement message="Chargement de vos missions…" />;
  const erreur = demandes.error ?? missions.error;
  if (erreur)
    return (
      <EtatErreur
        message={messageErreurAccompagnement(erreur)}
        surReessayer={() => {
          void demandes.refetch();
          void missions.refetch();
        }}
      />
    );

  const listeDemandes = (demandes.data ?? []) as AccompagnementApi[];
  const listeMissions = (missions.data?.elements ?? []) as AccompagnementApi[];

  return (
    <div className="py-6 flex flex-col gap-6" data-testid="page-ing-accompagnements">
      <header>
        <h1 className="text-2xl font-bold text-texte">Mes missions d'accompagnement</h1>
        <p className="text-sm text-texte-secondaire">Demandes reçues et rendez-vous en cours.</p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="font-bold">Nouvelles demandes</h2>
        {listeDemandes.length === 0 ? (
          <EtatVide
            titre="Aucune demande en attente"
            message="Vous serez notifié dès qu'un agriculteur vous sollicite."
          />
        ) : (
          <ul className="grid gap-3" role="list">
            {listeDemandes.map((a) => (
              <CarteAccompagnement key={a.id} accompagnement={a} />
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-bold">Accompagnements suivis</h2>
        {listeMissions.length === 0 ? (
          <p className="text-sm text-texte-secondaire">Aucun accompagnement en cours.</p>
        ) : (
          <ul className="grid gap-3" role="list">
            {listeMissions.map((a) => (
              <CarteAccompagnement key={a.id} accompagnement={a} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

const CarteAccompagnement: React.FC<{ accompagnement: AccompagnementApi }> = ({
  accompagnement,
}) => (
  <li>
    <article
      data-testid={`ing-accompagnement-${accompagnement.id}`}
      className="rounded-lg border border-bordure bg-surface p-4 shadow-sm flex items-center justify-between gap-3"
    >
      <div>
        <h3 className="font-semibold">{accompagnement.agriculteur_nom}</h3>
        <p className="text-sm text-texte-secondaire">
          {accompagnement.exploitation_nom ?? 'Exploitation'} · {accompagnement.motif}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <BadgeStatut statut={accompagnement.statut} registre={STATUTS_ACCOMPAGNEMENT} />
        <Bouton
          taille="sm"
          variante="secondaire"
          to={`/ingenieur/accompagnements/${accompagnement.id}`}
        >
          Ouvrir
        </Bouton>
      </div>
    </article>
  </li>
);
