import React from 'react';
import { MiseEnPageConnectee } from './MiseEnPageConnectee';
import { MiseEnPagePublique } from './MiseEnPagePublique';
import { useSessionStore } from '@/stores/session';

/**
 * Mise en page **adaptative** pour les pages publiques qui doivent rester
 * accessibles aux visiteurs non connectés **et** conserver le chrome connecté
 * (sidebar + en-tête) quand l'utilisateur est connecté.
 *
 * Cas d'usage :
 * - `/catalogue` + `/catalogue/:identifiant` : spec F-05 — catalogue public,
 *   backend sert `Cache-Control: public, max-age=60` + ETag ; le SW met en
 *   cache StaleWhileRevalidate que l'utilisateur soit connecté ou non.
 * - `/acces-interdit` : page atteignable à la fois par un visiteur (URL
 *   directe) et par un utilisateur connecté redirigé depuis `RouteProtegee`
 *   quand son rôle n'est pas autorisé sur la route demandée.
 *
 * Rendu :
 * - `<MiseEnPageConnectee />` si la session est active ;
 * - `<MiseEnPagePublique />` sinon.
 *
 * Les deux layouts rendent eux-mêmes `<Outlet />` : la page fille s'affiche
 * dans le chrome choisi, sans rechargement. On évite ainsi la perte de la
 * sidebar et du badge de notifications quand un utilisateur connecté
 * navigue vers l'une de ces pages.
 */
export const MiseEnPageAdaptative: React.FC = () => {
  const estConnecte = useSessionStore((s) => s.estConnecte);
  return estConnecte ? <MiseEnPageConnectee /> : <MiseEnPagePublique />;
};
