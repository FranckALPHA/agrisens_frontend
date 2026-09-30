import React from 'react';
import { MESSAGES } from '@/theme/messages';

export interface EtatChargementProps {
  message?: string;
  pleinePage?: boolean;
  className?: string;
}

export const EtatChargement: React.FC<EtatChargementProps> = ({
  message = MESSAGES.chargement,
  pleinePage = false,
  className = '',
}) => {
  const contenu = (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center p-8 gap-3 text-texte-secondaire ${className}`}
    >
      <div className="relative w-10 h-10">
        <svg
          className="animate-spin w-10 h-10 text-primaire"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-20"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            className="opacity-80"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
      <p className="text-sm font-medium text-texte-secondaire">{message}</p>
      <span className="sr-only">{message}</span>
    </div>
  );

  if (pleinePage) {
    return <div className="min-h-[60vh] flex items-center justify-center">{contenu}</div>;
  }

  return contenu;
};
