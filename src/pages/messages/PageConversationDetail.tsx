import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Ban, Check, CheckCheck, Flag, Loader2, Paperclip, Send } from 'lucide-react';
import { Bouton } from '@/components/Bouton';
import { BadgeStatut } from '@/components/BadgeStatut';
import { EtatChargement } from '@/components/EtatChargement';
import { EtatErreur } from '@/components/EtatErreur';
import { DialogueConfirmation } from '@/components/DialogueConfirmation';
import { TeleversementFichier } from '@/components/TeleversementFichier';
import { useToast } from '@/components/Toast';
import { chargerContenuFichier, type FichierApi } from '@/services/api/fichiers';
import { ErreurApi } from '@/services/api/client';
import { CODE_ERREUR_RESEAU } from '@/services/api/auth';
import {
  bloquer,
  debloquer,
  genererIdClient,
  envoyerMessage,
  listerMessages,
  marquerLu,
  messageErreurConversations,
  obtenirConversation,
  signalerMessage,
  type MessageApi,
} from '@/services/api/conversations';
import { creerDepot, empiler, type MessageEnAttente } from '@/services/fileAttente';
import { useTempsReel } from '@/services/tempsReelContext';
import { useSessionStore } from '@/stores/session';
import { STATUTS_CONVERSATION } from '@/theme/statuts';
import { MESSAGES, TEXTES_CHAT } from '@/theme/messages';

/**
 * Page F-13 — fil d'une conversation (message.detail). Source de vérité : le
 * HTTP ; le temps réel ne fait qu'invalider la requête (le message apparaît
 * sans recharger). Le `contenu` est rendu en texte brut par React : aucun
 * script n'est exécuté (PW-F13-04). Hors ligne, l'envoi part en file d'attente.
 */

function heureLisible(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/** Pièce jointe d'un message : aperçu image (via le flux authentifié) ou lien. */
const PieceJointe: React.FC<{ fichier: FichierApi }> = ({ fichier }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let revoke: string | null = null;
    if (fichier.type_mime.startsWith('image/')) {
      void chargerContenuFichier(fichier.id).then((blob) => {
        if (blob) {
          revoke = URL.createObjectURL(blob);
          setUrl(revoke);
        }
      });
    }
    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [fichier.id, fichier.type_mime]);

  if (url) {
    return (
      <img
        src={url}
        alt={fichier.nom_original}
        className="mt-1 max-h-48 rounded-lg border border-bordure object-cover"
        data-testid="piece-jointe-image"
      />
    );
  }
  return (
    <span className="mt-1 inline-flex items-center gap-1 text-xs text-texte-secondaire">
      <Paperclip size={12} aria-hidden="true" />
      {fichier.nom_original}
    </span>
  );
};

export const PageConversationDetail: React.FC = () => {
  const { identifiant = '' } = useParams<{ identifiant: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { afficherToast } = useToast();
  const utilisateur = useSessionStore((etat) => etat.utilisateur);
  const { statut } = useTempsReel();

  const depot = useRef(creerDepot());
  const filRef = useRef<HTMLDivElement>(null);

  const [texte, setTexte] = useState('');
  const [fichierId, setFichierId] = useState<string | null>(null);
  const [fichierApi, setFichierApi] = useState<FichierApi | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [bloque, setBloque] = useState(false);
  const [dernierLuParAutre, setDernierLuParAutre] = useState<string | null>(null);
  const [enAttente, setEnAttente] = useState<MessageEnAttente[]>([]);
  const [plusAnciens, setPlusAnciens] = useState<MessageApi[]>([]);
  const [chargementAncien, setChargementAncien] = useState(false);
  const [finHistorique, setFinHistorique] = useState(false);
  const [signalementId, setSignalementId] = useState<string | null>(null);
  const marqueLuRef = useRef<string | null>(null);

  const requeteConversation = useQuery({
    queryKey: ['conversation', identifiant],
    queryFn: () => obtenirConversation(identifiant),
    enabled: Boolean(identifiant),
  });

  const requeteMessages = useQuery({
    queryKey: ['messages', identifiant],
    queryFn: () => listerMessages(identifiant),
    enabled: Boolean(identifiant),
  });

  const conversation = requeteConversation.data;
  const autreId = conversation?.autre_participant?.id ?? null;
  const autreNom = conversation?.autre_participant?.nom ?? 'Conversation';

  // Historique courant = pages anciennes + fenêtre récente, dédupliqué par id.
  const messages = useMemo(() => {
    const bruts = [...plusAnciens, ...(requeteMessages.data ?? [])];
    return bruts.filter((m, index) => bruts.findIndex((x) => x.id === m.id) === index);
  }, [plusAnciens, requeteMessages.data]);

  // Remettre la file à jour : messages en attente de CETTE conversation.
  const rafraichirFile = useCallback(() => {
    setEnAttente(depot.current.lire().filter((item) => item.conversationId === identifiant));
  }, [identifiant]);

  useEffect(() => {
    rafraichirFile();
  }, [rafraichirFile, statut]);

  // Défilement vers le bas à l'arrivée de nouveaux messages.
  useEffect(() => {
    const fil = filRef.current;
    if (fil) fil.scrollTop = fil.scrollHeight;
  }, [messages.length, enAttente.length]);

  // Marquer lus les messages de l'autre (accusé → WS `message.lu` vers l'autre).
  useEffect(() => {
    const moi = utilisateur?.id;
    const dernierAutrui = [...messages].reverse().find((m) => m.auteur !== moi);
    if (dernierAutrui && dernierAutrui.id !== marqueLuRef.current) {
      marqueLuRef.current = dernierAutrui.id;
      void marquerLu(identifiant, dernierAutrui.id).catch(() => undefined);
    }
  }, [messages, identifiant, utilisateur?.id]);

  // Accusé de lecture reçu en direct de l'autre partie (affiche « Lu »).
  useEffect(() => {
    const surLu = (evenement: Event) => {
      const detail = (evenement as CustomEvent).detail as {
        conversation?: string;
        lu_par?: string;
        dernier_message_lu?: string;
      };
      if (
        detail.conversation === identifiant &&
        detail.lu_par &&
        detail.lu_par !== utilisateur?.id
      ) {
        setDernierLuParAutre(detail.dernier_message_lu ?? null);
      }
    };
    window.addEventListener('agrisens:message-lu', surLu);
    return () => window.removeEventListener('agrisens:message-lu', surLu);
  }, [identifiant, utilisateur?.id]);

  const indexLu = dernierLuParAutre ? messages.findIndex((m) => m.id === dernierLuParAutre) : -1;

  const envoyer = async () => {
    const contenu = texte.trim();
    if (!contenu && !fichierId) {
      afficherToast(messageErreurConversations(new ErreurApi('message_vide', '', 422)), 'erreur');
      return;
    }
    const idClient = genererIdClient();
    const corps = {
      ...(contenu ? { contenu } : {}),
      ...(fichierId ? { fichier_id: fichierId } : {}),
      id_client: idClient,
    };
    setEnvoiEnCours(true);
    try {
      await envoyerMessage(identifiant, corps);
      setTexte('');
      setFichierId(null);
      setFichierApi(null);
      queryClient.invalidateQueries({ queryKey: ['messages', identifiant] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } catch (erreur) {
      const horsLigne =
        (erreur instanceof ErreurApi && erreur.code === CODE_ERREUR_RESEAU) ||
        (typeof navigator !== 'undefined' && navigator.onLine === false);
      if (horsLigne) {
        // Mise en file : renvoyée une seule fois à la reconnexion (Q-46d).
        empiler(depot.current, { conversationId: identifiant, corps });
        setTexte('');
        setFichierId(null);
        setFichierApi(null);
        rafraichirFile();
        afficherToast(TEXTES_CHAT.enAttente, 'info');
      } else {
        if (erreur instanceof ErreurApi && erreur.code === 'blocage_actif') {
          setBloque(true);
        }
        afficherToast(messageErreurConversations(erreur), 'erreur');
      }
    } finally {
      setEnvoiEnCours(false);
    }
  };

  const chargerPlusAnciens = async () => {
    const premierId = messages[0]?.id;
    if (!premierId || chargementAncien || finHistorique) return;
    setChargementAncien(true);
    try {
      const lot = await listerMessages(identifiant, premierId);
      if (lot.length === 0) setFinHistorique(true);
      else setPlusAnciens((prec) => [...lot, ...prec]);
    } catch {
      setFinHistorique(true);
    } finally {
      setChargementAncien(false);
    }
  };

  const basculerBlocage = async () => {
    if (!autreId) return;
    try {
      if (bloque) {
        await debloquer(autreId);
        setBloque(false);
        afficherToast('Utilisateur débloqué.', 'succes');
      } else {
        await bloquer(autreId);
        setBloque(true);
        afficherToast('Utilisateur bloqué : plus aucun message ne peut être échangé.', 'succes');
      }
    } catch (erreur) {
      afficherToast(messageErreurConversations(erreur), 'erreur');
    }
  };

  const confirmerSignalement = async () => {
    if (!signalementId) return;
    try {
      await signalerMessage(
        signalementId,
        TEXTES_CHAT.motifSignalement,
        TEXTES_CHAT.descriptionSignalement
      );
      afficherToast('Message signalé à la modération.', 'succes');
    } catch (erreur) {
      afficherToast(messageErreurConversations(erreur), 'erreur');
    } finally {
      setSignalementId(null);
    }
  };

  const indicateurConnexion =
    statut === 'connecte'
      ? { libelle: TEXTES_CHAT.connecte, classe: 'text-succes' }
      : statut === 'hors_ligne'
        ? { libelle: TEXTES_CHAT.horsLigne, classe: 'text-erreur' }
        : { libelle: TEXTES_CHAT.reconnexion, classe: 'text-avertissement' };

  const sante = requeteConversation.isLoading || requeteMessages.isLoading;

  return (
    <div className="py-4 flex flex-col h-full" data-testid="page-conversation-detail">
      {/* En-tête : retour (mobile), interlocuteur, type, actions */}
      <div className="flex items-center gap-3 pb-3 border-b border-bordure">
        <button
          type="button"
          onClick={() => navigate('/messages')}
          aria-label={TEXTES_CHAT.retourListe}
          className="p-2 rounded-md text-texte-secondaire hover:bg-surface-survol"
          data-testid="bouton-retour-liste"
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-texte truncate">{autreNom}</h1>
            {conversation && (
              <BadgeStatut statut={conversation.type} registre={STATUTS_CONVERSATION} taille="sm" />
            )}
          </div>
          <p className={`text-xs ${indicateurConnexion.classe}`} data-testid="indicateur-connexion">
            {indicateurConnexion.libelle}
          </p>
        </div>
        {autreId && (
          <Bouton
            type="button"
            variante="discret"
            taille="sm"
            onClick={() => void basculerBlocage()}
            iconeGauche={<Ban size={16} aria-hidden="true" />}
            data-testid={bloque ? 'bouton-debloquer' : 'bouton-bloquer'}
          >
            {bloque ? TEXTES_CHAT.debloquer : TEXTES_CHAT.bloquer}
          </Bouton>
        )}
      </div>

      {requeteConversation.isError && (
        <EtatErreur
          message={messageErreurConversations(requeteConversation.error)}
          surReessayer={() => requeteConversation.refetch()}
        />
      )}

      {/* Fil */}
      <div ref={filRef} className="flex-1 overflow-y-auto py-4 space-y-3 min-h-[240px]">
        {sante && <EtatChargement message="Chargement des messages…" />}
        {requeteMessages.isError && (
          <EtatErreur
            message={messageErreurConversations(requeteMessages.error)}
            surReessayer={() => requeteMessages.refetch()}
          />
        )}

        {!sante && messages.length > 0 && !finHistorique && (
          <div className="flex justify-center">
            <Bouton
              type="button"
              variante="discret"
              taille="sm"
              onClick={() => void chargerPlusAnciens()}
              disabled={chargementAncien}
              data-testid="bouton-charger-anciens"
            >
              {chargementAncien ? 'Chargement…' : TEXTES_CHAT.chargerPlus}
            </Bouton>
          </div>
        )}

        {messages.map((message, index) => {
          const estMien = message.auteur === utilisateur?.id;
          const lu = estMien && indexLu >= 0 && index <= indexLu;
          return (
            <div
              key={message.id}
              className={`flex ${estMien ? 'justify-end' : 'justify-start'}`}
              data-testid={`message-${message.id}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                  estMien ? 'bg-primaire text-white' : 'bg-surface border border-bordure text-texte'
                }`}
              >
                {/* Texte brut rendu échappé : jamais de HTML injecté (PW-F13-04). */}
                {message.contenu && (
                  <p className="text-sm whitespace-pre-wrap break-words">{message.contenu}</p>
                )}
                {message.fichier && <PieceJointe fichier={message.fichier} />}
                <div
                  className={`flex items-center gap-1 mt-1 text-[10px] ${
                    estMien ? 'text-white/80 justify-end' : 'text-texte-muet'
                  }`}
                >
                  <span>{heureLisible(message.cree_le)}</span>
                  {estMien &&
                    (lu ? (
                      <span
                        className="inline-flex items-center gap-0.5"
                        data-testid={`recu-lu-${message.id}`}
                      >
                        <CheckCheck size={12} aria-hidden="true" /> {TEXTES_CHAT.lu}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5">
                        <Check size={12} aria-hidden="true" /> {TEXTES_CHAT.envoye}
                      </span>
                    ))}
                  {!estMien && (
                    <button
                      type="button"
                      onClick={() => setSignalementId(message.id)}
                      className="inline-flex items-center gap-0.5 hover:text-erreur"
                      aria-label={TEXTES_CHAT.signaler}
                      data-testid={`bouton-signaler-${message.id}`}
                    >
                      <Flag size={11} aria-hidden="true" /> {TEXTES_CHAT.signaler}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Messages en file d'attente (hors ligne) — renvoyés une seule fois. */}
        {enAttente.map((item) => (
          <div key={item.corps.id_client} className="flex justify-end">
            <div className="max-w-[80%] rounded-2xl px-3 py-2 bg-surface-survol border border-dashed border-bordure text-texte-secondaire">
              <p className="text-sm whitespace-pre-wrap break-words">
                {item.corps.contenu ?? TEXTES_CHAT.pieceJointe}
              </p>
              <span
                className="inline-flex items-center gap-1 mt-1 text-[10px]"
                data-testid="message-en-attente"
              >
                <Loader2 size={11} className="animate-spin" aria-hidden="true" />
                {TEXTES_CHAT.enAttente}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Composeur */}
      <div className="pt-3 border-t border-bordure flex flex-col gap-2">
        {bloque ? (
          <p className="text-sm text-erreur" data-testid="avertissement-blocage">
            {messageErreurConversations(new ErreurApi('blocage_actif', '', 403))}
          </p>
        ) : (
          <>
            {fichierApi && (
              <div className="flex items-center gap-2 text-xs text-texte-secondaire">
                <Paperclip size={12} aria-hidden="true" />
                <span className="truncate max-w-[200px]">{fichierApi.nom_original}</span>
                <button
                  type="button"
                  onClick={() => {
                    setFichierId(null);
                    setFichierApi(null);
                  }}
                  className="text-erreur"
                >
                  Retirer
                </button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                value={texte}
                onChange={(evement) => setTexte(evement.target.value)}
                onKeyDown={(evement) => {
                  if (evement.key === 'Enter' && !evement.shiftKey) {
                    evement.preventDefault();
                    void envoyer();
                  }
                }}
                rows={1}
                placeholder={TEXTES_CHAT.ecrireMessage}
                aria-label={TEXTES_CHAT.ecrireMessage}
                className="flex-1 resize-none rounded-lg border border-bordure bg-surface px-3 py-2 text-sm text-texte focus:outline-none focus:ring-2 focus:ring-primaire"
                data-testid="champ-message"
              />
              <Bouton
                type="button"
                variante="secondaire"
                onClick={() => void envoyer()}
                disabled={envoiEnCours || (!texte.trim() && !fichierId)}
                iconeGauche={<Send size={18} aria-hidden="true" />}
                data-testid="bouton-envoyer-message"
              >
                {TEXTES_CHAT.envoyer}
              </Bouton>
            </div>
            <TeleversementFichier
              contexte="chat"
              limiteImageMo={5}
              limiteDocumentMo={10}
              accept="image/jpeg,image/png,image/webp,application/pdf"
              libelle={TEXTES_CHAT.joindre}
              onTeleverse={(fichier) => {
                setFichierId(fichier.id);
                setFichierApi(fichier);
              }}
            />
          </>
        )}
      </div>

      <DialogueConfirmation
        ouvert={signalementId !== null}
        titre={TEXTES_CHAT.signaler}
        message="Signaler ce message à la modération AgriSens ?"
        texteConfirmer={MESSAGES.confirmer}
        danger
        surConfirmer={() => void confirmerSignalement()}
        surAnnuler={() => setSignalementId(null)}
      />
    </div>
  );
};
