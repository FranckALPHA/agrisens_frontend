import React, { useEffect, useRef } from 'react';
import { Bouton } from './Bouton';
import { MESSAGES } from '@/theme/messages';

export interface DialogueConfirmationProps {
  ouvert: boolean;
  titre: string;
  message: string;
  texteConfirmer?: string;
  texteAnnuler?: string;
  danger?: boolean;
  chargement?: boolean;
  surConfirmer: () => void;
  surAnnuler: () => void;
}

export const DialogueConfirmation: React.FC<DialogueConfirmationProps> = ({
  ouvert,
  titre,
  message,
  texteConfirmer = MESSAGES.confirmer,
  texteAnnuler = MESSAGES.annuler,
  danger = false,
  chargement = false,
  surConfirmer,
  surAnnuler,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const boutonConfirmerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!ouvert) return;

    // Fermeture avec la touche Échap
    const gererTouche = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !chargement) {
        surAnnuler();
      }
    };

    window.addEventListener('keydown', gererTouche);
    // Focus sur le bouton de confirmation à l'ouverture
    setTimeout(() => boutonConfirmerRef.current?.focus(), 50);

    return () => window.removeEventListener('keydown', gererTouche);
  }, [ouvert, chargement, surAnnuler]);

  if (!ouvert) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !chargement) {
          surAnnuler();
        }
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialogue-titre"
        aria-describedby="dialogue-message"
        className="w-full max-w-md p-6 bg-surface rounded-lg shadow-lg border border-bordure animate-in fade-in zoom-in-95 duration-150"
      >
        <h2 id="dialogue-titre" className="text-xl font-bold text-texte">
          {titre}
        </h2>
        <p id="dialogue-message" className="mt-3 text-sm text-texte-secondaire leading-relaxed">
          {message}
        </p>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Bouton type="button" variante="secondaire" onClick={surAnnuler} disabled={chargement}>
            {texteAnnuler}
          </Bouton>
          <Bouton
            ref={boutonConfirmerRef}
            type="button"
            variante={danger ? 'danger' : 'primaire'}
            chargement={chargement}
            onClick={surConfirmer}
          >
            {texteConfirmer}
          </Bouton>
        </div>
      </div>
    </div>
  );
};
