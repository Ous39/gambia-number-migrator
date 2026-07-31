import { chromium, devices } from 'playwright';
import { mkdir } from 'node:fs/promises';

const mobileUrl = process.env.GNM_MOBILE_URL || 'http://127.0.0.1:8082';
const adminUrl = process.env.GNM_ADMIN_URL || 'http://127.0.0.1:5173';
const root = new URL('../docs/screenshots/v2.8.0/', import.meta.url);
for (const folder of ['mobile', 'admin-desktop', 'admin-mobile', 'dark-mode']) {
  await mkdir(new URL(`${folder}/`, root), { recursive: true });
}

const browser = await chromium.launch();
const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await desktop.goto(adminUrl, { waitUntil: 'networkidle' });
await desktop.screenshot({ path: new URL('admin-desktop/login.png', root).pathname, fullPage: true });

const phone = await browser.newPage({ ...devices['Pixel 7'] });
await phone.goto(mobileUrl, { waitUntil: 'networkidle' });
await phone.screenshot({ path: new URL('mobile/start.png', root).pathname, fullPage: true });
await phone.goto(adminUrl, { waitUntil: 'networkidle' });
await phone.screenshot({ path: new URL('admin-mobile/login.png', root).pathname, fullPage: true });

await browser.close();
console.log('Public start/login captures complete. Authenticate with seeded staging data and extend this route list for every protected/stateful screen.');
