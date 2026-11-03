#!/usr/bin/env node
/**
 * sync-study.mjs
 *
 * Builds the site's content from the study repo (the `study/` submodule).
 * The study repo stays plain markdown for GitHub; everything the site needs
 * (frontmatter, curriculum order, link targets) is derived here at build time
 * and written to src/generated/, which is gitignored.
 *
 * Reads:  study/notes/lectures/*.md, study/CURRICULUM.md,
 *         study/exercises/README.md, study/readme.md,
 *         study/notes/cs294-2017/, study/notes/sutton-barto-digest/,
 *         study/notes/diagrams/svg/landscape.svg,
 *         src/study-tracks.json, src/study-videos.json, site-pages/*.md,
 *         RELEASES.md and package.json (the site's own version)
 * Writes: src/generated/lectures/*.md        (posts collection)
 *         src/generated/pages/*.md            (pages collection: curriculum,
 *                                              watch, about, notes)
 *         src/generated/study.json            (data for the home page)
 *         public/landscape.svg, public/study-assets/ (images the pages use)
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const STUDY = path.join(ROOT, 'study');
const OUT = path.join(ROOT, 'src', 'generated');
const ASSETS = path.join(ROOT, 'public', 'study-assets');
const REPO_URL = 'https://github.com/0bserver07/Study-Reinforcement-Learning';
const BRANCH = 'master';

const read = (rel) => fs.readFileSync(path.join(STUDY, rel), 'utf8');
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const tracks = readJson('src/study-tracks.json');
const videos = readJson('src/study-videos.json');

if (!fs.existsSync(path.join(STUDY, 'CURRICULUM.md'))) {
  console.error('sync-study: study/ is empty. Run `git submodule update --init` first.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Lectures on disk: number -> { slug, file }
// ---------------------------------------------------------------------------
const lectureFiles = fs.readdirSync(path.join(STUDY, 'notes', 'lectures'))
  .filter((f) => /^\d\d-.+\.md$/.test(f))
  .sort();
const lectures = new Map(lectureFiles.map((f) => [f.slice(0, 2), { slug: f.replace(/\.md$/, ''), file: f }]));

// The hand-written 2017 notes get their own pages.
const HANDWRITTEN = [
  { dir: 'notes/cs294-2017', slug: 'notes/cs294-2017', title: 'CS 294 Deep RL notes (Berkeley, spring 2017)', description: 'Notes taken while taking the course, kept as written.' },
  { dir: 'notes/sutton-barto-digest', slug: 'notes/sutton-barto-digest', title: 'Elements of RL (from Sutton & Barto, 2017)', description: 'A short digest of the four elements of an RL system, kept as written.' },
];

// ---------------------------------------------------------------------------
// Every document in the study repo that gets a page on the site, by its path
// in the repo. Links between them are rewritten to these routes; anything not
// listed links to GitHub.
// ---------------------------------------------------------------------------
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const listDir = (rel) => fs.readdirSync(path.join(STUDY, rel), { withFileTypes: true });
const exerciseDirs = listDir('exercises').filter((d) => d.isDirectory() && /^\d\d-/.test(d.name)).map((d) => d.name).sort();
const homeworkDirs = listDir('homework').filter((d) => d.isDirectory() && /^hw\d\d-/.test(d.name)).map((d) => d.name).sort();
const cheatSheets = listDir('notes/cheat-sheets').filter((d) => d.isFile() && d.name.endsWith('.md')).map((d) => d.name).sort();
const paperTopics = listDir('reference/papers').filter((d) => d.isDirectory()).map((d) => d.name).sort();
const ROUTE = new Map([
  ['readme.md', '/'],
  ['CURRICULUM.md', '/curriculum/'],
  ['CHANGELOG.md', '/changelog/'],
  ['AGENTS.md', '/agents/'],
  ['notes/README.md', '/library/'],
  ['exercises/README.md', '/exercises/'],
  ['homework/README.md', '/homework/'],
  ['notes/diagrams/RL-Algorithm-Diagrams.md', '/diagrams/'],
  ['reference/papers/README.md', '/reading/'],
]);
for (const f of lectureFiles) ROUTE.set(`notes/lectures/${f}`, `/posts/${f.replace(/\.md$/, '')}/`);
for (const n of HANDWRITTEN) ROUTE.set(`${n.dir}/readme.md`, `/${n.slug}/`);
for (const d of exerciseDirs) {
  ROUTE.set(`exercises/${d}/README.md`, `/exercises/${d}/`);
  ROUTE.set(`exercises/${d}/HINTS.md`, `/exercises/${d}/#hints`);
}
for (const d of homeworkDirs) {
  ROUTE.set(`homework/${d}/README.md`, `/homework/${d}/`);
  if (fs.existsSync(path.join(STUDY, 'homework', d, 'problems.md'))) ROUTE.set(`homework/${d}/problems.md`, `/homework/${d}/problems/`);
  if (fs.existsSync(path.join(STUDY, 'homework', d, 'solutions.md'))) ROUTE.set(`homework/${d}/solutions.md`, `/homework/${d}/solutions/`);
}
for (const f of cheatSheets) ROUTE.set(`notes/cheat-sheets/${f}`, `/cheat-sheets/${slugify(f.replace(/\.md$/, ''))}/`);
for (const d of paperTopics) {
  if (fs.existsSync(path.join(STUDY, 'reference/papers', d, 'README.md'))) ROUTE.set(`reference/papers/${d}/README.md`, `/reading/${slugify(d)}/`);
  if (fs.existsSync(path.join(STUDY, 'reference/papers', d, 'PAPERS.md'))) ROUTE.set(`reference/papers/${d}/PAPERS.md`, `/reading/${slugify(d)}/papers/`);
}
// folders that have an index page of their own
const DIR_ROUTE = new Map([
  ['notes/cheat-sheets', '/cheat-sheets/'],
  ['notes/diagrams', '/diagrams/'],
  ['notes/lectures', '/library/#lectures'],
  ['notes', '/library/'],
]);

// ---------------------------------------------------------------------------
// CURRICULUM.md: blocks and table rows give the reading order, prerequisites,
// time, and the checkpoint for each lecture.
// ---------------------------------------------------------------------------
const curriculum = read('CURRICULUM.md');
const order = [];
const rows = new Map();
let block = '';
for (const line of curriculum.split('\n')) {
  const h = line.match(/^## (Block \d+: .+)$/);
  if (h) { block = h[1]; continue; }
  const m = line.match(/^\|\s*(\d\d): ([^|]+?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|\s*(.*?)\s*\|\s*$/);
  if (!m || !lectures.has(m[1])) continue;
  const [, num, name, prereqText, time, checkpoint] = m;
  const [required] = prereqText.split(/helpful:/);
  order.push(num);
  rows.set(num, {
    name,
    block,
    time,
    prereqText,
    prereqs: [...required.matchAll(/\b(\d\d)\b/g)].map((x) => x[1]).filter((n) => lectures.has(n)),
    checkpoint,
  });
}
const missing = [...lectures.keys()].filter((n) => !rows.has(n));
if (missing.length) console.warn(`sync-study: not in CURRICULUM.md, appended at the end: ${missing.join(', ')}`);
order.push(...missing);

// ---------------------------------------------------------------------------
// exercises/README.md: which exercise goes with which lecture.
// ---------------------------------------------------------------------------
const exercises = new Map();
for (const m of read('exercises/README.md').matchAll(/\[`([^`]+?)\/?`\]\(\.\/[^)]+\):\s*([^|]+?)\s*\|\s*Lecture (\d\d)/g)) {
  exercises.set(m[3], { name: m[1], what: m[2], url: `/exercises/${m[1]}/` });
}

// ---------------------------------------------------------------------------
// Link rewriting. Links to lectures, CURRICULUM.md, and the hand-written notes
// become site routes; images are copied into public/study-assets/; anything
// else in the repo points at GitHub.
// ---------------------------------------------------------------------------
function siteUrlFor(relPath, anchor) {
  const withAnchor = (route) => (anchor && !route.includes('#') ? route + anchor : route);
  for (const candidate of [relPath, `${relPath}/README.md`, `${relPath}/readme.md`]) {
    if (ROUTE.has(candidate)) return withAnchor(ROUTE.get(candidate));
  }
  if (DIR_ROUTE.has(relPath)) return DIR_ROUTE.get(relPath);
  const abs = path.join(STUDY, relPath);
  if (!fs.existsSync(abs)) return null;
  const kind = fs.statSync(abs).isDirectory() ? 'tree' : 'blob';
  return `${REPO_URL}/${kind}/${BRANCH}/${relPath}${anchor}`;
}

function assetUrlFor(relPath) {
  const src = path.join(STUDY, relPath);
  if (!fs.existsSync(src)) return null;
  const dest = path.join(ASSETS, relPath);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return `/study-assets/${relPath}`;
}

function rewriteLinks(markdown, srcDir, unresolved) {
  // Leave fenced code blocks alone, and inline code spans and escaped brackets
  // (`S[π](s_t)`, S\[π](s_t)), which are text that only looks like a link.
  return markdown.split(/(^\s*```[\s\S]*?^\s*```)/m).map((part, i) => {
    if (i % 2 === 1) return part;
    return part.replace(/(`+)[^\n]*?\1|(?<!\\)(!?)\[([^\]]*)\]\(([^)\s]+)\)/g, (whole, ticks, bang, text, url) => {
      if (ticks) return whole;
      if (/^(https?:|mailto:|#)/.test(url)) return whole;
      const [target, hash] = url.split('#');
      const anchor = hash ? `#${hash}` : '';
      const relPath = path.posix.normalize(path.posix.join(srcDir, target)).replace(/\/$/, '');
      const to = bang ? assetUrlFor(relPath) : siteUrlFor(relPath, anchor);
      if (!to) { unresolved.push(url); return whole; }
      return `${bang}[${text}](${to})`;
    });
  }).join('');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const yaml = (v) => JSON.stringify(v); // JSON strings and arrays are valid YAML
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const git = (...args) => {
  try { return execFileSync('git', ['-C', STUDY, ...args], { encoding: 'utf8' }).trim(); }
  catch { return ''; }
};
function firstParagraph(body) {
  for (const para of body.split(/\n\s*\n/)) {
    const p = para.trim();
    if (!p || /^(#|---|\*\*(Time|Duration|Prerequisites?):?\*\*|```|\||>|- |\d+\. |<)/.test(p)) continue;
    const text = p.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[*`]/g, '').replace(/(^|\W)_+(?=\w)|(?<=\w)_+(?=\W|$)/g, '$1').replace(/\s+/g, ' ').replace(/^Goal: /, '');
    if (text.length <= 220) return text;
    const cut = text.slice(0, 220);
    return cut.slice(0, cut.lastIndexOf(' ')) + '…';
  }
  return '';
}
const trackOf = new Map(tracks.flatMap((t) => t.lectures.map((n) => [n, t])));
// "2–3 h" -> 2.5, "~3 h" -> 3, "3–4 h + exercise" -> 3.5 (CURRICULUM.md's estimates)
function hoursOf(time) {
  const range = time.match(/(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)\s*h/);
  if (range) return (Number(range[1]) + Number(range[2])) / 2;
  const one = time.match(/(\d+(?:\.\d+)?)\s*h/);
  return one ? Number(one[1]) : 0;
}
const EXERCISE_HOURS = 2; // exercises/README.md: "a couple of hours each"
function writePage(slug, frontmatter, body) {
  const file = path.join(OUT, 'pages', `${slug}.md`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const fm = Object.entries(frontmatter).map(([k, v]) => `${k}: ${yaml(v)}`).join('\n');
  fs.writeFileSync(file, `---\n${fm}\n---\n\n${body.trim()}\n`);
}

// YouTube: lazy, privacy-enhanced embeds, and thumbnail cards that link out.
const ytEmbed = (id, title) =>
  `<div class="video-embed"><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="${esc(title)}" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>`;
const ytPlaylist = (list, title) =>
  `<div class="video-embed"><iframe src="https://www.youtube-nocookie.com/embed/videoseries?list=${list}" title="${esc(title)}" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>`;
const ytCard = (id, title) =>
  `<a class="video-card" href="https://www.youtube.com/watch?v=${id}"><img src="https://i.ytimg.com/vi/${id}/mqdefault.jpg" alt="" loading="lazy" width="320" height="180" data-gallery-image="skip"><span>${esc(title)}</span></a>`;

// ---------------------------------------------------------------------------
// Start clean
// ---------------------------------------------------------------------------
fs.rmSync(OUT, { recursive: true, force: true });
fs.rmSync(ASSETS, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'lectures'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'pages'), { recursive: true });
// The theme's projects and docs collections are unused on this site; give
// them empty folders so their routes build with nothing in them.
fs.mkdirSync(path.join(OUT, 'projects'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'docs'), { recursive: true });

// ---------------------------------------------------------------------------
// Lectures
// ---------------------------------------------------------------------------
const summary = [];
let unresolvedTotal = 0;
for (const [i, num] of order.entries()) {
  const { slug, file } = lectures.get(num);
  const rel = `notes/lectures/${file}`;
  const raw = read(rel);
  const lines = raw.split('\n');

  const statusMatch = raw.match(/<!--\s*status:\s*([a-z-]+)\s*\|\s*last-reviewed:\s*([^\s>]+)\s*-->/);
  const titleLine = lines.find((l) => /^# /.test(l)) || `# Lecture ${num}`;
  const title = titleLine.replace(/^# /, '').trim();

  // Drop what the layout shows itself: the status comment, the H1, the
  // one-line "Unreviewed: ..." note (the layout renders a status badge), and
  // the lecture's own "**Time** ... **Prerequisites** ..." line. The layout
  // shows time and prerequisites from CURRICULUM.md, and the two disagree in
  // places (lecture 06 says 5-6 hours, CURRICULUM.md says 2-3 h), so showing
  // both on one page would contradict itself.
  let body = lines
    .filter((l) => l !== titleLine)
    .filter((l) => !/^<!--\s*status:/.test(l))
    .filter((l) => !/^_Unreviewed: .*_$/.test(l))
    .filter((l) => !/^\*\*(Time|Duration|Prerequisites?):?\*\*/.test(l))
    .join('\n')
    .replace(/^\s+/, '');

  const unresolved = [];
  body = rewriteLinks(body, 'notes/lectures', unresolved);
  if (unresolved.length) {
    unresolvedTotal += unresolved.length;
    console.warn(`sync-study: ${file}: left ${unresolved.length} unresolved link(s): ${unresolved.join(', ')}`);
  }

  const row = rows.get(num) || {};
  const track = trackOf.get(num);
  const exercise = exercises.get(num);
  const planted = git('log', '--follow', '--diff-filter=A', '--format=%as', '--', rel).split('\n').pop() || '2025-11-12';
  const tended = git('log', '-1', '--format=%as', '--', rel) || planted;
  const prev = order[i - 1] ? lectures.get(order[i - 1]).slug : '';
  const next = order[i + 1] ? lectures.get(order[i + 1]).slug : '';
  const checkpoint = row.checkpoint ? rewriteLinks(row.checkpoint, '', []) : '';

  const fm = [
    '---',
    `title: ${yaml(title)}`,
    `description: ${yaml(firstParagraph(body))}`,
    `planted: ${planted}`,
    `lastTended: ${tended}`,
    `growth: "seedling"`,
    `growthLocked: true`,
    `tags: ${yaml(track ? [track.id] : [])}`,
    `lectureNumber: ${yaml(num)}`,
    `status: ${yaml(statusMatch ? statusMatch[1] : 'unreviewed')}`,
    `lastReviewed: ${yaml(statusMatch ? statusMatch[2] : 'never')}`,
    `track: ${yaml(track ? track.id : '')}`,
    `trackName: ${yaml(track ? track.name : '')}`,
    `order: ${i + 1}`,
    `block: ${yaml(row.block || '')}`,
    `time: ${yaml(row.time || '')}`,
    `prereqs: ${yaml((row.prereqs || []).map((n) => lectures.get(n).slug))}`,
    `prereqsText: ${yaml(row.prereqText || '')}`,
    `checkpoint: ${yaml(checkpoint)}`,
    `exercise: ${yaml(exercise ? exercise.url : '')}`,
    `exerciseName: ${yaml(exercise ? `${exercise.name}: ${exercise.what}` : '')}`,
    `videos: ${yaml(videos.byLecture[num] || [])}`,
    `prev: ${yaml(prev)}`,
    `next: ${yaml(next)}`,
    `source: ${yaml(`${REPO_URL}/blob/${BRANCH}/${rel}`)}`,
    '---',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(OUT, 'lectures', `${slug}.md`), fm + body);

  summary.push({
    num, slug, title, order: i + 1, time: row.time || '', status: statusMatch ? statusMatch[1] : 'unreviewed',
    track: track ? track.id : '', block: row.block || '', exercise: exercise ? exercise.url : '',
    videos: videos.byLecture[num] || [],
    hours: hoursOf(row.time || ''),
    checkpoint,
    exerciseName: exercise ? `${exercise.name}: ${exercise.what}` : '',
    prereqs: (row.prereqs || []).map((n) => lectures.get(n).slug),
  });
}

// ---------------------------------------------------------------------------
// Curriculum page
// ---------------------------------------------------------------------------
const curriculumBody = rewriteLinks(
  curriculum.split('\n').filter((l) => !/^# /.test(l)).join('\n').replace(/^\s+/, ''),
  '',
  [],
)
  // On the site, each step's name links to its lecture page.
  .replace(/^\|\s*(\d\d): ([^|]+?)\s*\|/gm, (row, num, name) =>
    lectures.has(num) ? `| [${num}: ${name}](/posts/${lectures.get(num).slug}/) |` : row);
writePage('curriculum', {
  title: 'Curriculum',
  description: 'The order to go through the lectures, with prerequisites, rough time, and a checkpoint for each.',
}, curriculumBody);

// ---------------------------------------------------------------------------
// Hand-written notes (2017), shown as written, plus a small index page
// ---------------------------------------------------------------------------
for (const n of HANDWRITTEN) {
  const rel = `${n.dir}/readme.md`;
  const raw = read(rel).replace(/^<!--[\s\S]*?-->\s*/, '');
  const note = `<p class="study-status study-status-hand-written text-sm rounded-lg px-3 py-2">Hand-written in 2017 while learning, and kept as written. <a href="${REPO_URL}/blob/${BRANCH}/${rel}">Source on GitHub</a>.</p>`;
  // The contents list links to #lec0, #lec1, ...; the targets are written <a name='#lec0'>,
  // which browsers don't match. Give each target the id the list expects; the text is untouched.
  const anchored = raw.replace(/<a name=(['"])#([\w-]+)\1>/g, '<a id="$2">');
  writePage(n.slug, { title: n.title, description: n.description }, `${note}\n\n${rewriteLinks(anchored, n.dir, [])}`);
}
writePage('notes', {
  title: 'Notes from 2017',
  description: 'Hand-written notes from learning RL in 2017. Trusted, informal, and kept exactly as written.',
}, HANDWRITTEN.map((n) => `- [${n.title}](/${n.slug}/): ${n.description}`).join('\n'));

// ---------------------------------------------------------------------------
// Watch page: verified videos, then the original 2016 list from readme.md
// ---------------------------------------------------------------------------
const readme = read('readme.md');
const original = (readme.match(/## Talks to start with[\s\S]*?(?=\n## Some landmark papers|\n## Communities|$)/) || [''])[0];
const watch = [];
watch.push(`Video courses for the material on this site. Each lecture page also links the videos that match it. Every video below was checked on ${videos.checked}.`);
for (const c of videos.courses) {
  watch.push(`## ${c.title}`);
  watch.push(`${c.blurb}${c.playlist ? ` [Open the playlist on YouTube](https://www.youtube.com/playlist?list=${c.playlist}).` : ''}`);
  if (c.videos) {
    watch.push(ytEmbed(c.videos[0].id, c.videos[0].title));
    watch.push(`<div class="video-grid">${c.videos.map((v) => ytCard(v.id, v.title)).join('')}</div>`);
  } else if (c.playlist) {
    watch.push(ytPlaylist(c.playlist, c.title));
  } else if (c.first) {
    watch.push(ytEmbed(c.first.id, c.first.title));
  }
}
watch.push('## Older recordings');
watch.push(videos.older.map((o) => `- [${o.title}](${o.url})`).join('\n'));
watch.push(videos.unavailable.map((o) => `- [${o.title}](${o.url})`).join('\n')
  + `\n\nThe two 2016 talks above were the first things on this repo's list. Their videolectures.net pages returned 403 when checked on ${videos.checked}, so they may not play.`);
watch.push('## The original list, from 2016');
watch.push('The talks, books, and courses this repo started with, including notes from the talks. Kept as written.');
watch.push(rewriteLinks(original.replace(/^## /gm, '### '), '', []));
writePage('watch', {
  title: 'Watch',
  description: 'Video courses and talks for learning RL, and the list this repo started with in 2016.',
}, watch.join('\n\n'));

// ---------------------------------------------------------------------------
// Everything else a learner reads: exercises, homework, cheat sheets,
// diagrams, reading lists, the changelog, AGENTS.md, and a library index.
// ---------------------------------------------------------------------------
const gh = (rel) => `${REPO_URL}/blob/${BRANCH}/${rel}`;
function parseDoc(rel) {
  const raw = read(rel);
  const status = (raw.match(/<!--\s*status:\s*([a-z-]+)/) || [])[1] || '';
  const h1 = (raw.match(/^# (.+)$/m) || [])[1] || path.posix.basename(rel, '.md');
  const body = raw
    .replace(/^<!--[\s\S]*?-->\s*/, '')
    .replace(/^# .+\n/m, '')
    .replace(/^_Unreviewed: .*_\s*$/m, '')
    .replace(/^\s+/, '');
  return { status, title: h1.replace(/`/g, '').trim(), body };
}
function statusHtml(status, rel) {
  if (status === 'unreviewed') {
    return `<p class="bk-status"><span class="bk-stamp">unreviewed draft</span>No one has checked this end to end. Treat the math, code, and citations as unverified. <a href="${gh(rel)}">Source on GitHub</a>.</p>`;
  }
  if (status === 'hand-written' || status === 'reviewed') {
    return `<p class="bk-status"><span class="bk-stamp ok">${status}</span><a href="${gh(rel)}">Source on GitHub</a>.</p>`;
  }
  return '';
}
const sourceLine = (rel) => `<p class="bk-meta">Source: <a href="${gh(rel)}">${rel}</a> on GitHub.</p>`;
function writeDoc(rel, slug, { title, description, before = '', after = '' } = {}) {
  const doc = parseDoc(rel);
  const unresolved = [];
  const body = rewriteLinks(doc.body, path.posix.dirname(rel), unresolved);
  if (unresolved.length) {
    unresolvedTotal += unresolved.length;
    console.warn(`sync-study: ${rel}: left ${unresolved.length} unresolved link(s): ${unresolved.join(', ')}`);
  }
  const head = statusHtml(doc.status, rel);
  writePage(slug, { title: title || doc.title, description: description || firstParagraph(doc.body) }, [head, before, body, after, head ? '' : sourceLine(rel)].filter(Boolean).join('\n\n'));
  return title || doc.title;
}

// exercises
const exerciseTitles = new Map();
writeDoc('exercises/README.md', 'exercises', { title: 'Exercises', description: 'Small coding exercises with pytest tests, graduated hints, and reference solutions. They run on a laptop CPU.' });
for (const d of exerciseDirs) {
  const base = `exercises/${d}`;
  const files = fs.readdirSync(path.join(STUDY, base));
  const testFile = files.find((f) => /^test_.*\.py$/.test(f));
  const nTests = testFile ? (read(`${base}/${testFile}`).match(/^def test_/gm) || []).length : 0;
  const listed = [...exercises.values()].find((e) => e.name === d);
  if (listed) listed.tests = nTests;
  const solutionFile = fs.existsSync(path.join(STUDY, base, 'solution'))
    ? fs.readdirSync(path.join(STUDY, base, 'solution')).find((f) => f.endsWith('.py')) : '';
  let after = '';
  if (files.includes('starter.py')) {
    after += `## Starter code\n\nThis is the file you edit. The TODOs are yours.\n\n<details>\n<summary>Show <code>starter.py</code></summary>\n\n\`\`\`python\n${read(`${base}/starter.py`).trimEnd()}\n\`\`\`\n\n</details>\n\n`;
  }
  if (files.includes('HINTS.md')) {
    const parts = read(`${base}/HINTS.md`).replace(/^# .+\n/m, '').split(/\n-{3,}\n/);
    const intro = parts.shift().trim();
    after += `## Hints\n\n${intro}\n\n` + parts.map((h, i) => {
      const chunk = h.trim();
      const m = chunk.match(/^\*\*(Hint \d+[^*]*?)\.?\*\*\s*/);
      const summary = (m ? m[1] : `Hint ${i + 1}`).replace(/`/g, '');
      const content = m ? chunk.slice(m[0].length) : chunk;
      return `<details>\n<summary>${esc(summary)}</summary>\n\n${rewriteLinks(content, base, [])}\n\n</details>`;
    }).join('\n\n') + '\n\n';
  }
  after += `## Files\n\n`
    + (files.includes('starter.py') ? `- [\`starter.py\`](${gh(`${base}/starter.py`)}): the file you edit.\n` : '')
    + (testFile ? `- [\`${testFile}\`](${gh(`${base}/${testFile}`)}): ${nTests} tests. Run them from the repo root with \`pytest ${base}/\`.\n` : '')
    + (solutionFile ? `- [\`solution/${solutionFile}\`](${gh(`${base}/solution/${solutionFile}`)}): the reference solution. Open it when you decide to, not before.\n` : '');
  exerciseTitles.set(d, writeDoc(`${base}/README.md`, `exercises/${d}`, { after }));
}

// homework
writeDoc('homework/README.md', 'homework', { title: 'Homework', description: 'Problem sets in the style of a university RL course: theory, coding, and reading.' });
const homeworkTitles = new Map();
for (const d of homeworkDirs) {
  const base = `homework/${d}`;
  homeworkTitles.set(d, writeDoc(`${base}/README.md`, `homework/${d}`));
  if (ROUTE.has(`${base}/problems.md`)) writeDoc(`${base}/problems.md`, `homework/${d}/problems`);
  if (ROUTE.has(`${base}/solutions.md`)) {
    writeDoc(`${base}/solutions.md`, `homework/${d}/solutions`, { before: '<p class="bk-meta">Try every problem before you read these.</p>' });
  }
}

// cheat sheets, diagrams
const sheetTitles = new Map();
for (const f of cheatSheets) {
  const slug = `cheat-sheets/${slugify(f.replace(/\.md$/, ''))}`;
  sheetTitles.set(f, writeDoc(`notes/cheat-sheets/${f}`, slug));
}
writePage('cheat-sheets', { title: 'Cheat sheets', description: 'Quick reference: formulas, losses, KL control, and the training loops side by side.' },
  cheatSheets.map((f) => `- [${sheetTitles.get(f)}](${ROUTE.get(`notes/cheat-sheets/${f}`)})`).join('\n'));
const diagramsTitle = writeDoc('notes/diagrams/RL-Algorithm-Diagrams.md', 'diagrams', { description: 'The main algorithms as diagrams: MDPs, policy gradients, actor-critic, PPO, RLHF, DPO, GRPO.' });

// reading lists
writeDoc('reference/papers/README.md', 'reading', { title: 'Reading lists', description: 'Papers by topic, with identifiers you can check.' });
const readingTitles = new Map();
for (const d of paperTopics) {
  if (ROUTE.has(`reference/papers/${d}/README.md`)) readingTitles.set(d, writeDoc(`reference/papers/${d}/README.md`, `reading/${slugify(d)}`));
  if (ROUTE.has(`reference/papers/${d}/PAPERS.md`)) {
    writeDoc(`reference/papers/${d}/PAPERS.md`, `reading/${slugify(d)}/papers`, {
      title: `All collected papers: ${d.replace(/-/g, ' ')}`,
      before: '<p class="bk-meta">Collected automatically from arXiv by the repo\'s paper collector. A search index, not a curated list.</p>',
    });
  }
}

// changelog, agents
writeDoc('CHANGELOG.md', 'changelog', { title: 'Changelog', description: 'What moved in the study repo, and why.' });
writeDoc('AGENTS.md', 'agents', { title: 'Working with an AI tutor', description: 'How the repo is organized and how a coding agent should work in it. Point Claude Code or Codex here.' });

// the library: everything, in one place
const lib = [];
lib.push('Everything in the study repo, on one page. Lectures are grouped by track, in the order the curriculum suggests.');
lib.push('## Tracks');
lib.push(tracks.map((t, i) => `${i + 1}. [${t.name}](/tracks/${t.id}/): ${t.blurb}`).join('\n'));
lib.push('## Lectures');
for (const t of tracks) {
  const ls = summary.filter((l) => l.track === t.id);
  lib.push(`### ${t.name}`);
  lib.push(ls.map((l) => `- [${l.title}](/posts/${l.slug}/)${l.time ? `, ${l.time.replace(/\s*\+\s*exercise$/, '')}` : ''}${l.exercise ? ` · [exercise](${l.exercise})` : ''}`).join('\n'));
}
lib.push('## Exercises');
lib.push([...exercises.entries()].map(([num, e]) => `- [${e.name}](/exercises/${e.name}/): ${e.what} (with lecture ${num})`).join('\n'));
lib.push('## Homework');
lib.push(`- [How the homework works](/homework/)\n` + homeworkDirs.map((d) => {
  const extra = [ROUTE.has(`homework/${d}/problems.md`) && `[problems](/homework/${d}/problems/)`, ROUTE.has(`homework/${d}/solutions.md`) && `[solutions](/homework/${d}/solutions/)`].filter(Boolean);
  return `- [${homeworkTitles.get(d)}](/homework/${d}/)${extra.length ? `: ${extra.join(', ')}` : ' (planned)'}`;
}).join('\n'));
lib.push('## Cheat sheets');
lib.push(cheatSheets.map((f) => `- [${sheetTitles.get(f)}](${ROUTE.get(`notes/cheat-sheets/${f}`)})`).join('\n'));
lib.push('## Diagrams');
lib.push(`- [${diagramsTitle}](/diagrams/)`);
lib.push('## Reading lists');
lib.push(`- [Overview](/reading/)\n` + paperTopics.filter((d) => readingTitles.has(d)).map((d) =>
  `- [${readingTitles.get(d)}](/reading/${slugify(d)}/)${ROUTE.has(`reference/papers/${d}/PAPERS.md`) ? ` · [all collected papers](/reading/${slugify(d)}/papers/)` : ''}`).join('\n'));
lib.push('## Notes from 2017');
lib.push(HANDWRITTEN.map((n) => `- [${n.title}](/${n.slug}/)`).join('\n'));
lib.push('## Videos, the plan, and the repo');
lib.push(['- [Before you start](/start/)', '- [Watch: the video courses](/watch/)', '- [The curriculum, in order](/curriculum/)', '- [About and credit](/about/)', '- [Changelog](/changelog/)', '- [Releases of this site](/releases/)', '- [Working with an AI tutor (AGENTS.md)](/agents/)'].join('\n'));
writePage('library', { title: 'Library', description: 'Every lecture, exercise, homework set, cheat sheet, diagram, and reading list, in one place.' }, lib.join('\n\n'));

// ---------------------------------------------------------------------------
// Site-owned pages (site-pages/*.md), e.g. About
// ---------------------------------------------------------------------------
const sitePages = path.join(ROOT, 'site-pages');
if (fs.existsSync(sitePages)) {
  for (const f of fs.readdirSync(sitePages).filter((x) => x.endsWith('.md'))) {
    fs.copyFileSync(path.join(sitePages, f), path.join(OUT, 'pages', f));
  }
}
// The site's own release notes
if (fs.existsSync(path.join(ROOT, 'RELEASES.md'))) {
  const notes = fs.readFileSync(path.join(ROOT, 'RELEASES.md'), 'utf8').replace(/^# .+\n/, '');
  writePage('releases', { title: 'Releases', description: 'Versions of this site, and what changed in each.' }, notes);
}

// ---------------------------------------------------------------------------
// Home page data: the landscape paragraph from readme.md, the tracks, and
// every lecture in curriculum order.
// ---------------------------------------------------------------------------
const landscape = (readme.split('## The landscape')[1] || '').split('\n\n').map((p) => p.trim())
  .filter((p) => p && !p.startsWith('!['))
  .slice(0, 2)
  .map((p) => rewriteLinks(p, '', []));
// Track-to-track edges from lecture prerequisites. An edge is "solid" when the
// track's first lecture (in curriculum order) needs the other track, "dashed"
// when only a later lecture does. Edges already implied by a solid path are
// dropped, so the map shows the shortest story.
const trackIdOf = new Map(tracks.flatMap((t) => t.lectures.map((n) => [n, t.id])));
const firstOfTrack = new Map();
for (const n of order) { const t = trackIdOf.get(n); if (t && !firstOfTrack.has(t)) firstOfTrack.set(t, n); }
const rawEdges = new Map();
for (const n of order) {
  const to = trackIdOf.get(n);
  for (const p of rows.get(n)?.prereqs || []) {
    const from = trackIdOf.get(p);
    if (!from || !to || from === to) continue;
    const key = `${from}>${to}`;
    const e = rawEdges.get(key) || { from, to, solid: false, because: [] };
    if (n === firstOfTrack.get(to)) e.solid = true;
    e.because.push(`${p}→${n}`);
    rawEdges.set(key, e);
  }
}
const solidEdges = [...rawEdges.values()].filter((e) => e.solid);
const reachable = (a, b, skip) => {
  const seen = new Set([a]); const stack = [a];
  while (stack.length) {
    const x = stack.pop();
    for (const e of solidEdges) {
      if (e === skip || e.from !== x || seen.has(e.to)) continue;
      if (e.to === b) return true;
      seen.add(e.to); stack.push(e.to);
    }
  }
  return false;
};
const trackEdges = [...rawEdges.values()]
  .filter((e) => !reachable(e.from, e.to, e.solid ? e : null))
  .map((e) => ({ from: e.from, to: e.to, kind: e.solid ? 'solid' : 'dashed', because: e.because }));

const trackData = tracks.map((t) => {
  const ls = summary.filter((l) => l.track === t.id);
  const lectureHours = ls.reduce((s, l) => s + l.hours, 0);
  const exerciseCount = ls.filter((l) => l.exercise).length;
  return { ...t, lectureHours, exerciseCount, hours: lectureHours + EXERCISE_HOURS * exerciseCount, first: firstOfTrack.get(t.id) };
});
const totalHours = trackData.reduce((s, t) => s + t.hours, 0);

const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
fs.writeFileSync(path.join(OUT, 'study.json'), JSON.stringify({
  repo: REPO_URL,
  version: site.version,
  studyCommit: git('log', '-1', '--format=%h'),
  studyDate: git('log', '-1', '--format=%as'),
  landscape,
  tracks: trackData,
  trackEdges,
  totalHours,
  exerciseHours: EXERCISE_HOURS,
  library: {
    homework: homeworkDirs.length,
    cheatSheets: cheatSheets.length,
    readingLists: readingTitles.size,
    notes2017: HANDWRITTEN.length,
  },
  lectures: summary,
  exercises: [...exercises.entries()].map(([num, e]) => ({ num, ...e })),
  videoCourses: videos.courses,
}, null, 2));

fs.copyFileSync(path.join(STUDY, 'notes', 'diagrams', 'svg', 'landscape.svg'), path.join(ROOT, 'public', 'landscape.svg'));

const studyHead = git('log', '-1', '--format=%h %as');
const withVideos = summary.filter((l) => l.videos.length > 0).length;
console.log(`sync-study: ${summary.length} lectures (${withVideos} with videos), curriculum, watch, notes, ${exercises.size} exercises (study repo at ${studyHead}); ${unresolvedTotal} unresolved links`);
