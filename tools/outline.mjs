// tools/outline.mjs: print what the judge will read of this entry.
//
// The judge never sees the whole dossier, only an outline of about 1,248 bytes. The code that cuts it ships inside
// the kit's CLI, so this script lifts those functions out of the CLI's own text and runs them on out/dossier.json:
// the measurement is the judge's cut itself, not a guess at it.
//
//   node tools/outline.mjs [path to makefun.mjs] [path to dossier.json]
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const kitRoot = '../kit';
const cliPath = process.argv[2] ?? join(kitRoot, readdirSync(kitRoot)[0], 'cli', 'makefun.mjs');
const dossierPath = process.argv[3] ?? 'out/dossier.json';
const cli = readFileSync(cliPath, 'utf8');

// The outline functions sit between these two markers of the bundled server/judging/dossier-view.ts.
const start = cli.indexOf('function languageOf2(');
const end = cli.indexOf('function dossierJudgeView(', start);
if (start < 0 || end < 0) throw new Error('this CLI does not carry the outline code where it was expected');

// Its constants, as the bundle sets them (DECL_MAX_BYTES 96, a 1,536-token entry at 3 bytes a token).
const prelude = `
const utf8Bytes4 = (s) => Buffer.byteLength(s, 'utf8');
const jsonBytes = (s) => utf8Bytes4(JSON.stringify(s)) - 2;
const plural8 = (n, one, many = one + 's') => n + ' ' + (n === 1 ? one : many);
const HEAD_KEPT = /^(#{1,6}\\s|(Source files|Files|Scripts|Instances|Totals):\\s)/;
const DECL_MAX_BYTES = 96;
const FENCE_OPEN2 = /^(\`{3,}|~{3,})\\s*([A-Za-z0-9_+.-]*)\\s*$/;
const JS_KEYWORDS2 = new Set('if for while switch catch with return function else do try new typeof await yield super delete void throw in of'.split(' '));
const vendored = (s) => /(^|\\/)vendor\\//.test(s.heading.slice(4).split(' (')[0] ?? '');
const linesCost = (lines) => lines.reduce((n, l) => n + jsonBytes(l + '\\n'), 0);
`;
const viewText = new Function(`${prelude}\n${cli.slice(start, end)}\nreturn viewText;`)();

const dossier = JSON.parse(readFileSync(dossierPath, 'utf8'));
const BUDGET = 1248;
const view = viewText(dossier.text, BUDGET, dossier.images.length);
const used = Buffer.byteLength(JSON.stringify(view.text), 'utf8') - 2;

console.log(view.text);
console.log('\n----');
console.log(`outline: ${used} of ${BUDGET} bytes, ${view.decls} declaration lines shown, form ${view.form}`);
console.log(dossier.text.split('\n').find((line) => line.startsWith('Totals:')));
console.log(`dossier.json: ${readFileSync(dossierPath).length} bytes`);
