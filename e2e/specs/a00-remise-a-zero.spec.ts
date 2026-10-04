import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { expect, test } from '@playwright/test';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Plomberie de suite — pas un scénario métier.
 *
 * Les deux passes (ordinateur puis mobile) partagent la même base
 * `agrisens_e2e`, réinitialisée une seule fois par le globalSetup. Comme les
 * tests enchaînent un état durable (quota IA mensuel de Paul consommé par
 * PW-F12-03, compte de Jean suspendu par PW-F03-04, courses et litiges
 * ouverts…), la seconde passe héritait des états terminaux de la première et
 * échouait pour des raisons sans rapport avec le scénario testé.
 *
 * Ce fichier est le premier exécuté de chaque passe (ordre alphabétique,
 * `workers: 1`) : il redémarre la base avant la passe mobile. La passe
 * ordinateur démarre déjà sur une base neuve (globalSetup), elle est donc
 * laissée telle quelle.
 */
test.describe('remise à zéro de la base E2E', () => {
  test('réinitialise la base avant la passe mobile', async ({ request }) => {
    test.skip(
      test.info().project.name !== 'mobile',
      'globalSetup a déjà fourni une base neuve pour la première passe'
    );

    const backendDir = path.resolve(__dirname, '../../../agrisens-backend');
    execSync('uv run python manage.py reinitialiser_e2e', {
      cwd: backendDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        DJANGO_SETTINGS_MODULE: 'config.settings.test',
        ENVIRONNEMENT: 'test',
        DATABASE_URL:
          'mysql+pymysql://agrisens:KYsFaZTVkaLB2tZLy2BQYBe9@127.0.0.1:3306/agrisens_e2e?charset=utf8mb4',
      },
    });

    // La base doit être joignable et peuplée immédiatement après reset.
    const sante = await request.get('http://127.0.0.1:8001/api/v1/sante');
    expect(sante.ok(), 'API disponible après réinitialisation').toBeTruthy();
  });
});
