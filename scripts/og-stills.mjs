#!/usr/bin/env node
/**
 * Capture a still of each lecture figure for the share cards, after it has
 * learned something, into scripts/og/stills/<NN>.png. og-lectures.mjs puts the
 * still on the lecture's card. The stills are committed, so the cards can be
 * redrawn without a browser.
 *
 * Needs the built site served locally and a Chrome with remote debugging on:
 *   npm run build && npx astro preview --port 4321
 *   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
 *     --remote-debugging-port=9222 --user-data-dir=/tmp/og-chrome about:blank
 * Then:
 *   node scripts/og-stills.mjs                  # all nine figures
 *   node scripts/og-stills.mjs 04 15            # only these
 *   node scripts/og-stills.mjs --site http://127.0.0.1:4391 --cdp 9351
 *
 * Each figure is driven through its own buttons. Math.random is replaced by a
 * seeded generator, so a rerun gives the same stills; when a run doesn't show
 * what the figure is about (the actor-critic agent missing the goal, a worse
 * slot machine leading), the next seed is tried. The figures pause when they
 * think they have scrolled out of view, so IntersectionObserver is stubbed out.
 * The still is the figure without its caption, at twice the CSS size.
 */
import { readdir, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'scripts/og/stills');

const argv = process.argv.slice(2);
const flag = (name, dflt) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv.splice(i, 2)[1] : dflt; };
const SITE = flag('site', 'http://localhost:4321').replace(/\/$/, '');
const CDP = flag('cdp', '9222');
const ONLY = argv;
const ATTEMPTS = 12;

// Each driver runs in the page with helpers for its figure, and returns
// { ok, state }: whether the figure shows what it should, and a line for the log.
const FIGURES = {
  // Value iteration, swept until the largest change is under 0.0001.
  '01': async ({ $, click, text, until }) => {
    click('[data-reset]');
    click('[data-run]');
    await until(() => $('[data-run]').getAttribute('aria-pressed') === 'false');
    return { ok: text('[data-delta]').includes('stops'), state: `${text('[data-k]')} sweeps, start square worth ${text('[data-vstart]')}` };
  },
  // REINFORCE with the baseline and the payout rates shown, after 200 pulls: the
  // 70% machine should be well ahead.
  '02': async ({ fig, $, click }) => {
    for (const sel of ['[data-baseline]', '[data-rates]']) if (!$(sel).checked) $(sel).click();
    click('[data-reset]');
    click('[data-hundred]', 2);
    const arms = [...fig.querySelectorAll('[data-arm]')].map((g) => ({ rate: g.querySelector('[data-rate]').textContent, pct: parseFloat(g.querySelector('[data-pct]').textContent) }));
    const best = arms.find((a) => a.rate === 'pays 70%');
    return { ok: arms.every((a) => a === best || a.pct < best.pct) && best.pct >= 80, state: arms.map((a) => `${a.rate}: ${a.pct}%`).join(', ') };
  },
  // Q-learning, 200 episodes.
  '03': async ({ click, text }) => {
    click('[data-reset]');
    click('[data-fast]', 4);
    return { ok: parseInt(text('[data-wins]')) >= 18, state: `${text('[data-episodes]')} episodes, reached the goal in the last 20: ${text('[data-wins]')}` };
  },
  // Actor-critic, 200 episodes, the last of them reaching the goal.
  '04': async ({ click, text }) => {
    click('[data-reset]');
    click('[data-fast]', 4);
    const line = text('[data-line]');
    return { ok: line.startsWith('Last episode: reached the goal') && parseInt(text('[data-wins]')) >= 18, state: `${text('[data-episodes]')} episodes, reached the goal in the last 20: ${text('[data-wins]')}. ${line}` };
  },
  // PPO's clipped objective with A = +1 and ε = 0.2, r moved past 1 + ε onto the flat part.
  '06': async ({ fig, $, text }) => {
    fig.querySelector('[data-adv="1"]').click();
    fig.querySelector('[data-eps-choice="0.2"]').click();
    const r = $('[data-r]');
    r.value = '1.5';
    r.dispatchEvent(new Event('input', { bubbles: true }));
    return { ok: text('[data-s-clip]') === 'active', state: `r ${text('[data-s-r]')}, L ${text('[data-s-l]')}, clip ${text('[data-s-clip]')}` };
  },
  // The Bradley-Terry reward model after 500 labels, ranking the answers right.
  '09': async ({ click, text }) => {
    click('[data-reset]');
    click('[data-add="100"]', 5);
    return { ok: text('[data-rank]') === 'yes', state: `${text('[data-n]')} labels, ranking right ${text('[data-rank]')}, Spearman ${text('[data-rho]')}` };
  },
  // DPO at β = 0.5, trained for the 1,000 steps that Run goes to.
  '11': async ({ fig, click, text }) => {
    fig.querySelector('[data-beta-choice="0.5"]').click();
    click('[data-reset]');
    click('[data-train]', 100);
    return { ok: text('[data-step]') === '1000', state: `step ${text('[data-step]')}, loss ${text('[data-loss]')}, KL ${text('[data-kl]')}` };
  },
  // GRPO at K = 4, all 100 steps: 56 should end up with most of the probability.
  '15': async ({ fig, click, text }) => {
    fig.querySelector('[data-k-choice="4"]').click();
    click('[data-reset]');
    click('[data-step]', 100);
    return { ok: parseFloat(text('[data-pright]')) >= 0.9, state: `${text('[data-steps]')} steps, P(56) ${text('[data-pright]')}, taught nothing ${text('[data-zero]')} ${text('[data-zsplit]')}` };
  },
  // The combination lock after one press of Train 50: the bonus agent's last
  // episode reached the +1, the plain agent never has.
  '20': async ({ fig, click }) => {
    click('[data-reset]');
    click('[data-fast]');
    const agent = (key) => { const v = fig.querySelector(`[data-agent="${key}"]`); return { goals: Number(v.querySelector('[data-goals]').textContent), last: v.querySelector('[data-last]').textContent }; };
    const plain = agent('plain'), bonus = agent('bonus');
    return { ok: plain.goals === 0 && bonus.last === 'last episode: reached the +1', state: `plain: +1 in ${plain.goals} of 50; bonus: +1 in ${bonus.goals} of 50, ${bonus.last}` };
  },
};

// In the page before anything else runs: no IntersectionObserver callbacks, and
// a seeded Math.random (mulberry32) that window.__ogSeed(n) restarts.
const BEFORE_LOAD = `
  window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
  (() => {
    let s = 1;
    window.__ogSeed = (seed) => { s = seed >>> 0; };
    Math.random = () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), s | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })();
`;
const HELPERS = `
  const fig = document.querySelector('.lecture-figure figure');
  const $ = (sel) => fig.querySelector(sel);
  const click = (sel, times = 1) => { for (let i = 0; i < times; i++) $(sel).click(); };
  const text = (sel) => $(sel).textContent.trim();
  const until = async (ok, ms = 60000) => {
    const t0 = Date.now();
    while (!ok()) { if (Date.now() - t0 > ms) throw new Error('timed out'); await new Promise((r) => setTimeout(r, 100)); }
  };
`;
// The figure from a few px outside its left, top and right edges down to a few
// px above its caption, in page coordinates.
const CLIP = `(() => {
  const fig = document.querySelector('.lecture-figure figure');
  const box = fig.getBoundingClientRect(), cap = fig.querySelector('figcaption').getBoundingClientRect();
  const pad = 6;
  const x = Math.floor(box.left + scrollX - pad), y = Math.floor(box.top + scrollY - pad);
  return { x, y, width: Math.ceil(box.right + scrollX + pad) - x, height: Math.ceil(cap.top + scrollY - 4) - y };
})()`;

// A minimal Chrome DevTools Protocol client over Node's built-in WebSocket.
async function openTab() {
  const res = await fetch(`http://127.0.0.1:${CDP}/json/new?about:blank`, { method: 'PUT' });
  if (!res.ok) throw new Error(`Chrome on port ${CDP}: ${res.status} ${await res.text()}`);
  const target = await res.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = () => reject(new Error(`could not connect to ${target.webSocketDebuggerUrl}`)); });
  let seq = 0;
  const pending = new Map(), waiters = [];
  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
    } else if (msg.method) {
      for (const w of waiters.filter((x) => x.method === msg.method)) { waiters.splice(waiters.indexOf(w), 1); w.resolve(msg.params); }
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const once = (method) => new Promise((resolve) => waiters.push({ method, resolve }));
  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
    return result.value;
  };
  const close = async () => { ws.close(); await fetch(`http://127.0.0.1:${CDP}/json/close/${target.id}`).catch(() => {}); };
  return { send, once, evaluate, close };
}

async function lectureSlugs() {
  const files = await readdir(path.join(ROOT, 'src/generated/lectures')).catch(() => {
    throw new Error('src/generated/lectures is missing: run npm run sync (or a build) first');
  });
  return new Map(files.filter((f) => /^\d\d-.*\.md$/.test(f)).map((f) => [f.slice(0, 2), f.replace(/\.md$/, '')]));
}

const slugs = await lectureSlugs();
const todo = (ONLY.length ? ONLY : Object.keys(FIGURES)).sort();
for (const n of todo) if (!FIGURES[n]) throw new Error(`no figure for lecture ${n}; figures: ${Object.keys(FIGURES).join(', ')}`);
await mkdir(OUT, { recursive: true });

const tab = await openTab();
let failed = 0;
try {
  await tab.send('Page.enable');
  await tab.send('Runtime.enable');
  await tab.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 2, mobile: false });
  await tab.send('Page.addScriptToEvaluateOnNewDocument', { source: BEFORE_LOAD });

  for (const n of todo) {
    const url = `${SITE}/posts/${slugs.get(n)}/`;
    const loaded = tab.once('Page.loadEventFired');
    await tab.send('Page.navigate', { url });
    await loaded;
    await tab.evaluate(`document.fonts.ready.then(() => {
      const style = document.createElement('style');
      style.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; }';
      document.head.appendChild(style);
      return !!document.querySelector('.lecture-figure figure figcaption');
    })`).then((found) => { if (!found) throw new Error(`${url} has no lecture figure`); });

    let result;
    for (let seed = 1; seed <= ATTEMPTS; seed++) {
      result = await tab.evaluate(`(async () => { window.__ogSeed(${seed}); ${HELPERS} return (${FIGURES[n].toString()})({ fig, $, click, text, until }); })()`);
      if (result.ok) { result.seed = seed; break; }
      console.log(`  ${n}: seed ${seed} not shown (${result.state}), trying the next`);
    }
    if (!result.ok) { console.error(`${n}: nothing worth showing in ${ATTEMPTS} tries; still not written`); failed++; continue; }

    await tab.evaluate('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))');
    const clip = await tab.evaluate(CLIP);
    const { data } = await tab.send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 1 }, captureBeyondViewport: true });
    const png = Buffer.from(data, 'base64');
    await writeFile(path.join(OUT, `${n}.png`), png);
    console.log(`${n}: ${result.state} (seed ${result.seed}); ${png.readUInt32BE(16)}x${png.readUInt32BE(20)}, ${png.length} bytes`);
  }
} finally {
  await tab.close();
}
if (failed) process.exit(1);
