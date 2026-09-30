import { InputHTMLAttributes, forwardRef, useId } from 'react';
import { Search, X } from 'lucide-react';

export interface ChampRechercheProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  surEffacer?: () => void;
}

export const ChampRecherche = forwardRef<HTMLInputElement, ChampRechercheProps>(
  ({ label = 'Rechercher', surEffacer, value, onChange, className = '', ...props }, ref) => {
    const id = useId();
    const aValeur = Boolean(value && String(value).length > 0);

    return (
      <div className="relative flex items-center w-full">
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <div className="absolute left-3 pointer-events-none text-texte-muet flex items-center">
          <Search size={18} aria-hidden="true" />
        </div>
        <input
          ref={ref}
          id={id}
          type="search"
          role="searchbox"
          value={value}
          onChange={onChange}
          placeholder={props.placeholder || label}
          className={`
            w-full min-h-tactile pl-10 pr-10 py-2 text-base rounded-md border border-bordure bg-surface text-texte
            transition-colors focus:outline-none focus:border-primaire focus:ring-2 focus:ring-primaire
            disabled:bg-surface-survol disabled:opacity-60
            ${className}
          `}
          {...props}
        />
        {aValeur && surEffacer && (
          <button
            type="button"
            onClick={surEffacer}
            aria-label="Effacer la recherche"
            className="absolute right-2 p-1.5 rounded-full text-texte-muet hover:text-texte hover:bg-surface-survol focus:outline-none focus:ring-2 focus:ring-primaire"
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>
    );
  }
);

ChampRecherche.displayName = 'ChampRecherche';
