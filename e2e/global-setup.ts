import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async function globalSetup() {
  const backendDir = path.resolve(__dirname, '../../agrisens-backend');

  console.log('\n[Global Setup] Réinitialisation de la base de données E2E agrisens_e2e...');
  try {
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
    console.log('[Global Setup] Base E2E prête avec succès.');
  } catch (erreur) {
    console.error('[Global Setup] Erreur lors de la réinitialisation E2E:', erreur);
    throw erreur;
  }
}
