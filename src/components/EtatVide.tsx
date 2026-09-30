import React from 'react';
import { PackageOpen } from 'lucide-react';
import { MESSAGES } from '@/theme/messages';

export interface EtatVideProps {
  titre?: string;
  message?: string;
  icone?: React.ReactNode;
  action?: React.ReactNode;
  pleinePage?: boolean;
  className?: string;
}

export const EtatVide: React.FC<EtatVideProps> = ({
  titre = MESSAGES.aucunResultat,
  message = MESSAGES.listePlate,
  icone,
  action,
  pleinePage = false,
  className = '',
}) => {
  const contenu = (
    <div
      data-testid="etat-vide"
      className={`flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto ${className}`}
    >
      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-texte-muet mb-4">
        {icone || <PackageOpen size={32} aria-hidden="true" />}
      </div>
      <h3 className="text-lg font-bold text-texte mb-1">{titre}</h3>
      <p className="text-sm text-texte-secondaire leading-relaxed mb-6">{message}</p>
      {action && <div className="flex items-center justify-center">{action}</div>}
    </div>
  );

  if (pleinePage) {
    return <div className="min-h-[50vh] flex items-center justify-center">{contenu}</div>;
  }

  return contenu;
};
