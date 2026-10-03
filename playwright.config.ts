import { defineConfig, devices } from '@playwright/test';

const browser = process.env.IMAGEPREP_TEST_BROWSER || 'edge';
const selectedBrowser = browser === 'chrome'
  ? { ...devices['Desktop Chrome'], channel: 'chrome' as const }
  : browser === 'firefox'
    ? { ...devices['Desktop Firefox'] }
    : { ...devices['Desktop Edge'], channel: 'msedge' as const };

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: browser, use: selectedBrowser }],
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
  },
});
