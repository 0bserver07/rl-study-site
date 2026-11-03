# Study site

A site for [Study-Reinforcement-Learning](https://github.com/0bserver07/Study-Reinforcement-Learning), built on mycelium-theme v2.0.0. The study repo stays plain markdown for GitHub. This repo pulls it in as the `study/` submodule and derives everything the site needs at build time.

## How it fits together

- `study/` is the study repo (git submodule). Nothing in it is edited by the site.
- `scripts/sync-study.mjs` runs before `dev` and `build`. It reads the study repo and writes `src/generated/` (gitignored):
  - `lectures/*.md`: each lecture with generated frontmatter (title, review status, track, curriculum order, prerequisites, time, checkpoint, exercise, videos, previous/next, source link). The status comment, the H1, the "Unreviewed" line, and the lecture's own Time/Prerequisites line are dropped because the layout shows them.
  - `pages/*.md`: everything else a learner reads. `CURRICULUM.md` at `/curriculum/`, the exercises at `/exercises/<name>/` (README, starter code, hints one at a time, test count, solution link), homework at `/homework/`, cheat sheets at `/cheat-sheets/`, the diagrams collection at `/diagrams/`, reading lists at `/reading/`, `CHANGELOG.md` at `/changelog/`, `AGENTS.md` at `/agents/`, the 2017 notes at `/notes/`, the video courses at `/watch/`, and `/library/`, which lists all of it.
  - `study.json`: data for the home, start, and track pages, plus the site version and the study repo commit for the footer.
  - `public/landscape.svg` and `public/study-assets/` (images the pages use).
- Links inside the study repo are rewritten through one route table (`ROUTE` in the sync script), so a link between two files becomes a link between two pages. Anything without a page links to GitHub. The sync prints how many links it could not resolve.
- `src/study-tracks.json` defines the eight tracks: the six families on the landscape diagram, plus Foundations and Systems. Each has a page at `/tracks/<id>/` (`src/pages/tracks/[id].astro`).
- `src/landscape.json` is the clickable map (`src/components/LandscapeMap.astro`): each family with its three answers (reward, data, steps) and every method linked to the lecture that covers it. The SVG from the README is still served at `/landscape.svg`.
- `src/study-videos.json` lists the videos (David Silver's UCL course, CS 285, DeepMind x UCL 2018 and 2021). Every ID was checked against YouTube's oEmbed endpoint; `byLecture` maps lectures to videos whose titles name the topic. `/watch/` also shows the original 2016 list from `readme.md` as written.
- The 2017 hand-written notes are rendered unchanged. One render-time fix: their contents list links to `#lec0` and so on, but the targets are written `<a name='#lec0'>`, which browsers don't match, so the sync gives each target the id the list expects. The notes themselves are not edited.
- `site-pages/about.md` is the About page (a draft written from Yad's description; edit it directly). Anything in `site-pages/` is copied into the pages collection.
- `RELEASES.md` is rendered at `/releases/`.

## Pages

- `/`: the hub. A Q-learning agent learning a gridworld in the browser (`src/components/roadmap/GridLearner.astro`, the same algorithm as lecture 03 and exercise 03), then one topic in four steps (read, watch, build, check) using that same example, the nine exercises, the eight tracks, the landscape map, the eight rules, and an index of everything.
- `/start/`: what to know first with a self-check (remembered in the browser), the study planner, week one, and what to do when stuck.
- `/tracks/<id>/`: one page per track.
- `/posts/<slug>/`: the lectures. `/library/`: everything.

## Design

Set like a book, on purpose: earlier passes looked either copied (the abakcus.com roadmap article) or like a generic AI-generated site (Instrument Serif, Inter, uppercase mono labels, dark glowing sections, metrics panels, pill buttons). Yad asked for neither. What's here now:

- Type: Alegreya for text and headings (a calligraphic book serif), Alegreya SC for small-caps labels, Kalam for a few handwritten red-pencil margin notes, and the system monospace for code. Inter and JetBrains Mono are not loaded.
- Page: cream paper and warm black ink; red pencil for emphasis and section numbers, blue ink for links, coloured-pencil tones for the eight tracks (`src/study-tracks.json`). A yellow highlighter stroke in the headline. No dark bands, glows, grids, shadows, or pills.
- Structure: numbered sections and figures with captions; lists are ruled, not boxed. Lecture pages open with a red "unreviewed draft" stamp.
- `src/styles/roadmap.css` holds all of it. `src/components/roadmap/`: `GridLearner` (the live demo), `TrackMap` (edges from lecture prerequisites: solid when a track's first lecture needs another track, dashed when only a later lecture does), `StudyPlanner`, `ChalkLoop` (the loop figure on track pages; the name is left from an earlier pass), `LectureCard` (a list row), `SectionHead` (unused).
- The theme's floating graph button is hidden; "graph" and "search" are plain links in the header.

Fixed in the theme while doing this: Ctrl+K search never worked. `CommandPalette.astro` used a `define:vars` script, which Astro inlines without compiling or bundling, so its TypeScript cast was a syntax error and its `import('fuse.js')` could not resolve in the browser. The index now ships as JSON and the script is bundled.

One thing to watch when editing `.astro` templates: Astro drops a line break that sits between text and an inline element or a `{expression}`, so `checked it.` followed by `<a ...>` on the next line renders as "checked it.About". Keep such text and its link or expression on one line.

## Changes to the theme

- `src/content.config.ts`: posts and pages load from `src/generated/`; posts gain the curriculum fields. The theme's sample posts in `src/content/` are no longer loaded.
- `src/layouts/PostLayout.astro`: lecture number, track, and time above the title; the review-status stamp; a "Read first / You're done when you can / Exercise / On video" box; previous/next in curriculum order.
- `src/pages/index.astro`: the hub described above. `src/pages/start.astro` and `src/pages/tracks/[id].astro` are new.
- `src/pages/[...slug].astro`: a book-style head (kicker, title, description) for the generated pages, wider for tables, and mermaid diagrams.
- `src/components/GlobalGraph.astro`: counts markdown links between lectures as edges; nodes and legend use track colours.
- `src/pages/posts/index.astro`: lectures in curriculum order.
- `astro.config.mjs`: math plugins off (the lectures write math as Unicode; remark-math would read "$1-$3" in lecture 27 as LaTeX), and the directive plugins off (remark-directive read ":1712" in "arXiv:1712.01815" as a directive and dropped it, mangling most arXiv IDs). Code is highlighted with Shiki's `github-light`.
- `src/themes/index.ts`, `src/styles/global.css`, `src/layouts/BaseLayout.astro`: the paper palette (the `chalk` theme, labelled Paper), light mode only.
- `src/config.ts`, `src/components/Header.astro`, `src/components/Footer.astro`: name, menu (Start, Library, Curriculum, Watch, About), license line, version line.
- `package.json`: renamed `rl-study-site`, with the site's own version.

## Versions and releases

The site has its own version, separate from the theme's. It lives in `package.json`, and the footer shows it next to the study repo commit the build came from. `RELEASES.md` says what changed in each version and is rendered at `/releases/`. The study repo's own history stays in its `CHANGELOG.md` (rendered at `/changelog/`).

To cut a release:

1. Update the study repo if you want its latest: `git submodule update --remote study`.
2. Bump `version` in `package.json` (0.1.0 → 0.1.1 for fixes, 0.2.0 for new pages or features).
3. Add a section at the top of `RELEASES.md` with the date, the study repo commit (`git -C study log -1 --format=%h`), and what changed.
4. `npm run build`, check it, commit, and tag: `git tag -a v0.1.1 -m "v0.1.1"`.

## Run it

```bash
git clone --recurse-submodules git@github.com:0bserver07/rl-study-site.git   # on a new machine
git submodule update --init      # if you cloned without --recurse-submodules
npm ci --ignore-scripts          # install scripts aren't needed
npm run dev                      # syncs, then serves on http://localhost:4321
npm run build                    # syncs, then builds to dist/
git submodule update --remote study   # pull the latest study repo

# serve the build on the tailnet only (tmos-hq):
npx astro preview --host 100.110.48.128 --port 4321 --allowed-hosts tmos-hq,tmos-hq.tail3b5b54.ts.net
```

## Publishing

The repo is https://github.com/0bserver07/rl-study-site; work on `master`, and every push to it redeploys. `.github/workflows/deploy.yml` builds `master` with the pinned `study/` submodule and publishes `dist/` to GitHub Pages; `ci.yml` builds pull requests. The Pages environment deploys only from `master`.

The custom domain is `rl.yad.codes` (set in the repo's Pages settings, and as `site:` in `astro.config.mjs` and `src/config.ts`). It needs one DNS record where yad.codes is managed: `CNAME rl → 0bserver07.github.io`. Once GitHub has issued the certificate, turn on "Enforce HTTPS" in the Pages settings. Links are written from the site root (`/posts/...`), so the site needs a domain of its own: the bare `0bserver07.github.io/rl-study-site/` address serves the HTML without its styles, and redirects to the custom domain once that is set.

## Not done yet

- Every lecture is `unreviewed`. Decide whether the site goes public in that state before deploying.
- The theme's `projects` and `docs` routes still build (empty), which logs "collection is empty" warnings.
