import React, { useCallback, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CheckCheck, MailOpen } from 'lucide-react';
import { BadgeStatut } from '@/components/BadgeStatut';
import { Bouton } from '@/components/Bouton';
import { EtatChargement } from '@/components/EtatChargement';
import { EtatErreur } from '@/components/EtatErreur';
import { EtatVide } from '@/components/EtatVide';
import { Pagination } from '@/components/Pagination';
import { Select } from '@/components/Select';
import { ErreurApi } from '@/services/api/client';
import { CODE_ERREUR_RESEAU } from '@/services/api/auth';
import {
  listerNotifications,
  marquerNotificationLue,
  toutMarquerLu,
  type NotificationApi,
  type TypeNotificationApi,
} from '@/services/api/notifications';
import { depotPartage, empiler } from '@/services/fileAttente';
import { STATUTS_NOTIFICATION } from '@/theme/statuts';
import { useToast } from '@/components/Toast';
import { MESSAGES } from '@/theme/messages';

/**
 * Page FE-05 — Notifications (prompt F-03 frontend point 2, 09 §FE-05) :
 * catégories, lu/non lu, ouverture du contexte lié. Cliquer une notification
 * la marque lue puis navigue vers `lien` si elle en porte un.
 */

const CATEGORIES: { valeur: string; libelle: string }[] = [
  { valeur: 'toutes', libelle: 'Toutes les catégories' },
  { valeur: 'commande', libelle: 'Commandes' },
  { valeur: 'paiement', libelle: 'Paiements' },
  { valeur: 'livraison', libelle: 'Livraisons' },
  { valeur: 'accompagnement', libelle: 'Accompagnement' },
  { valeur: 'abonnement', libelle: 'Abonnements' },
  { valeur: 'administration', libelle: 'Administration' },
  { valeur: 'signalement', libelle: 'Signalements' },
];

function dateLisible(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const PageNotifications: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { afficherToast } = useToast();
  const [categorie, setCategorie] = useState<'toutes' | TypeNotificationApi>('toutes');
  const [seulementNonLues, setSeulementNonLues] = useState(false);
  const [page, setPage] = useState(1);
  const taillePage = 20;

  const requete = useQuery({
    queryKey: ['notifications', 'liste', seulementNonLues, page],
    queryFn: () => listerNotifications(seulementNonLues),
  });

  const depot = useRef(depotPartage());

  const fraichir = () => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  /** Marque lue côté cache sans attendre le serveur (file hors ligne + optimistic). */
  const marquerLueLocal = useCallback(
    (id: string) => {
      queryClient.setQueryData<{ elements: NotificationApi[]; total: number } | undefined>(
        ['notifications', 'liste', seulementNonLues, page],
        (precedent) =>
          precedent
            ? {
                ...precedent,
                elements: precedent.elements.map((n) =>
                  n.id === id ? { ...n, non_lue: false } : n
                ),
              }
            : precedent
      );
    },
    [queryClient, seulementNonLues, page]
  );

  const horsLigne = () => typeof navigator !== 'undefined' && navigator.onLine === false;

  // Action sûre F-15 : hors ligne, le marquage part en file (jamais perçu côté serveur)
  // puis est rejoué à la reconnexion par le fournisseur de temps réel.
  const demanderLecture = (id: string) => {
    if (horsLigne()) {
      empiler(depot.current, { type: 'notification-lue', notificationId: id });
      marquerLueLocal(id);
      fraichir();
      return true;
    }
    return false;
  };

  const mutationLue = useMutation({
    mutationFn: (id: string) => marquerNotificationLue(id),
    onSuccess: (_donnees, id) => {
      fraichir();
      // Ouverture du contexte après marque de lecture (FE-05).
      const cible = requete.data?.elements.find((n) => n.id === id)?.lien;
      if (cible) navigate(cible);
    },
    onError: (erreur: unknown, id) => {
      // Erreur réseau : on met en file plutôt que d'échouer (F-15).
      if (erreur instanceof ErreurApi && erreur.code === CODE_ERREUR_RESEAU) {
        empiler(depot.current, { type: 'notification-lue', notificationId: id });
        marquerLueLocal(id);
        afficherToast(MESSAGES.horsLigne, 'info');
        return;
      }
      afficherToast(MESSAGES.erreurReseau, 'erreur');
    },
  });

  const mutationTout = useMutation({
    mutationFn: () => toutMarquerLu(),
    onSuccess: (nombre) => {
      fraichir();
      afficherToast(
        nombre > 0
          ? `${nombre} notification${nombre > 1 ? 's' : ''} marquée${nombre > 1 ? 's' : ''} comme lue${nombre > 1 ? 's' : ''}.`
          : 'Aucune notification non lue.',
        'succes'
      );
    },
    onError: () => afficherToast(MESSAGES.erreurReseau, 'erreur'),
  });

  const elements = (requete.data?.elements ?? []).filter(
    (n) => categorie === 'toutes' || n.type === categorie
  );
  const total = requete.data?.total ?? 0;

  return (
    <div className="py-6 flex flex-col gap-4" data-testid="page-notifications">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-texte">Notifications</h1>
          <p className="text-sm text-texte-secondaire">
            Toute l'activité de votre compte, même quand l'application est fermée.
          </p>
        </div>
        <Bouton
          type="button"
          variante="secondaire"
          onClick={() => mutationTout.mutate()}
          disabled={mutationTout.isPending}
          iconeGauche={<CheckCheck size={18} aria-hidden="true" />}
          data-testid="bouton-tout-lire"
        >
          Tout marquer comme lu
        </Bouton>
      </div>

      {/* Filtres : catégorie + lu/non lu (FE-05) */}
      <div className="flex items-end gap-3 flex-wrap">
        <div className="w-full sm:w-56">
          <Select
            label="Catégorie"
            value={categorie}
            options={CATEGORIES.map((c) => ({ valeur: c.valeur, libelle: c.libelle }))}
            onChange={(evement) => {
              setCategorie(evement.target.value as 'toutes' | TypeNotificationApi);
              setPage(1);
            }}
            data-testid="filtre-categorie"
          />
        </div>
        <Bouton
          type="button"
          variante={seulementNonLues ? 'primaire' : 'secondaire'}
          onClick={() => {
            setSeulementNonLues((v) => !v);
            setPage(1);
          }}
          iconeGauche={<MailOpen size={18} aria-hidden="true" />}
          data-testid="filtre-non-lues"
        >
          Non lues uniquement
        </Bouton>
      </div>

      {requete.isLoading && <EtatChargement message="Chargement des notifications…" />}
      {requete.isError && (
        <EtatErreur message={MESSAGES.erreurReseau} surReessayer={() => requete.refetch()} />
      )}

      {!requete.isLoading && !requete.isError && elements.length === 0 && (
        <EtatVide
          titre="Aucune notification"
          message={
            seulementNonLues
              ? 'Vous êtes à jour : tout a été lu.'
              : 'Les messages de la plateforme apparaîtront ici.'
          }
        />
      )}

      <ul className="flex flex-col gap-2">
        {elements.map((notification: NotificationApi) => (
          <li key={notification.id}>
            <button
              type="button"
              onClick={() => {
                if (notification.non_lue) {
                  const misEnFile = demanderLecture(notification.id);
                  if (!misEnFile) {
                    mutationLue.mutate(notification.id);
                  } else if (notification.lien) {
                    navigate(notification.lien);
                  }
                } else if (notification.lien) navigate(notification.lien);
              }}
              className={`w-full text-left p-4 rounded-lg border transition-colors hover:bg-surface-survol ${
                notification.non_lue
                  ? 'border-primaire/40 bg-primaire-douce/40'
                  : 'border-bordure bg-surface'
              }`}
              data-testid={`notification-${notification.id}`}
              data-non-lue={notification.non_lue ? 'true' : 'false'}
            >
              <div className="flex items-center gap-2 flex-wrap">
                {notification.non_lue && (
                  <span
                    className="w-2 h-2 rounded-full bg-primaire shrink-0"
                    aria-label="Non lue"
                    data-testid="pastille-non-lue"
                  />
                )}
                <p className="text-sm font-semibold text-texte flex-1 min-w-[12rem]">
                  {notification.titre}
                </p>
                <BadgeStatut
                  statut={notification.type}
                  registre={STATUTS_NOTIFICATION}
                  taille="sm"
                />
              </div>
              <p className="text-sm text-texte-secondaire mt-1">{notification.contenu}</p>
              <p className="text-xs text-texte-muet mt-2">{dateLisible(notification.cree_le)}</p>
            </button>
          </li>
        ))}
      </ul>

      <Pagination
        pageCourante={page}
        totalElements={total}
        taillePage={taillePage}
        surChangementPage={setPage}
      />
    </div>
  );
};
