import { defineConfig } from 'playwright/test';

const origin = `http://127.0.0.1:${process.env.BROWSER_PORT ?? '4175'}`;
const mode = process.env.BROWSER_SERVER === 'dev' ? '' : 'preview';

export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 90000,
  expect: { timeout: 10000 },
  reporter: [['list'], ['json', { outputFile: '.cache/e2e/results.json' }]],
  outputDir: '.cache/e2e/artifacts',
  use: {
    baseURL: origin,
    viewport: { width: 1280, height: 800 },
    serviceWorkers: 'block',
    actionTimeout: 10000,
    screenshot: 'only-on-failure',
    trace: process.env.E2E_TRACE === '1' ? 'retain-on-failure' : 'off',
    launchOptions: { executablePath: process.env.CHROMIUM_PATH,
      args: ['--disable-gpu', '--disable-webgl', '--disable-webgl2', '--disable-features=WebGPU'] },
  },
  webServer: {
    command: `node node_modules/vite/bin/vite.js ${mode} --host 127.0.0.1 --port ${new URL(origin).port} --strictPort`,
    url: origin,
    timeout: 30000,
    reuseExistingServer: false,
  },
});
