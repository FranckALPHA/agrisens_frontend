import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  testDir: './e2e/specs',
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    locale: 'fr-FR',
    timezoneId: 'Africa/Douala',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'ordinateur',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'mobile',
      use: {
        ...devices['Pixel 5'],
      },
    },
  ],
  webServer: [
    {
      command: 'uv run python manage.py runserver 127.0.0.1:8001 --noreload',
      cwd: path.resolve(__dirname, '../agrisens-backend'),
      url: 'http://127.0.0.1:8001/api/v1/sante',
      timeout: 30000,
      reuseExistingServer: !process.env.CI,
      env: {
        DJANGO_SETTINGS_MODULE: 'config.settings.test',
        ENVIRONNEMENT: 'test',
        DATABASE_URL:
          'mysql+pymysql://agrisens:KYsFaZTVkaLB2tZLy2BQYBe9@127.0.0.1:3306/agrisens_e2e?charset=utf8mb4',
        NOTCHPAY_MODE: 'factice',
        IA_FOURNISSEUR: 'factice',
        // Débits relevés : la suite enchaîne beaucoup de connexions/
        // inscriptions depuis la même IP (127.0.0.1) et subirait des 429.
        DEBIT_CONNEXION: '200/min',
        DEBIT_INSCRIPTION: '200/min',
        DEBIT_REINITIALISATION: '200/min',
      },
    },
    {
      command: 'npm run preview -- --port 4173 --host 127.0.0.1',
      cwd: __dirname,
      url: 'http://127.0.0.1:4173',
      timeout: 30000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
