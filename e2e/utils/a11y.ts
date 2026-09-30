import { Page, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Vérifie l'accessibilité de la page avec axe-core.
 * Aucune violation 'serious' ou 'critical' tolérée.
 */
export async function verifierAccessibilite(page: Page): Promise<void> {
  const resultats = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();

  const violationsCritiques = resultats.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious'
  );

  if (violationsCritiques.length > 0) {
    console.error('Violations d’accessibilité détectées:', JSON.stringify(violationsCritiques, null, 2));
  }

  expect(violationsCritiques).toHaveLength(0);
}
