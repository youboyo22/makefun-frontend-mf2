// tools/chrome.mjs: serve app/ and drive headless Chrome over the DevTools protocol, for the screenshot and
// walkthrough scripts. Node's own WebSocket and fetch are all it needs: nothing to install.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const APP_PORT = 8137, DEBUG_PORT = 9337;

export const ORIGIN = `http://127.0.0.1:${APP_PORT}`;
export const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function debuggerUrl() {
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const pages = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json`)).json();
      const page = pages.find((p) => p.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* Chrome is still starting */ }
    await sleep(200);
  }
  throw new Error('Chrome did not open its debugging port');
}

// Runs work({ send, evaluate, open, errors }) against one page, then shuts everything down.
export async function withPage(work) {
  const server = spawn(process.execPath, ['serve.ts', '--port', String(APP_PORT)], { stdio: 'ignore' });
  const profile = mkdtempSync(join(tmpdir(), 'mission-control-'));
  // Without the mock keychain, headless Chrome on macOS stalls on every network request.
  const chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profile}`,
    '--use-mock-keychain', '--password-store=basic', '--disable-background-networking', '--disable-component-update',
    '--disable-sync', '--disable-extensions', '--no-first-run', '--hide-scrollbars', 'about:blank',
  ], { stdio: 'ignore' });
  try {
    const socket = new WebSocket(await debuggerUrl());
    await new Promise((done, failed) => { socket.onopen = done; socket.onerror = failed; });
    const waiting = new Map();
    const errors = [];
    let nextId = 0;
    socket.onmessage = ({ data }) => {
      const message = JSON.parse(data);
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
      if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') errors.push(`${message.params.entry.text} ${message.params.entry.url ?? ''}`);
      waiting.get(message.id)?.(message);
      waiting.delete(message.id);
    };
    const send = (method, params = {}) => new Promise((done) => {
      waiting.set(++nextId, (message) => done(message.result ?? message.error));
      socket.send(JSON.stringify({ id: nextId, method, params }));
    });
    const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value;
    // Waits until the app says the route's data is on screen (window.__shotReady), then a little longer for
    // the view's second request (the top 5, the side pane, an avatar).
    const settled = async (what, settle = 2500) => {
      let ready = false;
      for (let attempt = 0; attempt < 150 && !ready; attempt++) {
        await sleep(200);
        ready = await evaluate('window.__shotReady === true');
      }
      if (!ready) throw new Error(`${what} never reported its data on screen`);
      await sleep(settle);
    };
    const open = async (route, { width, height, scale = 1, settle } = {}) => {
      if (width) await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false });
      await send('Page.navigate', { url: 'about:blank' });
      await send('Page.navigate', { url: `${ORIGIN}/index.html${route}` });
      await settled(route, settle);
    };
    const go = async (route, settle = 1500) => {
      await evaluate(`window.__shotReady = false; location.hash = ${JSON.stringify(route)}`);
      await settled(route, settle);
    };
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Log.enable');
    await work({ send, evaluate, open, go, errors });
    socket.close();
    return errors;
  } finally {
    chrome.kill();
    server.kill();
    await sleep(300);
    rmSync(profile, { recursive: true, force: true });
  }
}
