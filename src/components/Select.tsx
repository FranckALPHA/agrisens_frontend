import { SelectHTMLAttributes, forwardRef, useId } from 'react';

export interface OptionSelect {
  valeur: string;
  libelle: string;
  desactive?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: OptionSelect[];
  placeholder?: string;
  aide?: string;
  erreur?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, placeholder, aide, erreur, id: idProp, className = '', ...props }, ref) => {
    const idGenere = useId();
    const id = idProp || idGenere;
    const idAide = aide ? `${id}-aide` : undefined;
    const idErreur = erreur ? `${id}-erreur` : undefined;

    return (
      <div className="flex flex-col gap-1 w-full">
        <label htmlFor={id} className="text-sm font-medium text-texte">
          {label}
          {props.required && (
            <span className="text-erreur ml-1" aria-hidden="true">
              *
            </span>
          )}
        </label>

        <select
          ref={ref}
          id={id}
          aria-invalid={Boolean(erreur)}
          aria-describedby={[idAide, idErreur].filter(Boolean).join(' ') || undefined}
          className={`
            w-full min-h-tactile px-3 py-2 text-base rounded-md border bg-surface text-texte
            transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1
            ${
              erreur
                ? 'border-erreur focus:ring-erreur'
                : 'border-bordure focus:border-primaire focus:ring-primaire'
            }
            disabled:bg-surface-survol disabled:opacity-60 disabled:cursor-not-allowed
            ${className}
          `}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.valeur} value={opt.valeur} disabled={opt.desactive}>
              {opt.libelle}
            </option>
          ))}
        </select>

        {aide && !erreur && (
          <p id={idAide} className="text-xs text-texte-secondaire mt-0.5">
            {aide}
          </p>
        )}

        {erreur && (
          <p id={idErreur} className="text-xs text-erreur font-medium mt-0.5" role="alert">
            {erreur}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
