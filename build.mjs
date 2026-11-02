// Build de production sans dépendance lourde : esbuild (JS) + Tailwind CSS v4 (CSS).
// Usage : node build.mjs  → produit le dossier dist/ prêt pour Netlify ou Capacitor.
import { build, transform } from 'esbuild';
import { compile } from 'tailwindcss';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
const root = path.dirname(new URL(import.meta.url).pathname);
const dist = path.join(root, 'dist');
const BUILD = Date.now().toString(36);

await fs.rm(dist, { recursive: true, force: true });
await fs.mkdir(path.join(dist, 'assets'), { recursive: true });

// 1) JavaScript
// Modules Capacitor : les vrais s'ils sont installés (GitHub Actions), sinon un remplaçant web.
const capMods = ['@capacitor/core', '@capacitor/local-notifications', '@capacitor/filesystem', '@capacitor/share', '@capacitor/text-zoom'];
const alias = {};
for (const m of capMods) {
  try { require.resolve(m, { paths: [root] }); } catch { alias[m] = path.join(root, 'src/shims/capacitor.ts'); }
}
if (Object.keys(alias).length) console.log('ℹ︎ Capacitor non installé : remplaçant web pour', Object.keys(alias).join(', '));
await build({
  alias,
  entryPoints: [path.join(root, 'src/main.tsx')],
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2020',
  jsx: 'automatic',
  outfile: path.join(dist, 'assets/app.js'),
  define: {
    'process.env.NODE_ENV': '"production"',
    __API_BASE__: JSON.stringify(process.env.API_BASE || ''),
    __APP_VERSION__: JSON.stringify(JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8')).version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  nodePaths: (process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean),
  legalComments: 'none',
  logLevel: 'warning',
});

// 2) CSS Tailwind : on scanne les sources pour trouver les classes utilisées.
async function walk(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (/\.(tsx?|html)$/.test(e.name)) out.push(p);
  }
  return out;
}
const files = [...(await walk(path.join(root, 'src'))), path.join(root, 'index.html')];
const candidates = new Set();
for (const f of files) for (const tok of (await fs.readFile(f, 'utf8')).split(/[\s"'`{}();,<>]+/)) if (tok) candidates.add(tok);

const twDir = path.dirname(require.resolve('tailwindcss/package.json', { paths: [root, ...(process.env.NODE_PATH || '').split(path.delimiter)] }));
const compiler = await compile(await fs.readFile(path.join(root, 'src/styles.css'), 'utf8'), {
  base: path.join(root, 'src'),
  loadStylesheet: async (id, base) => {
    const file = id === 'tailwindcss' ? path.join(twDir, 'index.css') : id.startsWith('tailwindcss/') ? path.join(twDir, id.slice(12)) : path.resolve(base, id);
    return { path: file, base: path.dirname(file), content: await fs.readFile(file, 'utf8') };
  },
});
const css = compiler.build([...candidates]);
const { code: cssMin } = await transform(css, { loader: 'css', minify: true, target: ['chrome87', 'safari14'] });
await fs.writeFile(path.join(dist, 'assets/app.css'), cssMin);

// 3) Fichiers statiques
await fs.cp(path.join(root, 'public'), dist, { recursive: true });
await fs.copyFile(path.join(root, 'index.html'), path.join(dist, 'index.html'));
const sw = path.join(dist, 'sw.js');
await fs.writeFile(sw, (await fs.readFile(sw, 'utf8')).replace('__BUILD__', BUILD));

const size = async (f) => ((await fs.stat(path.join(dist, f))).size / 1024).toFixed(0) + ' Ko';
console.log(`✓ dist/ prêt — app.js ${await size('assets/app.js')}, app.css ${await size('assets/app.css')} (build ${BUILD})`);
