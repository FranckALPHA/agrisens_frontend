import { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react';
import { Link } from 'react-router-dom';

export type VarianteBouton = 'primaire' | 'secondaire' | 'danger' | 'discret' | 'lien';
export type TailleBouton = 'sm' | 'md' | 'lg';

export interface BoutonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBouton;
  taille?: TailleBouton;
  chargement?: boolean;
  pleineLargeur?: boolean;
  iconeGauche?: ReactNode;
  iconeDroite?: ReactNode;
  to?: string;
}

export const Bouton = forwardRef<HTMLButtonElement, BoutonProps>(
  (
    {
      children,
      variante = 'primaire',
      taille = 'md',
      chargement = false,
      pleineLargeur = false,
      disabled,
      iconeGauche,
      iconeDroite,
      to,
      className = '',
      ...props
    },
    ref
  ) => {
    const stylesBase =
      'inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none min-h-tactile';

    const stylesVariante: Record<VarianteBouton, string> = {
      primaire:
        'bg-primaire text-primaire-texte hover:bg-primaire-sombre focus:ring-primaire border border-transparent shadow-sm',
      secondaire:
        'bg-surface text-texte hover:bg-surface-survol focus:ring-primaire border border-bordure shadow-sm',
      danger:
        'bg-erreur text-white hover:bg-red-700 focus:ring-erreur border border-transparent shadow-sm',
      discret:
        'bg-transparent text-texte-secondaire hover:bg-surface-survol focus:ring-primaire border border-transparent',
      lien: 'bg-transparent text-primaire hover:underline focus:ring-primaire p-0 min-h-0 h-auto',
    };

    const stylesTaille: Record<TailleBouton, string> = {
      sm: 'text-sm px-3 py-1.5 gap-1.5',
      md: 'text-base px-4 py-2 gap-2',
      lg: 'text-lg px-6 py-3 gap-2.5',
    };

    const tailleClasses = variante === 'lien' ? '' : stylesTaille[taille];
    const largeurClass = pleineLargeur ? 'w-full' : '';
    const classesFinales = `${stylesBase} ${stylesVariante[variante]} ${tailleClasses} ${largeurClass} ${className}`;

    const spinner = chargement && (
      <svg
        className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    );

    if (to) {
      return (
        <Link to={to} className={classesFinales}>
          {spinner}
          {!chargement && iconeGauche && (
            <span className="inline-flex shrink-0">{iconeGauche}</span>
          )}
          <span>{children}</span>
          {!chargement && iconeDroite && (
            <span className="inline-flex shrink-0">{iconeDroite}</span>
          )}
        </Link>
      );
    }

    return (
      <button ref={ref} disabled={disabled || chargement} className={classesFinales} {...props}>
        {spinner}
        {!chargement && iconeGauche && <span className="inline-flex shrink-0">{iconeGauche}</span>}
        <span>{children}</span>
        {!chargement && iconeDroite && <span className="inline-flex shrink-0">{iconeDroite}</span>}
      </button>
    );
  }
);

Bouton.displayName = 'Bouton';
