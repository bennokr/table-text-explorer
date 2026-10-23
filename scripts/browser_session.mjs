import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

export const origin = 'http://127.0.0.1:4175';

async function ready(server) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (server.exitCode !== null) { throw new Error('Preview server exited before becoming ready.'); }
    try { if ((await fetch(origin)).ok) { return; } }
    catch { /* Wait for the owned loopback server. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Preview server did not start.');
}

export async function browserSession() {
  const mode = process.env.BROWSER_SERVER ?? 'preview';
  const command = mode === 'dev' ? [] : ['preview'];
  const server = spawn('node', ['node_modules/vite/bin/vite.js', ...command, '--host', '127.0.0.1',
    '--port', '4175', '--strictPort'], { stdio: 'pipe' });
  server.stdout.on('data', chunk => {
    if (mode === 'dev') { process.stdout.write(chunk); }
  });
  server.stderr.on('data', chunk => { process.stderr.write(chunk); });
  let browser;
  const close = async () => { await browser?.close(); server.kill(); };
  try {
    await ready(server);
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH,
      args: ['--disable-gpu', '--disable-webgl', '--disable-webgl2', '--disable-features=WebGPU'] });
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, serviceWorkers: 'block' });
    const requests = [], errors = [];
    await context.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
    await context.route('**/*', async route => {
      const request = route.request();
      const local = new URL(request.url()).origin === origin;
      requests.push({ local, method: request.method() });
      if (!local) { await route.abort(); } else { await route.continue(); }
    });
    const page = await context.newPage();
    page.on('pageerror', error => { errors.push(String(error)); console.error(error.message); });
    await page.goto(origin);
    await page.waitForFunction(() => window.explorer);
    return { page, requests, errors, close };
  } catch (error) { await close(); throw error; }
}
