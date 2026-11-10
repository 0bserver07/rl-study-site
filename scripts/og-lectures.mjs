#!/usr/bin/env node
/**
 * Draw a share card for each lecture: public/og/lectures/<slug>.png, 1200x630,
 * which PostLayout sends as the lecture's og:image and twitter:image. Set like
 * og-default.mjs: cream paper, Alegreya, Alegreya SC labels. Each card has the
 * lecture number and track (with the track's colour), the title, and the
 * byline. A lecture with an interactive figure gets a still of it on the right
 * (scripts/og/stills/<NN>.png, made by og-stills.mjs); the others are text only,
 * with the lecture number set large in the track's colour.
 *
 * Usage: node scripts/og-lectures.mjs           every lecture
 *        node scripts/og-lectures.mjs 04 20     only these
 * The lectures come from src/generated/lectures, so run npm run sync (or a
 * build) first. Commit the PNGs; they aren't built in CI.
 */
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const LECTURES = path.join(ROOT, 'src/generated/lectures');
const STILLS = path.join(ROOT, 'scripts/og/stills');
const OUT = path.join(ROOT, 'public/og/lectures');
const font = (pkg, file) => readFile(path.join(ROOT, 'node_modules/@fontsource', pkg, 'files', file));

const W = 1200, H = 630;
const C = { paper: '#fbf8f1', box: '#fffdf8', ink: '#23201b', muted: '#7b7468', rule: '#dcd4c3' };
const LINE = 1.06;       // the title's line height, as in og-default
const MAX_LINES = 3;

const fonts = [
  { name: 'Alegreya', data: await font('alegreya', 'alegreya-latin-800-normal.woff'), weight: 800, style: 'normal' },
  { name: 'Alegreya SC', data: await font('alegreya-sc', 'alegreya-sc-latin-500-normal.woff'), weight: 500, style: 'normal' },
  // For the ε in lecture 20's title: satori looks in the other fonts for a glyph the first one lacks.
  { name: 'Alegreya Greek', data: await font('alegreya', 'alegreya-greek-800-normal.woff'), weight: 800, style: 'normal' },
];

// Satori wants an explicit display on every div; flex is its default model anyway.
const h = (type, style, ...children) => ({ type, props: { style: type === 'div' ? { display: 'flex', ...style } : style, children: children.flat() } });
// The width of each string set on one line in the given style, measured by
// laying them out with satori without drawing anything.
async function widths(strings, style) {
  const boxes = new Map();
  const probe = h('div', { width: W, height: H, flexDirection: 'column', alignItems: 'flex-start' },
    strings.map((s, i) => ({ ...h('div', { ...style, whiteSpace: 'nowrap', flexShrink: 0 }, s), key: i })));
  await satori(probe, { width: W, height: H, fonts, onNodeDetected: (n) => { if (n.key != null) boxes.set(Number(n.key), n.width); } });
  return strings.map((_, i) => boxes.get(i));
}

// ---- the lectures --------------------------------------------------------
const tracks = JSON.parse(await readFile(path.join(ROOT, 'src/study-tracks.json'), 'utf8'));
const files = (await readdir(LECTURES).catch(() => { throw new Error('src/generated/lectures is missing: run npm run sync (or a build) first'); })).filter((f) => f.endsWith('.md'));
const lectures = [];
for (const f of files.sort()) {
  const fm = (await readFile(path.join(LECTURES, f), 'utf8')).match(/^---\n([\s\S]*?)\n---/)[1];
  // sync-study.mjs writes every value as JSON
  const get = (k) => { const m = fm.match(new RegExp(`^${k}: (.*)$`, 'm')); return m ? JSON.parse(m[1]) : undefined; };
  const number = get('lectureNumber');
  if (!number) continue;
  const track = tracks.find((t) => t.id === get('track'));
  if (!track) throw new Error(`${f}: no track "${get('track')}" in src/study-tracks.json`);
  lectures.push({
    slug: f.replace(/\.md$/, ''),
    number,
    title: get('title').replace(/^Lecture \d\d:\s*/, ''), // as PostLayout shows it
    trackName: track.name,
    color: track.color,
    still: existsSync(path.join(STILLS, `${number}.png`)) ? path.join(STILLS, `${number}.png`) : null,
  });
}
const total = lectures.length;

// ---- pieces ----------------------------------------------------------------
const label = { fontFamily: 'Alegreya SC', fontWeight: 500, color: C.muted, letterSpacing: 1 };
const titleStyle = (size) => ({ fontFamily: 'Alegreya', fontWeight: 800, fontSize: size, lineHeight: LINE, letterSpacing: -size / 74, color: C.ink });

// "lecture 04 of 34 · Foundations", after a swatch in the track's colour, as on
// the lecture page. One line: the size steps down until it fits the width.
async function kicker(lec, width, size) {
  const text = `lecture ${lec.number} of ${total} · ${lec.trackName}`;
  const swatch = (s) => ({ size: Math.round(s * 0.7), gap: Math.round(s * 0.4) });
  while ((await widths([text], { ...label, fontSize: size }))[0] + swatch(size).size + swatch(size).gap > width) size -= 1;
  const { size: sw, gap } = swatch(size);
  return h('div', { ...label, fontSize: size, alignItems: 'center' },
    h('div', { width: sw, height: sw, borderRadius: 3, background: lec.color, marginRight: gap }),
    h('div', {}, text));
}
const byline = (size) => h('div', { ...label, fontSize: size }, 'by Yad Konrad · rl.yad.codes');

// Break the title into lines at spaces only (satori would also break after
// the hyphen in "self-improvement"), never starting a line with the " - " in
// "PPO - Proximal Policy Optimization" or ending one with "vs". Two lines are
// preferred while the size stays within 80% of max; past that, up to
// MAX_LINES. At each size, from max down in 2px steps: the fewest lines that
// fit the width, the most even of them.
async function setTitle(title, width, max, min) {
  const words = [];
  for (const w of title.split(/\s+/)) {
    if (w === '-' && words.length) words.push(`${words.pop()} -`);
    else if (words.at(-1) === 'vs') words.push(`${words.pop()} ${w}`);
    else words.push(w);
  }
  const n = words.length;
  const line = ([i, j]) => words.slice(i, j).join(' ');
  // every run of words [i, j) that could be a line
  const runs = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j <= n; j++) runs.push([i, j]);
  // all ways to cut words from..n into k lines
  const cuts = (from, k) => (k === 1 ? [[[from, n]]]
    : Array.from({ length: n - from - k + 1 }, (_, t) => from + t + 1).flatMap((to) => cuts(to, k - 1).map((rest) => [[from, to], ...rest])));
  const measured = new Map(); // size -> width of each run
  for (const [maxLines, floor] of [[2, Math.ceil(max * 0.8)], [MAX_LINES, min]]) {
    for (let size = max; size >= floor; size -= 2) {
      if (!measured.has(size)) measured.set(size, await widths(runs.map(line), titleStyle(size)));
      const wide = new Map(runs.map(([i, j], r) => [`${i}-${j}`, measured.get(size)[r]]));
      for (let k = 1; k <= Math.min(maxLines, n); k++) {
        let best = null;
        for (const ls of cuts(0, k)) {
          const longest = Math.max(...ls.map(([i, j]) => wide.get(`${i}-${j}`)));
          if (longest <= width && (!best || longest < best.longest)) best = { ls, longest };
        }
        if (!best) continue;
        const lines = best.ls.map(line);
        return { size, lines, el: h('div', { ...titleStyle(size), flexDirection: 'column' }, lines.map((l) => h('div', { whiteSpace: 'nowrap' }, l))) };
      }
    }
  }
  throw new Error(`"${title}" does not fit in ${MAX_LINES} lines of ${width}px even at ${min}px`);
}

// ---- the two layouts -------------------------------------------------------
// With a figure: the text on the left and the still on the right, in a box
// like the one it sits in on the page, under the page's "try it" label.
const FIG = { maxW: 480, maxH: 486, pad: 12, labelH: 24, gap: 8, right: 56, left: 72, between: 52 };
async function figureCard(lec) {
  const meta = await sharp(lec.still).metadata();
  const k = Math.min(FIG.maxW / meta.width, FIG.maxH / meta.height);
  const iw = Math.round(meta.width * k), ih = Math.round(meta.height * k);
  // Resized to exactly the size it's shown at, and placed on whole pixels
  // (centring an odd height would put it on a half pixel), so the card shows
  // it without resampling.
  const still = await sharp(lec.still).resize(iw, ih, { kernel: 'lanczos3' }).png().toBuffer();
  const boxW = iw + 2 * FIG.pad + 2, boxH = ih + 2 * FIG.pad + FIG.labelH + FIG.gap + 2;
  const textW = W - FIG.left - FIG.right - FIG.between - boxW;
  const title = await setTitle(lec.title, textW, 66, 40);
  const card = h('div', { width: W, height: H, alignItems: 'center', background: C.paper, padding: `0 ${FIG.right}px 0 ${FIG.left}px` },
    h('div', { flexDirection: 'column', width: textW },
      await kicker(lec, textW, 26),
      h('div', { marginTop: 16 }, title.el),
      h('div', { marginTop: 26 }, byline(26))),
    h('div', { flexDirection: 'column', marginLeft: 'auto', alignSelf: 'flex-start', marginTop: Math.floor((H - boxH) / 2), background: C.box, border: `1px solid ${C.rule}`, borderRadius: 3, padding: FIG.pad },
      h('div', { ...label, fontSize: 19, letterSpacing: 0.5, height: FIG.labelH, marginBottom: FIG.gap }, 'try it'),
      { type: 'img', props: { src: `data:image/png;base64,${still.toString('base64')}`, width: iw, height: ih, style: { width: iw, height: ih } } }));
  return { card, title, note: `still ${iw}x${ih}, text ${textW}px` };
}

// Without one: a wider text column, and the lecture number large on the right
// in the track's colour. Alegreya's figures are old-style, so a leading zero
// would sit at x-height ("o8"); the number is set without it. The text column
// stops 56px short of the number.
const NUM = { size: 260, gap: 56, side: 72, maxText: 780 };
async function textCard(lec) {
  const number = String(Number(lec.number));
  const numStyle = { fontFamily: 'Alegreya', fontWeight: 800, fontSize: NUM.size, color: lec.color, opacity: 0.8 };
  const [numW] = await widths([number], numStyle);
  const textW = Math.min(NUM.maxText, Math.floor(W - 2 * NUM.side - NUM.gap - numW));
  const title = await setTitle(lec.title, textW, 84, 48);
  const card = h('div', { width: W, height: H, alignItems: 'center', background: C.paper, padding: `0 ${NUM.side}px`, position: 'relative' },
    h('div', { ...numStyle, position: 'absolute', right: NUM.side, top: 0, height: H, alignItems: 'center' }, number),
    h('div', { flexDirection: 'column', width: textW },
      await kicker(lec, textW, 28),
      h('div', { marginTop: 18 }, title.el),
      h('div', { marginTop: 30 }, byline(28))));
  return { card, title, note: `text ${textW}px` };
}

// ---- draw ------------------------------------------------------------------
const only = process.argv.slice(2);
await mkdir(OUT, { recursive: true });
let largest = { bytes: 0 };
for (const lec of lectures) {
  if (only.length && !only.includes(lec.number)) continue;
  const { card, title, note } = lec.still ? await figureCard(lec) : await textCard(lec);
  const svg = await satori(card, { width: W, height: H, fonts });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
  await writeFile(path.join(OUT, `${lec.slug}.png`), png);
  if (png.length > largest.bytes) largest = { bytes: png.length, slug: lec.slug };
  console.log(`${lec.slug}: ${title.size}px "${title.lines.join(' / ')}", ${note}; ${png.length} bytes`);
}
console.log(`og-lectures: wrote public/og/lectures/ (largest ${largest.slug}, ${largest.bytes} bytes)`);
