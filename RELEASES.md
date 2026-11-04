# Releases

Versions of this site. The lectures, notes, and exercises have their own history in the study repo's [changelog](/changelog/). Each release here names the study repo commit it was built from.

## 0.4.0 (2026-11-03)

Built from the study repo at v1.0.0 (commit `219a97a`).

- Yad's name links to [yad.codes](https://yad.codes) everywhere it appears: the home page byline, How this started, the About page, the essay byline, and the footer. The date in the home page byline still goes to How this started.
- Lecture 01 and lecture 03 have a figure to try, between Before you start and the text. Lecture 01: value iteration on the home page's grid, one sweep at a time, with γ and a slippery floor. Lecture 03: the Q-learning agent from the home page. More lectures with exercises will get one.
- The footer's version line links to this site's own code, [rl-study-site](https://github.com/0bserver07/rl-study-site).
- The repo describes this site: its README no longer repeats the Mycelium theme's, CONTRIBUTING says which repo a correction goes to, and the theme's changelog, screenshots, and pull request checklist are gone. `package.json` points at this repo and this site instead of the theme. The About page no longer ships a drafting note in its source.
- The study repo's first tagged release, v1.0.0. Its readme links back to this site, and dates the talks and courses list to 31 December 2016.

## 0.3.1 (2026-11-03)

Built from the study repo at commit `1b7eae8`.

- Corrected the self-driving project on the home page, the About page and in the essay: it was in GTA V, trained on DeepDrive's GTA V driving dataset, not in GTA San Andreas.

## 0.3.0 (2026-11-03)

Built from the study repo at commit `1b7eae8`.

- A new page, [Why I keep coming back to reinforcement learning](/why/): an essay with three slot machines you can play against an epsilon-greedy agent, and the gridworld from the home page.
- All 13 diagrams on the diagrams page render. Three of them showed mermaid's syntax error because some labels had unquoted parentheses (fixed in the study repo, pull request #16).

## 0.2.0 (2026-11-03)

Built from the study repo at commit `82eda54`.

- The home page says who made it: a byline under the headline, and a last section, How this started, with the history from the About page (the 2016 list, GTA V, CS 294, the lectures, and this site).
- A newsletter signup for yad.codes under Figure 1 and at the end of About.
- A share card for links posted on Twitter, Slack, and elsewhere, and the site's own favicon.
- Fixed: the Before you start checklist counted eight boxes when there are six. Six lectures (04, 05, 07, 08, 09, 13) showed their own time and prerequisites lines next to the ones from the curriculum, and used them as their description. 32 pages had no description. The home page title said the site name twice. The landscape map's family names opened the theme's tag pages instead of the track pages.
- Removed the theme pages this site doesn't use: /projects/, /docs/, and the /posts/ index with its pagination and tag pages. /posts/ now goes to the Library.

## 0.1.1 (2026-10-30)

Built from the study repo at commit `82eda54`.

- Every internal link on the site now resolves. The study repo fixed eight dead entries in the diagrams page's contents list, and a formula in the math cheat sheet that showed up as a link (its pull request #15).
- The build no longer reports text that only looks like a link, such as inline code or an escaped bracket, as a broken link.

## 0.1.0 (2026-10-30)

The first version, built from the study repo at commit `37cc88d`.

- A home page that opens with a Q-learning agent learning a gridworld in your browser, then the four steps of studying one topic, the nine exercises, the eight tracks, and the landscape map.
- A page for every lecture, with its place in the curriculum, what to read first, the checkpoint, the exercise, and matching videos. Every lecture is still marked unreviewed.
- A page for each of the eight tracks.
- Pages for the rest of the study repo: exercises with their hints and starter code, homework, cheat sheets, diagrams, reading lists, the 2017 notes, the changelog, and AGENTS.md. The Library page lists all of them.
- Before you start: what to know first, with a self-check; a planner for how long it takes; week one; what to do when stuck.
- Watch: four video courses, with the episodes that match each lecture.
- Search (Ctrl K) and a graph of how the pages link to each other.
