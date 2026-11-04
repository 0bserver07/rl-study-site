# rl-study-site

The site for Study-Reinforcement-Learning, live at https://rl.yad.codes. It started from the Mycelium Astro theme; most of the theme's Obsidian and garden features aren't used here.

Read `STUDY-SITE.md` first. The short version:

- `study/` is the study repo, as a git submodule. Don't edit it from here: fix the study repo, then bump the submodule.
- `scripts/sync-study.mjs` runs before `dev` and `build` and writes `src/generated/` (gitignored). Lectures and pages are built from that, not from `src/content/`.
- Every push to `master` deploys to GitHub Pages. A release is a `package.json` version bump, a section at the top of `RELEASES.md`, and a tag.
- In `.astro` templates, keep text and the link or `{expression}` after it on one line. Astro drops the line break between them.

Personal notes go in `.claude/*.local.md` (gitignored).
