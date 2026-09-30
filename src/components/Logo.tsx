import React from 'react';

interface LogoProps {
  taille?: 'sm' | 'md' | 'lg' | 'xl';
  inverse?: boolean; // Blanc pour fond sombre
  avecSousTitre?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  taille = 'md',
  inverse = false,
  avecSousTitre = false,
}) => {
  const classesTaille = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-4xl',
  }[taille];

  return (
    <div className="flex flex-col items-start leading-none select-none">
      <div className={`font-bold tracking-tight ${classesTaille}`}>
        <span className={inverse ? 'text-white' : 'text-primaire'}>Agri</span>
        <span className={inverse ? 'text-primaire-claire' : 'text-secondaire'}>Sens</span>
      </div>
      {avecSousTitre && (
        <span
          className={`text-xs mt-1 font-medium ${
            inverse ? 'text-slate-300' : 'text-texte-secondaire'
          }`}
        >
          Cameroun
        </span>
      )}
    </div>
  );
};
