import React from 'react';
import { FileQuestion, ArrowLeft } from 'lucide-react';
import { Bouton } from '@/components/Bouton';
import { MESSAGES } from '@/theme/messages';

export const Page404: React.FC = () => {
  return (
    <div
      role="alert"
      data-testid="page-404"
      className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center max-w-lg mx-auto"
    >
      <div className="w-20 h-20 rounded-full bg-slate-100 text-texte-secondaire flex items-center justify-center mb-6">
        <FileQuestion size={40} aria-hidden="true" />
      </div>

      <span className="text-sm font-bold uppercase tracking-wider text-primaire mb-2">
        Erreur 404
      </span>

      <h1 className="text-3xl sm:text-4xl font-extrabold text-texte mb-3">
        {MESSAGES.pageIntrouvableTitre}
      </h1>

      <p className="text-base text-texte-secondaire leading-relaxed max-w-md mb-8">
        {MESSAGES.pageIntrouvableDescription}
      </p>

      <Bouton
        to="/"
        variante="primaire"
        taille="lg"
        iconeGauche={<ArrowLeft size={20} aria-hidden="true" />}
      >
        {MESSAGES.retourAccueil}
      </Bouton>
    </div>
  );
};
