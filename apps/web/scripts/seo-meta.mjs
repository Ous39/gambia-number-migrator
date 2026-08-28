// Post-build: write per-route index.html files with correct <title>, description,
// canonical and Open Graph tags baked in. The SPA still hydrates on top; this
// only fixes what non-JS crawlers and link-preview scrapers see.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = 'https://gnm.oceanbrown.gm';
const DIST = fileURLToPath(new URL('../dist/', import.meta.url));

const ROUTES = {
  '/': {
    title: 'Gambia Number Migrator | Update contacts safely',
    desc: 'GNM helps individuals, businesses and institutions safely update eligible Gambian contacts from 7 digits to the new 9-digit format. Contacts stay on your device.',
  },
  '/status': {
    title: 'Live status | Gambia Number Migrator',
    desc: 'Live readiness for GNM: service state, published migration-rule version, access and pricing, payment options and the official 7-to-9-digit transition window.',
  },
  '/updates': {
    title: 'Updates | Gambia Number Migrator',
    desc: 'Official announcements about The Gambia numbering migration and each GNM release.',
  },
  '/organisations': {
    title: 'Organisations | Gambia Number Migrator',
    desc: 'Businesses and institutions can plan a larger contact migration and request dedicated GNM support. No contact data is ever shared.',
  },
  '/support': {
    title: 'Help & support | Gambia Number Migrator',
    desc: 'Get help with GNM contact scanning, backups, migration, restore and account access.',
  },
  '/contact': {
    title: 'Contact GNM | Gambia Number Migrator',
    desc: 'Contact the GNM support and partnership team for technical help, business migration, media and partnership enquiries.',
  },
  '/privacy': {
    title: 'Privacy Policy | Gambia Number Migrator',
    desc: 'How GNM handles contact permissions, backups, account information, payments and user privacy. Contacts never leave your device.',
  },
  '/terms': {
    title: 'Terms of Use | Gambia Number Migrator',
    desc: 'The terms governing use of the GNM mobile application and public website.',
  },
  '/refunds': {
    title: 'Refund Policy | Gambia Number Migrator',
    desc: 'How GNM handles refunds for the one-time Contact Migration Pass.',
  },
  '/data-deletion': {
    title: 'Data Deletion Request | Gambia Number Migrator',
    desc: 'How to request deletion of the device, payment and notification data GNM stores on its servers. Contacts, names and phone numbers never leave your device.',
  },
  '/payment/success': { title: 'Payment received | GNM', desc: 'Your GNM payment was received.', noindex: true },
  '/payment/error': { title: 'Payment not completed | GNM', desc: 'Your GNM payment did not complete.', noindex: true },
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const template = readFileSync(join(DIST, 'index.html'), 'utf8');

function build(route, meta) {
  const url = route === '/' ? `${SITE}/` : `${SITE}${route}`;
  let html = template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(meta.title)}</title>`)
    .replace(/(<meta name="description" content=)"[^"]*"/, `$1"${esc(meta.desc)}"`)
    .replace(/(<link rel="canonical" href=)"[^"]*"/, `$1"${url}"`)
    .replace(/(<meta property="og:title" content=)"[^"]*"/, `$1"${esc(meta.title)}"`)
    .replace(/(<meta property="og:description" content=)"[^"]*"/, `$1"${esc(meta.desc)}"`)
    .replace(/(<meta property="og:url" content=)"[^"]*"/, `$1"${url}"`);
  if (meta.noindex) {
    html = html.replace(/(<meta name="robots" content=)"[^"]*"/, `$1"noindex, nofollow"`);
  }
  return html;
}

let count = 0;
for (const [route, meta] of Object.entries(ROUTES)) {
  const out = route === '/' ? join(DIST, 'index.html') : join(DIST, route.replace(/^\//, ''), 'index.html');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, build(route, meta));
  count += 1;
}
console.log(`seo-meta: wrote ${count} route pages`);
