/**
 * Client temps réel global (F-13) : une seule connexion WebSocket par session,
 * monté dans la mise en page connectée. Le canal porte le chat (`message.nouveau`,
 * `message.lu`) et les notifications push (`notification.nouvelle`).
 *
 * Stratégie (hypothèses Q-46b/c/d/e) :
 * - authentification par **ticket jetable** (`POST /ws/ticket`) passé en query string ;
 * - **battement** serveur toutes les 25 s ; si un trou dépasse ~2 battements, on coupe
 *   et on se reconnecte (backoff exponentiel) ;
 * - à la réouverture, on envoie `reprendre{dernier_id}` pour récupérer les messages
 *   manqués (le serveur les renvoie en `message.nouveau`) ; sinon l'UI recharge HTTP ;
 * - la réception invalide les requêtes TanStack Query : **le HTTP reste la source de
 *   vérité** (données complètes, pieces jointes incluses), le WS n'est qu'un signal ;
 * - à la reconnexion, on **renvoie la file d'attente hors ligne**, une seule fois.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { URL_API_SANS_PREFICE, ErreurApi } from '@/services/api/client';
import { CODE_ERREUR_RESEAU } from '@/services/api/auth';
import { demanderTicketWs, envoyerMessage } from '@/services/api/conversations';
import { marquerNotificationLue } from '@/services/api/notifications';
import { depotPartage, vidanger, type ElementEnAttente } from '@/services/fileAttente';
import { useSessionStore } from '@/stores/session';
import { Contexte, deriverUrlWs, type StatutConnexion } from '@/services/tempsReelContext';

/** Intervalle de battement serveur (s) ; le client tolère ~2 trous avant reconnexion. */
const BATTEMENT_S = 25;
const DELAI_VIGILANCE_MS = (BATTEMENT_S * 2 + 10) * 1000;
const RETARD_MAX_MS = 15_000;

function estErreurReseau(erreur: unknown): boolean {
  return erreur instanceof ErreurApi && erreur.code === CODE_ERREUR_RESEAU;
}

export const FournisseurTempsReel: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const utilisateurId = useSessionStore((etat) => etat.utilisateur?.id ?? null);
  const queryClient = useQueryClient();
  const [statut, setStatut] = useState<StatutConnexion>('hors_ligne');
  const depot = useRef(depotPartage());

  // Toute la machinerie de connexion vit dans une seule closure d'effet :
  // `ouvrir` et `planifierReconnexion` se renvoient l'une l'autre sans dépendance
  // de hook circulaire ; le nettoyage (démontage, changement d'utilisateur)
  // ferme le socket et annule les minuteries en cours.
  useEffect(() => {
    if (!utilisateurId) {
      setStatut('hors_ligne');
      return;
    }

    let demonte = false;
    let courant: WebSocket | null = null;
    let minuterieReconnexion: ReturnType<typeof setTimeout> | null = null;
    let dernierIdVu: string | null = null;
    let horodatageBattement = Date.now();
    let tentative = 0;

    const vidangerFile = async () => {
      const envoyes = await vidanger(
        depot.current,
        async (item: ElementEnAttente) => {
          if ('corps' in item) {
            await envoyerMessage(item.conversationId, item.corps);
            queryClient.invalidateQueries({ queryKey: ['messages', item.conversationId] });
          } else {
            // F-15 : marquage de notification comme lue, remis à la reconnexion.
            await marquerNotificationLue(item.notificationId);
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
          }
        },
        estErreurReseau
      );
      if (envoyes > 0) queryClient.invalidateQueries({ queryKey: ['conversations'] });
    };

    const planifierReconnexion = () => {
      if (demonte || minuterieReconnexion) return;
      const delai = Math.min(2 ** tentative * 1000, RETARD_MAX_MS);
      tentative += 1;
      minuterieReconnexion = setTimeout(() => {
        minuterieReconnexion = null;
        ouvrir();
      }, delai);
    };

    function ouvrir(): void {
      if (demonte) return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setStatut('hors_ligne');
        return;
      }
      setStatut('connexion');
      void (async () => {
        let ticket: string;
        try {
          ({ ticket } = await demanderTicketWs());
        } catch {
          if (!demonte) planifierReconnexion();
          return;
        }
        if (demonte) return;

        const url = `${deriverUrlWs(URL_API_SANS_PREFICE)}?ticket=${encodeURIComponent(ticket)}`;
        const socket = new WebSocket(url);
        courant = socket;

        socket.onopen = () => {
          if (demonte) {
            socket.close();
            return;
          }
          tentative = 0;
          horodatageBattement = Date.now();
          setStatut('connecte');
          if (dernierIdVu) {
            socket.send(JSON.stringify({ type: 'reprendre', dernier_id: dernierIdVu }));
          }
          void vidangerFile();
        };

        socket.onmessage = (evenement) => {
          horodatageBattement = Date.now();
          let charge: { type?: string; donnees?: Record<string, unknown> };
          try {
            charge = JSON.parse(String(evenement.data));
          } catch {
            return;
          }
          const donnees = charge.donnees ?? {};
          const conversation = donnees['conversation'];
          switch (charge.type) {
            case 'battement':
              break;
            case 'message.nouveau': {
              const id = donnees['id'];
              if (typeof id === 'string') dernierIdVu = id;
              if (typeof conversation === 'string') {
                queryClient.invalidateQueries({ queryKey: ['messages', conversation] });
              }
              queryClient.invalidateQueries({ queryKey: ['conversations'] });
              if (typeof window !== 'undefined') {
                window.dispatchEvent(
                  new CustomEvent('agrisens:message-nouveau', { detail: donnees })
                );
              }
              break;
            }
            case 'message.lu':
              if (typeof conversation === 'string') {
                queryClient.invalidateQueries({ queryKey: ['messages', conversation] });
              }
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('agrisens:message-lu', { detail: donnees }));
              }
              break;
            case 'notification.nouvelle':
              queryClient.invalidateQueries({ queryKey: ['notifications'] });
              break;
            default:
              break;
          }
        };

        socket.onclose = () => {
          if (demonte) return;
          setStatut(
            typeof navigator !== 'undefined' && navigator.onLine === false
              ? 'hors_ligne'
              : 'connexion'
          );
          planifierReconnexion();
        };
        socket.onerror = () => socket.close();
      })();
    }

    ouvrir();

    // Vigilance du battement : un trou > ~2 battements coupe, la reconnexion suit.
    const vigilance = setInterval(() => {
      if (courant && courant.readyState === WebSocket.OPEN) {
        if (Date.now() - horodatageBattement > DELAI_VIGILANCE_MS) courant.close();
      }
    }, 5_000);

    const surLigne = () => ouvrir();
    const surHorsLigne = () => {
      setStatut('hors_ligne');
      courant?.close();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('online', surLigne);
      window.addEventListener('offline', surHorsLigne);
    }

    return () => {
      demonte = true;
      if (minuterieReconnexion) clearTimeout(minuterieReconnexion);
      clearInterval(vigilance);
      courant?.close();
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', surLigne);
        window.removeEventListener('offline', surHorsLigne);
      }
    };
  }, [utilisateurId, queryClient]);

  return <Contexte.Provider value={{ statut }}>{children}</Contexte.Provider>;
};
