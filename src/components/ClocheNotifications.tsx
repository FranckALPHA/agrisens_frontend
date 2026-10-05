import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { listerNotifications, obtenirCompteurNotifications } from '@/services/api/notifications';
import { useTempsReel } from '@/services/tempsReelContext';
import { MESSAGES } from '@/theme/messages';

/**
 * Cloche de notifications (prompt F-03 frontend point 2, SPEC-10) :
 * compteur de non lues rafraîchi par le **push WebSocket** (F-13) dès
 * `notification.nouvelle` ; l'**interrogation périodique** (30 s) ne reste
 * active que comme **repli** quand le canal temps réel n'est pas connecté
 * (hors ligne, reconnexion en cours). Aperçu des dernières non lues, lien
 * vers la page FE-05. Masquée tant que la session n'est pas connectée
 * (le parent ne l'affiche que dans la mise en page connectée).
 */

const INTERVALLE_MS = 30_000;

function relativeDepuis(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;
  const jours = Math.floor(heures / 24);
  return `il y a ${jours} j`;
}

export type CotePanneauNotifications = 'gauche' | 'droite';

export interface ClocheNotificationsProps {
  /**
   * Côté d'ouverture du panneau : `gauche` quand la cloche est collée au bord
   * droit d'un conteneur étroit (ex. sidebar — sinon le panneau déborde
   * hors-écran à gauche), `droite` quand elle est à droite d'un header large
   * (ex. en-tête mobile). Défaut : `droite`.
   */
  cote?: CotePanneauNotifications;
}

export const ClocheNotifications: React.FC<ClocheNotificationsProps> = ({
  cote = 'droite',
}) => {
  const navigate = useNavigate();
  const { statut } = useTempsReel();
  // Repli de rafraîchissement : inutile tant que le push WS est vivant.
  const intervalleRepli = statut === 'connecte' ? false : INTERVALLE_MS;
  const [ouverte, setOuverte] = useState(false);
  const conteneurRef = useRef<HTMLDivElement>(null);

  const requeteCompteur = useQuery({
    queryKey: ['notifications', 'compteur'],
    queryFn: obtenirCompteurNotifications,
    refetchInterval: intervalleRepli,
  });
  const nonLues = requeteCompteur.data ?? 0;

  // Aperçu des 5 dernières non lues : chargé uniquement quand le panneau est ouvert.
  const requeteApercu = useQuery({
    queryKey: ['notifications', 'apercu'],
    queryFn: () => listerNotifications(true),
    enabled: ouverte,
    refetchInterval: ouverte ? intervalleRepli : false,
  });

  // Fermer le panneau au clic extérieur.
  useEffect(() => {
    if (!ouverte) return;
    const surPointeur = (evement: MouseEvent) => {
      if (conteneurRef.current && !conteneurRef.current.contains(evement.target as Node)) {
        setOuverte(false);
      }
    };
    document.addEventListener('mousedown', surPointeur);
    return () => document.removeEventListener('mousedown', surPointeur);
  }, [ouverte]);

  const ouvrirDetail = (lien: string | null) => {
    // La marque « lue » est faite par la page FE-05 au clic sur la notification.
    setOuverte(false);
    navigate(lien ?? '/notifications');
  };

  return (
    <div ref={conteneurRef} className="relative" data-testid="cloche-notifications">
      <button
        type="button"
        aria-label={
          nonLues > 0 ? `Notifications, ${nonLues} non lues` : 'Notifications, aucune non lue'
        }
        onClick={() => setOuverte((v) => !v)}
        className="relative p-2 rounded-md text-texte-secondaire hover:bg-surface-survol hover:text-texte transition-colors min-h-tactile"
        data-testid="bouton-cloche"
      >
        <Bell size={20} aria-hidden="true" />
        {nonLues > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-erreur text-white text-[10px] font-bold flex items-center justify-center"
            data-testid="compteur-notifications"
          >
            {nonLues > 99 ? '99+' : nonLues}
          </span>
        )}
      </button>

      {ouverte && (
        <div
          className={`absolute ${cote === 'gauche' ? 'left-0' : 'right-0'} top-full mt-2 flex flex-col w-80 max-w-[calc(100vw-2rem)] max-h-[calc(100vh-4rem)] rounded-lg border border-bordure bg-surface shadow-lg z-50 overflow-hidden`}
          data-testid="panneau-notifications"
          role="menu"
        >
          <div className="px-4 py-3 border-b border-bordure flex items-center justify-between">
            <p className="text-sm font-semibold text-texte">Notifications</p>
            {nonLues > 0 && (
              <span className="text-xs text-texte-secondaire">
                {nonLues} non lue{nonLues > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="max-h-72 min-h-0 flex-1 overflow-y-auto">
            {requeteApercu.isError && (
              <p className="p-4 text-sm text-erreur">{MESSAGES.erreurReseau}</p>
            )}
            {requeteApercu.isLoading && (
              <p className="p-4 text-sm text-texte-secondaire">Chargement…</p>
            )}
            {!requeteApercu.isLoading && (requeteApercu.data?.elements.length ?? 0) === 0 && (
              <p className="p-4 text-sm text-texte-secondaire" data-testid="aucune-notification">
                Aucune notification non lue.
              </p>
            )}
            {requeteApercu.data?.elements.slice(0, 5).map((notification) => (
              <button
                key={notification.id}
                type="button"
                role="menuitem"
                onClick={() => ouvrirDetail(notification.lien)}
                className="w-full text-left px-4 py-3 border-b border-bordure last:border-0 hover:bg-surface-survol transition-colors"
                data-testid={`notification-cloche-${notification.id}`}
              >
                <p className="text-sm font-medium text-texte line-clamp-1">{notification.titre}</p>
                <p className="text-xs text-texte-secondaire line-clamp-2 mt-0.5">
                  {notification.contenu}
                </p>
                <p className="text-[11px] text-texte-muet mt-1">
                  {relativeDepuis(notification.cree_le)}
                </p>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setOuverte(false);
              navigate('/notifications');
            }}
            className="w-full shrink-0 px-4 py-3 text-sm font-medium text-primaire hover:bg-surface-survol border-t border-bordure text-center min-h-tactile"
            data-testid="voir-toutes-notifications"
          >
            Voir toutes les notifications
          </button>
        </div>
      )}
    </div>
  );
};
