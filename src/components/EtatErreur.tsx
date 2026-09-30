import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Bouton } from './Bouton';
import { MESSAGES } from '@/theme/messages';

export interface EtatErreurProps {
  titre?: string;
  message?: string;
  surReessayer?: () => void;
  pleinePage?: boolean;
  chargement?: boolean;
  className?: string;
}

export const EtatErreur: React.FC<EtatErreurProps> = ({
  titre = 'Une erreur est survenue',
  message = MESSAGES.erreurInconnue,
  surReessayer,
  pleinePage = false,
  chargement = false,
  className = '',
}) => {
  const contenu = (
    <div
      role="alert"
      data-testid="etat-erreur"
      className={`flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto rounded-lg border border-red-200 bg-erreur-fond/30 ${className}`}
    >
      <div className="w-14 h-14 rounded-full bg-erreur-fond flex items-center justify-center text-erreur mb-4">
        <AlertTriangle size={28} aria-hidden="true" />
      </div>
      <h3 className="text-lg font-bold text-erreur-texte mb-1.5">{titre}</h3>
      <p className="text-sm text-texte-secondaire leading-relaxed mb-6">{message}</p>

      {surReessayer && (
        <Bouton
          type="button"
          variante="secondaire"
          onClick={surReessayer}
          chargement={chargement}
          iconeGauche={<RefreshCw size={16} aria-hidden="true" />}
        >
          {MESSAGES.reessayer}
        </Bouton>
      )}
    </div>
  );

  if (pleinePage) {
    return <div className="min-h-[50vh] flex items-center justify-center">{contenu}</div>;
  }

  return contenu;
};
