import { APIRequestContext } from '@playwright/test';

/**
 * Client API direct pour les tests E2E.
 */
export class ClientApiE2E {
  constructor(private readonly request: APIRequestContext, private readonly baseUrl = 'http://127.0.0.1:8001/api/v1') {}

  /**
   * Décale l'horloge système du backend.
   */
  async decalerHorloge(minutes: number): Promise<void> {
    const res = await this.request.post(`${this.baseUrl}/dev/horloge`, {
      data: { decalage_minutes: minutes },
    });
    if (!res.ok()) {
      throw new Error(`Échec décalage horloge: ${res.status()} ${await res.text()}`);
    }
  }

  /**
   * Réinitialise l'horloge au temps réel.
   */
  async reinitialiserHorloge(): Promise<void> {
    const res = await this.request.delete(`${this.baseUrl}/dev/horloge`);
    if (!res.ok()) {
      throw new Error(`Échec réinitialisation horloge: ${res.status()} ${await res.text()}`);
    }
  }

  /**
   * Déclenche une tâche asynchrone immédiatement.
   */
  async declencherTache(nomTache: string): Promise<void> {
    const res = await this.request.post(`${this.baseUrl}/dev/taches/${nomTache}`);
    if (!res.ok()) {
      throw new Error(`Échec déclenchement tâche ${nomTache}: ${res.status()} ${await res.text()}`);
    }
  }
}
