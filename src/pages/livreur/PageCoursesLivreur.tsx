import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { Bouton } from '@/components/Bouton';
import { EtatChargement } from '@/components/EtatChargement';
import { EtatErreur } from '@/components/EtatErreur';
import { EtatVide } from '@/components/EtatVide';
import {
  accepterLivraison,
  formaterDuree,
  listerLivraisonsDisponibles,
  listerMesLivraisons,
  messageErreurLivraison,
} from '@/services/api/livraisons';
import { formaterPrix } from '@/services/api/produits';
import { ErreurApi } from '@/services/api/client';

/**
 * LIV-02 — livraisons proposées (distance, estimation, récupération, zone,
 * frais) et mes courses. Accepter : 409 « déjà prise » → message + refresh.
 */
export const PageCoursesLivreur: React.FC = () => {
  const clientRequete = useQueryClient();
  const [erreur, setErreur] = useState<unknown>(null);
  const [acceptationEnCours, setAcceptationEnCours] = useState<string | null>(null);

  const requeteDisponibles = useQuery({
    queryKey: ['livraisons-disponibles'],
    queryFn: listerLivraisonsDisponibles,
  });
  const requeteMiennes = useQuery({
    queryKey: ['mes-livraisons'],
    queryFn: listerMesLivraisons,
  });

  const accepter = async (identifiant: string) => {
    setErreur(null);
    setAcceptationEnCours(identifiant);
    try {
      await accepterLivraison(identifiant);
      await clientRequete.invalidateQueries({ queryKey: ['livraisons-disponibles'] });
      await clientRequete.invalidateQueries({ queryKey: ['mes-livraisons'] });
    } catch (cause) {
      setErreur(cause);
      await clientRequete.invalidateQueries({ queryKey: ['livraisons-disponibles'] });
    } finally {
      setAcceptationEnCours(null);
    }
  };

  return (
    <div className="py-6 flex flex-col gap-6" data-testid="page-courses-livreur">
      <header>
        <h1 className="text-2xl font-bold text-texte">Mes courses</h1>
        <p className="text-sm text-texte-secondaire mt-1">
          Livraisons proposées près de vous, sans adresse exacte avant acceptation.
        </p>
      </header>

      {erreur ? (
        <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-erreur">
          {erreur instanceof ErreurApi ? messageErreurLivraison(erreur) : 'Action impossible.'}
        </p>
      ) : null}

      <section aria-label="Livraisons proposées" className="flex flex-col gap-3">
        <h2 className="font-bold text-texte">Proposées</h2>
        {requeteDisponibles.isLoading && <EtatChargement message="Recherche des courses…" />}
        {requeteDisponibles.isError && (
          <EtatErreur
            message="Impossible de charger les courses."
            surReessayer={() => requeteDisponibles.refetch()}
          />
        )}
        {requeteDisponibles.data && requeteDisponibles.data.length === 0 && (
          <EtatVide
            titre="Aucune livraison proposée"
            message="Passez disponible depuis la page Disponibilité pour recevoir des courses."
          />
        )}
        {requeteDisponibles.data?.map((livraison) => (
          <article
            key={livraison.id}
            aria-label={`Livraison ${livraison.commande_reference}`}
            className="rounded-lg border border-bordure bg-surface p-4 flex flex-col gap-2"
          >
            <div className="flex justify-between gap-2">
              <p className="font-bold text-texte">{livraison.commande_reference}</p>
              <p className="font-bold text-primaire">
                {formaterPrix(livraison.frais_livraison_fcfa ?? 0)}
              </p>
            </div>
            <p className="text-sm text-texte-secondaire">
              {livraison.distance_km} km · {formaterDuree(livraison.duree_estimee_min)} · Zone :{' '}
              {livraison.zone_livraison}
            </p>
            <div>
              <Bouton
                taille="sm"
                chargement={acceptationEnCours === livraison.id}
                onClick={() => void accepter(livraison.id)}
                iconeGauche={<Check size={15} />}
              >
                Accepter
              </Bouton>
            </div>
          </article>
        ))}
      </section>

      <section aria-label="Mes livraisons acceptées" className="flex flex-col gap-3">
        <h2 className="font-bold text-texte">Acceptées et en cours</h2>
        {requeteMiennes.isLoading && <EtatChargement message="Chargement…" />}
        {requeteMiennes.data && requeteMiennes.data.length === 0 && (
          <p className="text-sm text-texte-secondaire">Aucune course acceptée.</p>
        )}
        {requeteMiennes.data?.map((livraison) => (
          <p key={livraison.id} className="text-sm">
            <Link
              to={`/livreur/courses/${livraison.id}`}
              className="text-primaire underline font-medium"
            >
              {livraison.commande_reference}
            </Link>{' '}
            <span className="text-texte-secondaire">
              · {livraison.statut} · {livraison.zone_livraison}
            </span>
          </p>
        ))}
      </section>
    </div>
  );
};
