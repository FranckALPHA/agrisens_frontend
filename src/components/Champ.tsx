import React, { InputHTMLAttributes, forwardRef, useId } from 'react';

export interface ChampProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  aide?: string;
  erreur?: string;
  iconeGauche?: React.ReactNode;
  iconeDroite?: React.ReactNode;
}

export const Champ = forwardRef<HTMLInputElement, ChampProps>(
  (
    {
      label,
      aide,
      erreur,
      iconeGauche,
      iconeDroite,
      id: idProp,
      className = '',
      type = 'text',
      ...props
    },
    ref
  ) => {
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

        <div className="relative flex items-center">
          {iconeGauche && (
            <div className="absolute left-3 pointer-events-none text-texte-muet flex items-center">
              {iconeGauche}
            </div>
          )}

          <input
            ref={ref}
            id={id}
            type={type}
            aria-invalid={Boolean(erreur)}
            aria-describedby={[idAide, idErreur].filter(Boolean).join(' ') || undefined}
            className={`
              w-full min-h-tactile px-3 py-2 text-base rounded-md border bg-surface text-texte
              transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1
              ${iconeGauche ? 'pl-10' : ''}
              ${iconeDroite ? 'pr-10' : ''}
              ${
                erreur
                  ? 'border-erreur focus:ring-erreur text-erreur-texte'
                  : 'border-bordure focus:border-primaire focus:ring-primaire'
              }
              disabled:bg-surface-survol disabled:opacity-60 disabled:cursor-not-allowed
              ${className}
            `}
            {...props}
          />

          {iconeDroite && (
            <div className="absolute right-3 flex items-center text-texte-muet">{iconeDroite}</div>
          )}
        </div>

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

Champ.displayName = 'Champ';
