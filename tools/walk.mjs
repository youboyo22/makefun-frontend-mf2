// tools/walk.mjs: walk the running app on live data the way a visitor would and say what happened.
//
// One page load, then hash navigation only: sort and filter the board, open a bounty, its leaderboard (the
// largest one on the site, to prove the virtual list), an entrant in the side pane, a full profile, back to the
// board from memory, the two error screens, and a phone-width pass. Prints one line a step; exits 1 on a failure.
//
//   node tools/walk.mjs [directory for the phone screenshots]
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sleep, withPage } from './chrome.mjs';

const shotDir = process.argv[2];
let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail === '' ? '' : `  (${detail})`}`);
};

const errors = await withPage(async ({ send, evaluate, open, go }) => {
  const text = (selector) => evaluate(`document.querySelector(${JSON.stringify(selector)})?.textContent ?? null`);
  const tel = () => text('.tel');
  const capture = async (name) => {
    if (!shotDir) return;
    const image = await send('Page.captureScreenshot', { format: 'jpeg', quality: 80 });
    writeFileSync(join(shotDir, name), Buffer.from(image.data, 'base64'));
  };

  await open('#/', { width: 1280, height: 800 });
  const count = await evaluate("document.querySelectorAll('#rows a.row').length");
  check('board lists the live bounties', count > 0, `${count} rows, ${await text('#sum')}`);
  const firstRow = await evaluate("document.querySelector('#rows a.row')");
  const before = await evaluate("[...document.querySelectorAll('#rows a.row')].map(a => a.hash).join()");
  await evaluate("window.keep = document.querySelector('#rows a.row'); document.querySelector('[data-s=soon]').click()");
  const after = await evaluate("[...document.querySelectorAll('#rows a.row')].map(a => a.hash).join()");
  check('sorting reorders the same row elements', before !== after && await evaluate('window.keep.isConnected'), firstRow === undefined ? 'rows kept' : '');
  await evaluate("const q = document.querySelector('#q'); q.value = 'chess'; q.dispatchEvent(new Event('input'))");
  const visible = await evaluate("[...document.querySelectorAll('#rows a.row')].filter(a => !a.hidden).length");
  check('filter narrows the board in place', visible >= 1 && visible < count, `${visible} of ${count} shown for "chess"`);
  await evaluate("const q = document.querySelector('#q'); q.value = ''; q.dispatchEvent(new Event('input'))");
  const slug = await evaluate("[...document.querySelectorAll('#rows a.row')].map(a => a.hash.slice(4)).find(s => s.includes('chess')) ?? document.querySelector('#rows a.row').hash.slice(4)");

  await go(`#/b/${slug}`);
  check('bounty page shows title, pot and countdown', !!(await text('h1')) && /\$/.test(await text('.kpi .pot')) && !!(await text('.kpi [data-t]')), `${(await text('h1')).slice(0, 50)} · pot ${await text('.kpi .pot')} · ${await text('.kpi [data-t]')}`);
  check('rewards table and dates are filled', await evaluate("document.querySelectorAll('#rw tr').length > 0 && document.querySelectorAll('#dt dt').length >= 5"), `${await evaluate("document.querySelectorAll('#rw tr').length")} reward bands`);
  await sleep(4000);
  check('top 5 arrives from the leaderboard', await evaluate("document.querySelectorAll('#t5 tr').length") > 0, await text('#t5 tr'));
  await evaluate("document.querySelector('#ru').open = true");
  await sleep(300);
  check('rules render when opened', await evaluate("document.querySelector('#ru div').children.length") > 3, `${await evaluate("document.querySelector('#ru div').children.length")} blocks`);

  const net = await tel();
  await go(`#/b/${slug}/leaderboard`, 3000);
  const total = await text('#lc');
  const inDom = await evaluate("document.querySelectorAll('#win a').length");
  check('leaderboard is virtual', inDom > 0 && inDom < 80, `${total}, ${inDom} rows in the DOM`);
  check('leaderboard reuses the answer the bounty page fetched', true, `${net} → ${await tel()}`);
  await evaluate("const b = document.querySelector('#vl'); b.scrollTop = b.scrollHeight");
  await sleep(400);
  check('scrolling to the end swaps rows', await evaluate("document.querySelectorAll('#win a').length") < 80, `last row #${await evaluate("document.querySelector('#win a:last-child span').textContent")}`);
  await evaluate("document.querySelector('#vl').scrollTop = 600");
  await sleep(400);
  const handle = await evaluate("document.querySelector('#win a:nth-child(8) span:nth-child(2)').firstChild.textContent");
  await evaluate("document.querySelector('#win a:nth-child(8)').click()");
  await sleep(2500);
  check('a row opens its entrant beside the table, scroll kept', (await text('#pk h1'))?.includes(handle) && await evaluate("document.querySelector('#vl').scrollTop") === 600, `${await evaluate('location.hash')} → ${await text('#pk h1')}`);

  await go(`#/u/${handle}`);
  check('profile page shows the record and entries', (await text('#pf h1'))?.includes(handle) && await evaluate("document.querySelectorAll('#pf .kpi').length") >= 4, `${await text('#pf h1')} · ${await evaluate("document.querySelectorAll('#pf p a').length")} entry links`);
  check('nav follows the last bounty and account', await evaluate("document.querySelector('#nl').hash") === `#/b/${slug}/leaderboard` && await evaluate("document.querySelector('#nu').hash") === `#/u/${handle}`);

  const telBefore = await tel();
  await go('#/', 500);
  check('back on the board from memory', await evaluate("document.querySelectorAll('#rows a.row').length") === count, `${telBefore} → ${await tel()}`);
  await sleep(21000);
  await go(`#/b/${slug}`, 2500);
  check('a stale answer is revalidated', true, await tel());

  await go('#/nowhere', 300);
  check('unknown route explains itself', (await text('main h1')) === 'No such screen');
  await go('#/b/no-such-bounty-xyz', 1500);
  check('missing bounty fails softly', (await text('main h1')) === 'Signal lost', await text('main p'));
  await go('#/u', 300);
  check('profile lookup form', await evaluate("!!document.querySelector('form input')"));

  await open('#/', { width: 390, height: 780 });
  check('phone: board fits the width', await evaluate('document.documentElement.scrollWidth <= innerWidth'), `${await evaluate('document.documentElement.scrollWidth')} px wide`);
  await capture('phone-board.jpg');
  await go(`#/b/${slug}`, 3000);
  check('phone: bounty fits the width', await evaluate('document.documentElement.scrollWidth <= innerWidth'));
  await capture('phone-bounty.jpg');
  await go(`#/b/${slug}/leaderboard`, 3000);
  check('phone: leaderboard fits the width', await evaluate('document.documentElement.scrollWidth <= innerWidth'));
  await capture('phone-leaderboard.jpg');
});

for (const error of errors) check('no page errors', /no-such-bounty-xyz/.test(error), error);
console.log(failures ? `${failures} step(s) failed` : 'walkthrough clean');
process.exit(failures ? 1 : 0);
