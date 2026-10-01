import React, { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { chargerContenuFichier } from '@/services/api/fichiers';

/** Affiche une photo de produit via l'URL signée (publique au catalogue). */
export const PhotoProduit: React.FC<{
  fichierId: string;
  alt: string;
  className?: string;
}> = ({ fichierId, alt, className = 'h-40 w-full object-cover' }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [echec, setEchec] = useState(false);

  useEffect(() => {
    let actif = true;
    let objetUrl: string | null = null;
    setUrl(null);
    setEchec(false);
    void chargerContenuFichier(fichierId)
      .then((blob) => {
        if (!actif) return;
        if (blob) {
          objetUrl = URL.createObjectURL(blob);
          setUrl(objetUrl);
        } else {
          setEchec(true);
        }
      })
      .catch(() => {
        if (actif) setEchec(true);
      });
    return () => {
      actif = false;
      if (objetUrl) URL.revokeObjectURL(objetUrl);
    };
  }, [fichierId]);

  if (echec || url === null) {
    return (
      <div
        className={`flex items-center justify-center bg-surface-survol text-texte-muet ${className}`}
        role="img"
        aria-label={echec ? 'Photo indisponible' : 'Chargement de la photo…'}
      >
        <ImageOff size={28} aria-hidden="true" />
      </div>
    );
  }
  return <img src={url} alt={alt} className={className} loading="lazy" />;
};
