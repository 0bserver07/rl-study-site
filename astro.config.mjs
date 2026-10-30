// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// Remark/Rehype plugins
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
// Study site: math plugins are off. The lectures write math as Unicode in code
// blocks, and remark-math would read prices like "$1-$3" (lecture 27) as LaTeX.
// import remarkMath from 'remark-math';
// import rehypeKatex from 'rehype-katex';
// Study site: directive plugins are off. remark-directive reads ":1712" in
// "arXiv:1712.01815" as a directive and drops it, which mangled most arXiv IDs
// in the lectures. The study content never uses ::: directives.
// import remarkDirective from 'remark-directive';

// Custom remark plugins
import { remarkWikilinks } from './src/utils/remark-wikilinks.ts';
import { remarkCallouts } from './src/utils/remark-callouts.ts';
import { remarkHighlight } from './src/utils/remark-highlight.ts';
import { remarkEmbeds } from './src/utils/remark-embeds.ts';
import { remarkMediaEmbeds } from './src/utils/remark-media-embeds.ts';
import { remarkMermaid } from './src/utils/remark-mermaid.ts';
import { remarkGallery } from './src/utils/remark-gallery.ts';
import { remarkSidenotes } from './src/utils/remark-sidenotes.ts';
import { remarkDropcap } from './src/utils/remark-dropcap.ts';
// import { remarkCollapsible } from './src/utils/remark-collapsible.ts';

// https://astro.build/config
export default defineConfig({
  site: 'https://rl.yad.codes',

  integrations: [
    mdx(),
    sitemap(),
  ],

  // Tailwind CSS v4 is wired via its Vite plugin (the former @astrojs/tailwind
  // integration is deprecated and caps at Astro 5 / Tailwind 3).
  vite: {
    plugins: [tailwindcss()],
  },

  markdown: {
    remarkPlugins: [
      remarkEmbeds,  // Must come before wikilinks
      remarkMediaEmbeds,  // YouTube/Twitter embeds
      remarkMermaid,  // Mermaid diagrams
      remarkGallery,  // Image galleries
      remarkWikilinks,
      remarkCallouts,
      remarkHighlight,
      remarkSidenotes,  // Convert footnotes to sidenotes (Gwern-style)
      [remarkDropcap, { enabled: false }],  // Drop caps (enable per-post with frontmatter)
    ],
    rehypePlugins: [
      rehypeSlug,
      [rehypeAutolinkHeadings, { behavior: 'wrap' }],
    ],
    shikiConfig: {
      theme: 'github-light', // study site: light code on paper
      wrap: true,
    },
  },
});
