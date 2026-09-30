import React from 'react';
import { Sprout, ShoppingBag, Truck, GraduationCap, ShieldCheck, ArrowRight } from 'lucide-react';
import { Bouton } from '@/components/Bouton';
import { MESSAGES } from '@/theme/messages';

export const PageAccueil: React.FC = () => {
  return (
    <div className="flex flex-col gap-16 py-6 sm:py-12">
      {/* 1. Bannière d'accueil (Hero) */}
      <section className="text-center max-w-4xl mx-auto flex flex-col items-center gap-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primaire-douce text-primaire text-xs font-semibold uppercase tracking-wider">
          <Sprout size={14} aria-hidden="true" />
          Agriculture & Logistique au Cameroun
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold text-texte tracking-tight leading-tight">
          La plateforme agricole moderne pour le Cameroun
        </h1>

        <p className="text-base sm:text-xl text-texte-secondaire leading-relaxed max-w-2xl">
          AgriSens met en relation directe producteurs, acheteurs, ingénieurs agronomes et livreurs.
          Des produits frais, un paiement Mobile Money sécurisé et une logistique tracée de bout en
          bout.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 mt-2">
          <Bouton
            to="/catalogue"
            variante="primaire"
            taille="lg"
            iconeDroite={<ArrowRight size={20} aria-hidden="true" />}
          >
            {MESSAGES.voirCatalogue}
          </Bouton>
          <Bouton to="/inscription" variante="secondaire" taille="lg">
            {MESSAGES.inscription}
          </Bouton>
        </div>
      </section>

      {/* 2. Les acteurs de la plateforme */}
      <section className="border-t border-bordure pt-12">
        <h2 className="text-2xl sm:text-3xl font-bold text-center text-texte mb-10">
          Une solution sur mesure pour chaque acteur
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 rounded-xl border border-bordure bg-surface shadow-sm flex flex-col items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Sprout size={24} aria-hidden="true" />
            </div>
            <h3 className="text-lg font-bold text-texte">Agriculteurs</h3>
            <p className="text-sm text-texte-secondaire leading-relaxed">
              Vendez vos récoltes au juste prix, gérez vos parcelles et bénéficiez de conseils
              agronomiques.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-bordure bg-surface shadow-sm flex flex-col items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center">
              <ShoppingBag size={24} aria-hidden="true" />
            </div>
            <h3 className="text-lg font-bold text-texte">Acheteurs</h3>
            <p className="text-sm text-texte-secondaire leading-relaxed">
              Commandez des produits locaux frais directement auprès des producteurs avec livraison
              à domicile.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-bordure bg-surface shadow-sm flex flex-col items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <GraduationCap size={24} aria-hidden="true" />
            </div>
            <h3 className="text-lg font-bold text-texte">Ingénieurs</h3>
            <p className="text-sm text-texte-secondaire leading-relaxed">
              Accompagnez les exploitations, proposez vos expertises sur le terrain et suivez vos
              recommandations.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-bordure bg-surface shadow-sm flex flex-col items-start gap-4">
            <div className="w-12 h-12 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
              <Truck size={24} aria-hidden="true" />
            </div>
            <h3 className="text-lg font-bold text-texte">Livreurs</h3>
            <p className="text-sm text-texte-secondaire leading-relaxed">
              Prenez en charge les livraisons proches de vous et sécurisez la remise grâce au code
              unique.
            </p>
          </div>
        </div>
      </section>

      {/* 3. Confiance et garanties */}
      <section className="bg-slate-50 border border-bordure rounded-2xl p-8 sm:p-12 text-center max-w-4xl mx-auto flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center">
          <ShieldCheck size={28} aria-hidden="true" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-texte">
          Transparence et sécurité intégrées
        </h2>
        <p className="text-sm sm:text-base text-texte-secondaire max-w-xl leading-relaxed">
          Paiement sécurisé par Mobile Money camerounais (Orange Money & MTN Mobile Money via
          NotchPay), livraison contrôlée par code à 6 chiffres et accompagnement agronomique
          certifié.
        </p>
      </section>
    </div>
  );
};
