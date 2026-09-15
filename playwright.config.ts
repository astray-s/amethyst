import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.AMETHYST_E2E_PORT ?? '43117');
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error('AMETHYST_E2E_PORT must be an integer between 1024 and 65535.');
}
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  reporter: 'line',
  use: {
    baseURL,
    channel: 'chrome',
    ...devices['Pixel 7'],
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
  },
});
