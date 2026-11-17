// Mission Control v2: the hand-in program (Node 22, standard library only, no network).
// It copies app/ and screenshots/ into the output directory and writes dossier.json with the kit's own library,
// so the bytes are the ones the gate rebuilds. Two runs write the same files: nothing here reads a clock.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const repo = dirname(fileURLToPath(import.meta.url));
const output = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate's caps: the text cap shapes the dossier, the others refuse what the scorer would refuse.
const CAPS = {
  text_max_bytes: 160 * 1024,
  screenshots: { max: 3, max_bytes: 256 * 1024 },
  app_max_files: 993,
  app_max_bytes: 16 * 1024 * 1024,
};

mkdirSync(output, { recursive: true });
for (const part of ['app', 'screenshots']) {
  // Start each part clean so a file deleted from the repository never lingers in an older output directory.
  rmSync(join(output, part), { recursive: true, force: true });
  cpSync(join(repo, part), join(output, part), { recursive: true });
}
writeFileSync(join(output, 'dossier.json'), buildDossier(output, CAPS));
console.log(`Mission Control handed in: ${join(output, 'dossier.json')}`);
