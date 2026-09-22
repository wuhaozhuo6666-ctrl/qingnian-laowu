import { execFileSync } from 'node:child_process';

const from = process.env.CACHED_COMMIT_REF;
const to = process.env.COMMIT_REF;

if (!from || !to || from === to) {
  // On an uncertain/first build, build rather than risk skipping required code.
  process.exit(1);
}

let output = '';
try {
  output = execFileSync('git', ['diff', '--name-only', from, to], { encoding: 'utf8' });
} catch {
  process.exit(1);
}

const files = output.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
if (!files.length) process.exit(0);

const deployless = files.every(path =>
  path === 'products/catalog.json' || path.startsWith('products/uploads/')
);

// Netlify ignore contract: 0 = skip build, 1 = continue build.
process.exit(deployless ? 0 : 1);
