#!/usr/bin/env node
/**
 * Render public/og-default.png, the share card every page points at
 * (og:image / twitter:image in BaseLayout.astro). 1200x630, set like the site:
 * cream paper, Alegreya, the yellow highlighter, and Figure 1's gridworld on
 * the right, shaded by the value of each square (value iteration on the same
 * layout, rewards, and discount as GridLearner.astro), so the card shows what
 * the agent ends up learning.
 *
 * Usage: node scripts/og-default.mjs   (commit the PNG; it isn't built in CI)
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const font = (pkg, file) => readFile(path.join(ROOT, 'node_modules/@fontsource', pkg, 'files', file));

const C = { paper: '#fbf8f1', box: '#fffdf8', ink: '#23201b', soft: '#4d483f', muted: '#7b7468', rule: '#dcd4c3', red: '#b23a2a', wall: '#3b362e', goal: '#2f6f3e' };

// Figure 1's grid: '.' empty, 'S' start, 'G' goal (+1), 'P' pit (-1), 'W' wall.
const LAYOUT = ['.....G', '.WW.P.', '....W.', '.WP...', 'S...W.'];
const rows = LAYOUT.length, cols = LAYOUT[0].length;
const at = (x, y) => LAYOUT[y][x];

// Value iteration with GridLearner's rewards: +1 goal, -1 pit, -0.02 a step, gamma 0.95.
const V = LAYOUT.map((r) => [...r].map(() => 0));
const moves = [[0, -1], [1, 0], [0, 1], [-1, 0]];
for (let sweep = 0; sweep < 200; sweep++) {
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    if ('GPW'.includes(at(x, y))) continue;
    V[y][x] = Math.max(...moves.map(([dx, dy]) => {
      let nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || at(nx, ny) === 'W') { nx = x; ny = y; }
      const t = at(nx, ny);
      return t === 'G' ? 1 : t === 'P' ? -1 : -0.02 + 0.95 * V[ny][nx];
    }));
  }
}
// Same shading as GridLearner: mix the paper toward green (good) or red (bad).
function shade(v) {
  const t = Math.max(-1, Math.min(1, v)), base = [255, 253, 248], to = t >= 0 ? [63, 138, 79] : [178, 58, 42], k = Math.abs(t) * 0.55;
  return `rgb(${base.map((b, i) => Math.round(b + (to[i] - b) * k)).join(',')})`;
}

// Satori wants an explicit display on every div; flex is its default model anyway.
const h = (type, style, ...children) => ({ type, props: { style: type === 'div' ? { display: 'flex', ...style } : style, children: children.flat() } });
const CELL = 72;

const grid = h('div', { display: 'flex', flexDirection: 'column', border: `2px solid ${C.ink}`, background: C.box },
  LAYOUT.map((row, y) => h('div', { display: 'flex' },
    [...row].map((ch, x) => {
      const fill = ch === 'W' ? C.wall : ch === 'G' ? shade(1) : ch === 'P' ? shade(-1) : shade(V[y][x]);
      const label = ch === 'G' ? h('div', { fontSize: 26, fontWeight: 800, color: C.goal }, '+1')
        : ch === 'P' ? h('div', { fontSize: 26, fontWeight: 800, color: C.red }, '−1')
        : ch === 'S' ? h('div', { width: 30, height: 30, borderRadius: 15, background: C.red, border: '3px solid #fff' })
        : '';
      return h('div', { width: CELL, height: CELL, display: 'flex', alignItems: 'center', justifyContent: 'center', background: fill, borderRight: x < cols - 1 ? `1px solid ${ch === 'W' ? C.wall : C.rule}` : 'none', borderBottom: y < rows - 1 ? `1px solid ${ch === 'W' ? C.wall : C.rule}` : 'none' }, label);
    }))));

const card = h('div', { width: 1200, height: 630, display: 'flex', alignItems: 'center', background: C.paper, padding: '0 72px', fontFamily: 'Alegreya', color: C.ink },
  h('div', { display: 'flex', flexDirection: 'column', width: 600, marginRight: 64 },
    h('div', { fontFamily: 'Alegreya SC', fontSize: 30, color: C.muted, letterSpacing: 1 }, 'study reinforcement learning'),
    h('div', { display: 'flex', flexWrap: 'wrap', fontSize: 74, fontWeight: 800, lineHeight: 1.04, marginTop: 14, letterSpacing: -1 },
      h('span', {}, 'Watch an agent learn, then '),
      h('span', { backgroundImage: 'linear-gradient(180deg, transparent 58%, rgba(255,213,79,0.6) 58%, rgba(255,213,79,0.6) 92%, transparent 92%)' }, 'build one'),
      h('span', {}, '.')),
    h('div', { fontFamily: 'Alegreya SC', fontSize: 30, color: C.muted, marginTop: 26, letterSpacing: 1 }, 'by Yad Konrad · rl.yad.codes'),
    h('div', { fontSize: 28, color: C.soft, marginTop: 18, lineHeight: 1.35 }, '34 lectures from MDPs to training language models, and 9 exercises with tests.')),
  h('div', { display: 'flex', flexDirection: 'column', alignItems: 'flex-end' },
    h('div', { fontFamily: 'Kalam', fontSize: 26, color: C.red, marginBottom: 10, transform: 'rotate(-2.5deg)' }, 'what it learns'),
    grid));

const svg = await satori(card, {
  width: 1200, height: 630,
  fonts: [
    { name: 'Alegreya', data: await font('alegreya', 'alegreya-latin-400-normal.woff'), weight: 400, style: 'normal' },
    { name: 'Alegreya', data: await font('alegreya', 'alegreya-latin-800-normal.woff'), weight: 800, style: 'normal' },
    { name: 'Alegreya SC', data: await font('alegreya-sc', 'alegreya-sc-latin-500-normal.woff'), weight: 500, style: 'normal' },
    { name: 'Kalam', data: await font('kalam', 'kalam-latin-400-normal.woff'), weight: 400, style: 'normal' },
  ],
});
const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
await writeFile(path.join(ROOT, 'public/og-default.png'), png);
console.log(`og-default: wrote public/og-default.png (${png.length} bytes)`);
