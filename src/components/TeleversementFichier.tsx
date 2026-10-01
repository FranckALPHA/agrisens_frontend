import React, { useRef, useState } from 'react';
import { AlertCircle, ImageUp, Loader2, RotateCcw, X } from 'lucide-react';
import { Bouton } from '@/components/Bouton';
import { compresserImage, messageErreurEnvoi } from '@/components/fichiers/envoiFichier';
import {
  televerserFichier,
  type ContexteFichierApi,
  type FichierApi,
} from '@/services/api/fichiers';

/**
 * Composant de téléversement réutilisable (prompt F-03 frontend point 1) :
 * aperçu, compression des images côté navigateur (voir envoiFichier.ts),
 * barre de progression, reprise après erreur, limites affichées. Le type
 * réel est tranché par le backend (lecture des octets) ; ici uniquement le
 * confort et le contrôle de taille avant envoi.
 */

type EtatEnvoi = 'pret' | 'envoi' | 'terminee' | 'echec';

export interface TeleversementFichierProps {
  contexte: ContexteFichierApi;
  /** Limites affichées et contrôlées avant envoi (paramètres plateforme). */
  limiteImageMo: number;
  limiteDocumentMo: number;
  /** Succès : le fichier est stocké, `onTeleverse` fournit ses métadonnées. */
  onTeleverse: (fichier: FichierApi) => void;
  /** Attribut `accept` de la boîte de sélection. */
  accept?: string;
  libelle?: string;
}

export const TeleversementFichier: React.FC<TeleversementFichierProps> = ({
  contexte,
  limiteImageMo,
  limiteDocumentMo,
  onTeleverse,
  accept = 'image/jpeg,image/png,application/pdf',
  libelle = 'Choisir un fichier',
}) => {
  const entreeRef = useRef<HTMLInputElement>(null);
  const [etat, setEtat] = useState<EtatEnvoi>('pret');
  const [progression, setProgression] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);
  const [apercu, setApercu] = useState<string | null>(null);
  const [nomFichier, setNomFichier] = useState<string | null>(null);
  const [dernierEnvoi, setDernierEnvoi] = useState<File | null>(null);

  const envoyer = async (fichier: File) => {
    setEtat('envoi');
    setErreur(null);
    setProgression(0);
    try {
      const resultat = await televerserFichier(fichier, contexte, setProgression);
      setEtat('terminee');
      onTeleverse(resultat);
    } catch (err) {
      setEtat('echec');
      const code = (err as { code?: string }).code ?? 'erreur_inattendue';
      const limite = fichier.type.startsWith('image/') ? limiteImageMo : limiteDocumentMo;
      setErreur(messageErreurEnvoi(code, (err as Error).message ?? '', limite));
    }
  };

  const surSelection = async (fichierBrut: File) => {
    setNomFichier(fichierBrut.name);
    setDernierEnvoi(fichierBrut);
    if (apercu) {
      URL.revokeObjectURL(apercu);
      setApercu(null);
    }
    if (fichierBrut.type.startsWith('image/')) {
      setApercu(URL.createObjectURL(fichierBrut));
      const compacte = await compresserImage(fichierBrut, limiteImageMo);
      await envoyer(compacte);
      return;
    }
    const limite = limiteDocumentMo * 1024 * 1024;
    if (fichierBrut.size > limite) {
      setEtat('echec');
      setErreur(`Document trop volumineux (limite : ${limiteDocumentMo} Mo).`);
      return;
    }
    await envoyer(fichierBrut);
  };

  return (
    <div className="flex flex-col gap-3" data-testid="televersement-fichier">
      {/* Zone de sélection */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          ref={entreeRef}
          type="file"
          accept={accept}
          className="sr-only"
          data-testid="champ-fichier"
          onChange={(evement) => {
            const fichier = evement.target.files?.[0];
            if (fichier) void surSelection(fichier);
            evement.target.value = ''; // permettre de revoyer le même fichier
          }}
        />
        <Bouton
          type="button"
          variante="secondaire"
          onClick={() => entreeRef.current?.click()}
          disabled={etat === 'envoi'}
          iconeGauche={<ImageUp size={18} aria-hidden="true" />}
        >
          {libelle}
        </Bouton>
        {nomFichier && (
          <span className="text-xs text-texte-secondaire truncate max-w-[220px]">{nomFichier}</span>
        )}
      </div>

      <p className="text-xs text-texte-muet">
        Images : {limiteImageMo} Mo max · Documents : {limiteDocumentMo} Mo max (JPEG, PNG, PDF).
      </p>

      {/* Aperçu image */}
      {apercu && (
        <div className="relative w-fit">
          <img
            src={apercu}
            alt={`Aperçu de ${nomFichier ?? 'l’image'}`}
            className="h-28 w-28 rounded-lg border border-bordure object-cover"
            data-testid="apercu-image"
          />
          <button
            type="button"
            aria-label="Retirer l’aperçu"
            className="absolute -top-2 -right-2 p-1 rounded-full bg-surface border border-bordure text-texte-secondaire"
            onClick={() => {
              URL.revokeObjectURL(apercu);
              setApercu(null);
              setNomFichier(null);
              setDernierEnvoi(null);
              setEtat('pret');
              setErreur(null);
            }}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Barre de progression (PW-F03-06) */}
      {etat === 'envoi' && (
        <div
          role="progressbar"
          aria-valuenow={progression}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progression du téléversement"
          className="h-2 w-full rounded-full bg-slate-200 overflow-hidden"
          data-testid="barre-progression"
        >
          <div
            className="h-full bg-primaire transition-[width] duration-200"
            style={{ width: `${progression}%` }}
          />
        </div>
      )}
      {etat === 'envoi' && (
        <p className="text-xs text-texte-secondaire flex items-center gap-1">
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          Envoi en cours… {progression} %
        </p>
      )}

      {/* Erreur + reprise (point 1 du prompt : « reprise après erreur ») */}
      {etat === 'echec' && erreur && (
        <div
          role="alert"
          className="p-3 rounded-md border border-erreur/40 bg-erreur-fond text-sm text-erreur flex items-start gap-2"
          data-testid="erreur-televersement"
        >
          <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <p>{erreur}</p>
            {dernierEnvoi && (
              <Bouton
                type="button"
                taille="sm"
                variante="danger"
                className="mt-2"
                onClick={() => void envoyer(dernierEnvoi)}
                iconeGauche={<RotateCcw size={14} aria-hidden="true" />}
              >
                Réessayer l’envoi
              </Bouton>
            )}
          </div>
        </div>
      )}

      {etat === 'terminee' && <p className="text-xs text-succes font-medium">Fichier envoyé.</p>}
    </div>
  );
};
