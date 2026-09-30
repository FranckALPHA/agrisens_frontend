import { test as baseTest, expect } from '@playwright/test';
import { ClientApiE2E } from './api';

export interface FixturesAgriSens {
  clientApi: ClientApiE2E;
}

export const test = baseTest.extend<FixturesAgriSens>({
  clientApi: async ({ request }, use) => {
    const api = new ClientApiE2E(request);
    await use(api);
  },
});

export { expect };
