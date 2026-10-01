/**
 * Utilitaires d'envoi de fichiers (prompt F-03 frontend point 1) :
 * compression côté navigateur et messages d'erreur lisibles des codes du
 * backend. Séparés du composant pour respecter la règle react-refresh
 * (un fichier .tsx d composants uniquement).
 */

import { CODE_ERREUR_RESEAU } from '@/services/api/auth';
import { MESSAGES } from '@/theme/messages';

/** Réduction côté navigateur : renvoie un JPEG compressé si l'image dépasse la limite. */
export async function compresserImage(fichier: File, limiteMo: number): Promise<File> {
  if (!fichier.type.startsWith('image/')) return fichier;
  if (fichier.size <= limiteMo * 1024 * 1024) return fichier;
  try {
    const url = URL.createObjectURL(fichier);
    try {
      const image = new window.Image();
      await new Promise<void>((resoudre, rejeter) => {
        image.onload = () => resoudre();
        image.onerror = () => rejeter(new Error('image illisible'));
        image.src = url;
      });
      // Diviser par 2 la taille jusqu'à passer sous la limite (3 essais max).
      let largeur = image.naturalWidth;
      let hauteur = image.naturalHeight;
      let blob: Blob | null = null;
      for (let essai = 0; essai < 3; essai += 1) {
        const toile = document.createElement('canvas');
        toile.width = Math.max(1, largeur);
        toile.height = Math.max(1, hauteur);
        const contexte = toile.getContext('2d');
        if (!contexte) break;
        contexte.drawImage(image, 0, 0, toile.width, toile.height);
        blob = await new Promise<Blob | null>((resoudre) =>
          toile.toBlob((b) => resoudre(b), 'image/jpeg', 0.85)
        );
        if (blob && blob.size <= limiteMo * 1024 * 1024) break;
        largeur = Math.floor(largeur / 2);
        hauteur = Math.floor(hauteur / 2);
      }
      if (blob && blob.size <= limiteMo * 1024 * 1024) {
        const nom = fichier.name.replace(/\.[^.]+$/, '') + '.jpg';
        return new File([blob], nom, { type: 'image/jpeg' });
      }
      return fichier; // trop lourde même compressée : le serveur refusera, message à jour.
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return fichier; // canvas indisponible (navigateur ancien) : envoi brut.
  }
}

/** Message lisible pour une erreur d'envoi connue du backend. */
export function messageErreurEnvoi(code: string, message: string, limiteMo: number): string {
  switch (code) {
    case 'type_fichier_non_autorise':
      return 'Ce fichier n’est pas une image ou un document reconnu : son extension ne correspond pas à son contenu.';
    case 'fichier_trop_volumineux':
      return `Fichier trop volumineux (limite : ${limiteMo} Mo).`;
    case 'fichier_image_invalide':
      return 'Image illisible ou corrompue ; essayez de la renvoyer.';
    case CODE_ERREUR_RESEAU:
      return MESSAGES.erreurReseau;
    default:
      return message || MESSAGES.erreurInconnue;
  }
}
