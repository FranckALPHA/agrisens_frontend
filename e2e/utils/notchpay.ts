import crypto from 'crypto';
import type { APIRequestContext, APIResponse } from '@playwright/test';

/**
 * Pilotage direct du webhook NotchPay pour les tests E2E (plan §1.3,
 * journal Q-22). Le secret est un factice réservé aux tests : le serveur
 * API des E2E le reçoit via `NOTCHPAY_SECRET_WEBHOOK` (playwright.config.ts).
 */
export const SECRET_WEBHOOK_TEST = 'e2e-webhook-secret-pour-tests-uniquement';

const URL_API = 'http://127.0.0.1:8001/api/v1';

export interface EvenementNotchpay {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

/** Signe un corps de webhook exactement comme le simulateur (HMAC-SHA256). */
export function signerWebhook(corps: string, secret = SECRET_WEBHOOK_TEST): string {
  return crypto.createHmac('sha256', secret).update(corps, 'utf-8').digest('hex');
}

/** Envoie un webhook au vrai point d'entrée (vérification de signature incluse). */
export async function envoyerWebhook(
  request: APIRequestContext,
  evenement: EvenementNotchpay,
  secret = SECRET_WEBHOOK_TEST
): Promise<APIResponse> {
  const corps = JSON.stringify(evenement);
  return request.post(`${URL_API}/webhooks/notchpay/`, {
    data: corps,
    headers: {
      'Content-Type': 'application/json',
      'X-Notch-Signature': signerWebhook(corps, secret),
    },
  });
}

/** Fabrique un événement `payment.complete` pour une référence interne. */
export function evenementReussi(
  referenceInterne: string,
  montant: number,
  suffixe = 'manuel'
): EvenementNotchpay {
  return {
    id: `evt-${referenceInterne}-${suffixe}`,
    type: 'payment.complete',
    data: {
      reference: `FCT-${referenceInterne}`,
      merchant_reference: referenceInterne,
      amount: montant,
      currency: 'XAF',
      status: 'complete',
    },
  };
}
