import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, ChevronRight } from 'lucide-react';
import { BadgeStatut } from '@/components/BadgeStatut';
import { EtatChargement } from '@/components/EtatChargement';
import { EtatErreur } from '@/components/EtatErreur';
import { EtatVide } from '@/components/EtatVide';
import { listerConversations, messageErreurConversations } from '@/services/api/conversations';
import { STATUTS_CONVERSATION } from '@/theme/statuts';
import { TEXTES_CHAT } from '@/theme/messages';

/**
 * Page F-13 — liste des conversations (message.list). Le badge rouge indique
 * les non-lus ; la ligne résume l'autre participant, le type de relation et le
 * dernier message. Un clic ouvre le fil (empilé sur mobile, PW-F13-08).
 */

function relativeDepuis(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;
  return `il y a ${Math.floor(heures / 24)} j`;
}

export const PageConversations: React.FC = () => {
  const navigate = useNavigate();
  const requete = useQuery({
    queryKey: ['conversations'],
    queryFn: listerConversations,
  });

  const conversations = requete.data?.elements ?? [];

  return (
    <div className="py-6 flex flex-col gap-4" data-testid="page-conversations">
      <div>
        <h1 className="text-xl font-bold text-texte">{TEXTES_CHAT.titreMessages}</h1>
        <p className="text-sm text-texte-secondaire">{TEXTES_CHAT.sousTitreMessages}</p>
      </div>

      {requete.isLoading && <EtatChargement message="Chargement des conversations…" />}
      {requete.isError && (
        <EtatErreur
          message={messageErreurConversations(requete.error)}
          surReessayer={() => requete.refetch()}
        />
      )}

      {!requete.isLoading && !requete.isError && conversations.length === 0 && (
        <EtatVide
          titre={TEXTES_CHAT.aucuneConversation}
          message={TEXTES_CHAT.aucuneConversationMessage}
        />
      )}

      <ul className="flex flex-col gap-2">
        {conversations.map((conversation) => {
          const nom = conversation.autre_participant?.nom ?? 'Conversation';
          const apercu =
            conversation.dernier_message?.contenu ??
            (conversation.dernier_message?.fichier ? TEXTES_CHAT.pieceJointe : '');
          const horodatage =
            conversation.dernier_message?.cree_le ?? conversation.maj_le ?? conversation.cree_le;
          return (
            <li key={conversation.id}>
              <button
                type="button"
                onClick={() => navigate(`/messages/${conversation.id}`)}
                className="w-full text-left p-4 rounded-lg border border-bordure bg-surface hover:bg-surface-survol transition-colors flex items-center gap-3"
                data-testid={`conversation-${conversation.id}`}
              >
                <div className="w-10 h-10 rounded-full bg-primaire-claire text-white flex items-center justify-center shrink-0">
                  <MessageCircle size={18} aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-texte truncate">{nom}</p>
                    <BadgeStatut
                      statut={conversation.type}
                      registre={STATUTS_CONVERSATION}
                      taille="sm"
                    />
                    {conversation.non_lus > 0 && (
                      <span
                        className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-erreur text-white text-[11px] font-bold flex items-center justify-center"
                        data-testid={`badge-non-lus-${conversation.id}`}
                        aria-label={`${conversation.non_lus} non lus`}
                      >
                        {conversation.non_lus}
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-sm mt-0.5 truncate ${
                      conversation.non_lus > 0 ? 'text-texte font-medium' : 'text-texte-secondaire'
                    }`}
                  >
                    {apercu || '—'}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0 text-texte-muet">
                  <span className="text-[11px] hidden sm:inline">{relativeDepuis(horodatage)}</span>
                  <ChevronRight size={16} aria-hidden="true" />
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
