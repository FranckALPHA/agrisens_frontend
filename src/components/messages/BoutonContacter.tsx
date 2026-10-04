import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { Bouton } from '@/components/Bouton';
import { useToast } from '@/components/Toast';
import { creerConversation, messageErreurConversations } from '@/services/api/conversations';

/**
 * Bouton « Contacter » (F-13) — ouvre/obtient la conversation de la relation
 * puis navigue vers le fil. Posé sur la fiche commande (acheteur et vendeur)
 * et la fiche accompagnement (agriculteur et ingénieur). L'API refuse un
 * non-partie par un 404 (message clair, PW-F13-07).
 */
export interface BoutonContacterProps {
  commandeId?: string;
  accompagnementId?: string;
  libelle?: string;
  variante?: 'primaire' | 'secondaire' | 'danger' | 'discret' | 'lien';
}

export const BoutonContacter: React.FC<BoutonContacterProps> = ({
  commandeId,
  accompagnementId,
  libelle = 'Contacter',
  variante = 'secondaire',
}) => {
  const navigate = useNavigate();
  const { afficherToast } = useToast();
  const [enCours, setEnCours] = useState(false);

  const rattachement = commandeId
    ? { commande_id: commandeId }
    : accompagnementId
      ? { accompagnement_id: accompagnementId }
      : null;

  if (!rattachement) return null;

  const ouvrir = async () => {
    setEnCours(true);
    try {
      const conversation = await creerConversation(rattachement);
      navigate(`/messages/${conversation.id}`);
    } catch (erreur) {
      afficherToast(messageErreurConversations(erreur), 'erreur');
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Bouton
      type="button"
      variante={variante}
      onClick={() => void ouvrir()}
      disabled={enCours}
      chargement={enCours}
      iconeGauche={<MessageCircle size={18} aria-hidden="true" />}
      data-testid="bouton-contacter"
    >
      {libelle}
    </Bouton>
  );
};
