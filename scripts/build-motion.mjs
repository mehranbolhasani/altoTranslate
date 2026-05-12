import * as esbuild from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, '..');

await esbuild.build({
  entryPoints: [join(dir, 'motion-export.mjs')],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['chrome114'],
  outfile: join(root, 'vendor', 'motion-lib.js'),
  logLevel: 'info'
});
