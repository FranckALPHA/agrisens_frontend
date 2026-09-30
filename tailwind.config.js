/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primaire: {
          DEFAULT: 'var(--couleur-primaire)',
          sombre: 'var(--couleur-primaire-sombre)',
          claire: 'var(--couleur-primaire-claire)',
          douce: 'var(--couleur-primaire-douce)',
          texte: 'var(--couleur-primaire-texte)',
        },
        secondaire: {
          DEFAULT: 'var(--couleur-secondaire)',
          claire: 'var(--couleur-secondaire-claire)',
          sombre: 'var(--couleur-secondaire-sombre)',
        },
        succes: {
          DEFAULT: 'var(--couleur-succes)',
          fond: 'var(--couleur-succes-fond)',
          texte: 'var(--couleur-succes-texte)',
        },
        erreur: {
          DEFAULT: 'var(--couleur-erreur)',
          fond: 'var(--couleur-erreur-fond)',
          texte: 'var(--couleur-erreur-texte)',
        },
        avertissement: {
          DEFAULT: 'var(--couleur-avertissement)',
          fond: 'var(--couleur-avertissement-fond)',
          texte: 'var(--couleur-avertissement-texte)',
        },
        info: {
          DEFAULT: 'var(--couleur-info)',
          fond: 'var(--couleur-info-fond)',
          texte: 'var(--couleur-info-texte)',
        },
        fond: 'var(--couleur-fond)',
        surface: {
          DEFAULT: 'var(--couleur-surface)',
          survol: 'var(--couleur-surface-survol)',
        },
        bordure: {
          DEFAULT: 'var(--couleur-bordure)',
          forte: 'var(--couleur-bordure-forte)',
        },
        texte: {
          DEFAULT: 'var(--couleur-texte)',
          secondaire: 'var(--couleur-texte-secondaire)',
          muet: 'var(--couleur-texte-muet)',
        },
      },
      fontFamily: {
        sans: ['var(--police-principale)', 'sans-serif'],
        mono: ['var(--police-mono)', 'monospace'],
      },
      borderRadius: {
        sm: 'var(--rayon-sm)',
        md: 'var(--rayon-md)',
        lg: 'var(--rayon-lg)',
        xl: 'var(--rayon-xl)',
        full: 'var(--rayon-plein)',
      },
      boxShadow: {
        sm: 'var(--ombre-sm)',
        md: 'var(--ombre-md)',
        lg: 'var(--ombre-lg)',
      },
      minHeight: {
        tactile: 'var(--taille-tactile-min)',
      },
      minWidth: {
        tactile: 'var(--taille-tactile-min)',
      },
    },
  },
  plugins: [],
};
