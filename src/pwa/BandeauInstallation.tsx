/**
 * Bandeau d'invitation à l'installation PWA (F-15, SPEC-12 §4).
 * - Android / Desktop : capture du `beforeinstallprompt` natif.
 * - iOS : instructions manuelles (Partager → Sur l'écran d'accueil).
 */

import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { Bouton } from '@/components/Bouton';
import { MESSAGES } from '@/theme/messages';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function estIOS(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function estDejaInstallee(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

const CLE_REJETEE = 'agrisens:installation-rejetee';

export const BandeauInstallation: React.FC = () => {
  const [evenement, setEvenement] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [iosMode, setIosMode] = useState(false);

  useEffect(() => {
    if (estDejaInstallee() || sessionStorage.getItem(CLE_REJETEE)) return;

    if (estIOS()) {
      setIosMode(true);
      setVisible(true);
      return;
    }

    const capteur = (e: Event) => {
      e.preventDefault();
      setEvenement(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', capteur);

    // Si l'événement est déjà passé (Chrome le déclenche une fois) :
    if ((window as unknown as { __deferredPrompt?: BeforeInstallPromptEvent }).__deferredPrompt) {
      setEvenement(
        (window as unknown as { __deferredPrompt: BeforeInstallPromptEvent }).__deferredPrompt!
      );
      setVisible(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', capteur);
  }, []);

  const installer = async () => {
    if (!evenement) return;
    await evenement.prompt();
    const { outcome } = await evenement.userChoice;
    if (outcome === 'accepted') setVisible(false);
    setEvenement(null);
  };

  const rejeter = () => {
    setVisible(false);
    sessionStorage.setItem(CLE_REJETEE, '1');
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label={MESSAGES.titreInstallation}
      data-testid="bandeau-installation"
      className="fixed bottom-20 left-4 right-4 md:right-auto md:w-96 z-50 p-4 rounded-xl bg-surface border border-bordure shadow-lg flex items-start gap-3"
    >
      <Download size={24} className="text-primaire shrink-0 mt-1" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-texte">{MESSAGES.titreInstallation}</p>
        {iosMode ? (
          <p className="text-xs text-texte-secondaire mt-1">{MESSAGES.instructionIOS}</p>
        ) : (
          <p className="text-xs text-texte-secondaire mt-1">{MESSAGES.sousTitreInstallation}</p>
        )}
        {!iosMode && (
          <div className="flex gap-2 mt-3">
            <Bouton taille="sm" variante="primaire" onClick={installer}>
              {MESSAGES.installer}
            </Bouton>
            <Bouton taille="sm" variante="discret" onClick={rejeter}>
              {MESSAGES.plusTard}
            </Bouton>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={rejeter}
        aria-label="Fermer"
        className="p-1 rounded text-texte-muet hover:text-texte"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
};
