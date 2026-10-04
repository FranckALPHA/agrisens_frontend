/**
 * Modale d'explication avant demande de permission (F-15, SPEC-12 §5).
 * Affiche une explication claire avant de déclencher la demande navigateur
 * pour la géolocalisation ou la caméra.
 */

import React from 'react';
import { MapPin, Camera } from 'lucide-react';
import { Bouton } from '@/components/Bouton';
import { MESSAGES } from '@/theme/messages';

export type TypePermission = 'gps' | 'camera';

interface Props {
  type: TypePermission;
  surAutoriser: () => void;
  surRefuser: () => void;
}

export const ExplicationPermission: React.FC<Props> = ({ type, surAutoriser, surRefuser }) => {
  const EstGps = type === 'gps';
  return (
    <div
      role="alertdialog"
      aria-label={EstGps ? 'Permission de géolocalisation' : 'Permission caméra'}
      data-testid="explication-permission"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
    >
      <div className="bg-surface rounded-xl p-6 max-w-sm w-full shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          {EstGps ? (
            <MapPin size={28} className="text-primaire" aria-hidden="true" />
          ) : (
            <Camera size={28} className="text-primaire" aria-hidden="true" />
          )}
          <h3 className="text-base font-semibold text-texte">
            {EstGps ? 'Activer la position ?' : 'Activer la caméra ?'}
          </h3>
        </div>
        <p className="text-sm text-texte-secondaire mb-6">
          {EstGps ? MESSAGES.permissionGPS : MESSAGES.permissionCamera}
        </p>
        <div className="flex gap-3 justify-end">
          <Bouton taille="sm" variante="discret" onClick={surRefuser}>
            {MESSAGES.refuser}
          </Bouton>
          <Bouton taille="sm" variante="primaire" onClick={surAutoriser}>
            {MESSAGES.autoriser}
          </Bouton>
        </div>
      </div>
    </div>
  );
};
