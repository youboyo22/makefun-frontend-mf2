// tools/shots.mjs: take the three screenshots in shots.json of the running app on live make.fun data.
//
// Each shot is a fresh page load of its route in headless Chrome (tools/chrome.mjs); the app sets
// window.__shotReady once the route's data is on screen, and the script waits for that before it captures.
// The images are what Chrome rendered, written as they come: nothing is edited afterwards.
//
//   node tools/shots.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { withPage } from './chrome.mjs';

const shots = JSON.parse(readFileSync('shots.json', 'utf8'));

const errors = await withPage(async ({ send, evaluate, open }) => {
  for (const shot of shots) {
    const { width, height } = shot.viewport;
    await open(shot.path, { width, height, scale: shot.scale, settle: shot.settle });
    const image = await send('Page.captureScreenshot', { format: 'jpeg', quality: shot.quality ?? 88 });
    const bytes = Buffer.from(image.data, 'base64');
    writeFileSync(join('screenshots', shot.file), bytes);
    console.log(`${shot.file}  ${shot.path}  ${width}x${height}@${shot.scale ?? 1}  ${bytes.length} bytes  |  ${await evaluate("document.querySelector('.tel').textContent")}`);
  }
});
if (errors.length) console.log(`page errors:\n  ${errors.join('\n  ')}`);
