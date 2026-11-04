# Contributing

There are two repos, and each takes a different kind of fix.

- **A lecture, exercise, or note is wrong** (the math, a citation, code that doesn't run): the text lives in [Study-Reinforcement-Learning](https://github.com/0bserver07/Study-Reinforcement-Learning). Open an issue or a pull request there. Every lecture page on the site links to its source file.
- **The site is broken** (a page, the agent or the slot machines, a link, search): open an issue here, or a pull request against `master`.

Before a pull request here, run `npm run build` and make sure it finishes. CI builds every pull request the same way. [STUDY-SITE.md](STUDY-SITE.md) explains how the pages are made from the study repo.
