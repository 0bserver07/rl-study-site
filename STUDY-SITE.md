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
- `site-pages/about.md` is the About page. Anything in `site-pages/` is copied into the pages collection.
- `RELEASES.md` is rendered at `/releases/`.

## Pages

- `/`: the hub. A Q-learning agent learning a gridworld in the browser (`src/components/roadmap/GridLearner.astro`, the same algorithm as lecture 03 and exercise 03), then one topic in four steps (read, watch, build, check) using that same example, the nine exercises, the eight tracks, the landscape map, the eight rules, and an index of everything.
- `/start/`: what to know first with a self-check (remembered in the browser), the study planner, week one, and what to do when stuck.
- `/tracks/<id>/`: one page per track.
- `/posts/<slug>/`: the lectures. `/library/`: everything.
- Lecture figures: every lecture with an exercise has an interactive figure between "Before you start" and the text. `src/components/roadmap/LectureFigure.astro` maps lectures to figures and holds each caption; `PostLayout` places it. 01 `ValueIteration`, 02 `PolicyGradientBandit`, 03 `GridLearner`, 04 `ActorCriticGrid`, 06 `PPOClip`, 09 `RewardModelBT`, 11 `DPOPolicy`, 15 `GRPOGroup`, 20 `ExplorationChain` (a combination lock, not exercise 20's chain; see RELEASES 0.5.0). Before shipping a figure, check its numbers against an independent calculation, and let its caption claim only what was measured.
- `/why/`: an essay (`src/essays/why-rl.mdx`, page `src/pages/why.astro`) with the playable bandit (`src/components/roadmap/Bandit.astro`) and the gridworld. The same essay is on yad.codes (garden repo: `src/content/posts/why-i-keep-coming-back-to-reinforcement-learning.mdx`, figures in `src/components/rl/`); keep the two copies in step.

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
- `src/layouts/PostLayout.astro`: lecture number, track, and time above the title; the review-status stamp; a "Read first / You're done when you can / Exercise / On video" box; previous/next in curriculum order; the lecture's own share card, passed to `BaseLayout`'s `shareImage` prop (see Share cards).
- `src/pages/index.astro`: the hub described above. `src/pages/start.astro` and `src/pages/tracks/[id].astro` are new.
- `src/pages/[...slug].astro`: a book-style head (kicker, title, description) for the generated pages, wider for tables, and mermaid diagrams.
- `src/components/GlobalGraph.astro`: counts markdown links between lectures as edges; nodes and legend use track colours.
- `src/pages/posts/index.astro`: lectures in curriculum order.
- `astro.config.mjs`: math plugins off (the lectures write math as Unicode; remark-math would read "$1-$3" in lecture 27 as LaTeX), and the directive plugins off (remark-directive read ":1712" in "arXiv:1712.01815" as a directive and dropped it, mangling most arXiv IDs). Code is highlighted with Shiki's `github-light`.
- `src/themes/index.ts`, `src/styles/global.css`, `src/layouts/BaseLayout.astro`: the paper palette (the `chalk` theme, labelled Paper), light mode only.
- `src/config.ts`, `src/components/Header.astro`, `src/components/Footer.astro`: name, menu (Start, Library, Curriculum, Watch, About), license line, version line. `gardenerUrl` in `src/config.ts` is where Yad's name links (https://yad.codes).
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
```

## Share cards

A link to the site shows a 1200×630 card (`og:image` and `twitter:image`). Every page uses `public/og-default.png`, drawn by `node scripts/og-default.mjs`, except the lectures: each has its own card at `public/og/lectures/<slug>.png`. `PostLayout` passes it to `BaseLayout` as `shareImage`, an absolute URL. A lecture with no card file gets the default, and the build warns about it.

A lecture's card has its number and track (with the track's colour), its title, and "by Yad Konrad · rl.yad.codes". The title wraps at spaces to at most three lines, shrinking if it has to. A lecture with a figure has a still of the figure on the right, taken after it has learned something; the others are text only, with the lecture number set large in the track's colour.

The cards are made in two steps. Commit what both write; neither runs in CI.

1. `scripts/og-stills.mjs` captures each figure from the built site in headless Chrome and saves it to `scripts/og/stills/<NN>.png`. It needs the site served and Chrome listening on a debugging port:

   ```bash
   npm run build
   npx astro preview --port 4321 &
   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
     --remote-debugging-port=9222 --user-data-dir=/tmp/og-chrome about:blank &
   node scripts/og-stills.mjs          # all nine figures, or only some: node scripts/og-stills.mjs 04 15
   ```

   `--site` and `--cdp` point it at another preview URL or Chrome port. It drives each figure with its own buttons (200 episodes, sweeps until the values stop changing, 500 labels, and so on) under a seeded `Math.random`, so a rerun gives the same stills. If a run doesn't show what the figure is for (the actor-critic agent reaching the goal, the best slot machine leading, the novelty-bonus agent reaching the +1, 56 taking over GRPO's policy), it tries the next seed. Stop the preview and Chrome when it's done.

2. `node scripts/og-lectures.mjs` draws a card for every lecture from `src/generated/lectures` and the stills, without a browser. Run `npm run sync` or a build first. `node scripts/og-lectures.mjs 04 20` redraws only those two.

Redraw the cards when a lecture is added or its title or track changes. When a figure changes, capture its still again, then redraw.

## Publishing

The repo is https://github.com/0bserver07/rl-study-site; work on `master`, and every push to it redeploys. `.github/workflows/deploy.yml` builds `master` with the pinned `study/` submodule and publishes `dist/` to GitHub Pages; `ci.yml` builds pull requests. The Pages environment deploys only from `master`.

The custom domain is `rl.yad.codes` (set in the repo's Pages settings, and as `site:` in `astro.config.mjs` and `src/config.ts`). It needs one DNS record where yad.codes is managed: `CNAME rl → 0bserver07.github.io`. Once GitHub has issued the certificate, turn on "Enforce HTTPS" in the Pages settings. Links are written from the site root (`/posts/...`), so the site needs a domain of its own: the bare `0bserver07.github.io/rl-study-site/` address serves the HTML without its styles, and redirects to the custom domain once that is set.

## Not done yet

- Every lecture is still `unreviewed`.
- The theme's `projects` and `docs` collections are still defined (empty), and the theme's `LinkPreview` asks for `projects` on every lecture page, which logs "collection is empty" warnings. Their routes, and the theme's `/posts/` index, pagination and tag pages, were removed in 0.2.0; `/posts/` redirects to `/library/` (`redirects` in `astro.config.mjs`).
- Only lectures have their own share card; every other page uses `public/og-default.png` (see Share cards).
