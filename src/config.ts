/**
 * Mycelium Digital Garden Configuration
 *
 * This file contains all site-wide configuration options.
 * Update these values to customize your garden.
 */

export interface MyceliumConfig {
  // Site Identity
  site: string;
  name: string;
  gardener: string;
  description: string;
  language: string;

  // Appearance
  theme: ThemeName;
  fonts: {
    body: string;
    heading: string;
    mono: string;
  };

  // Navigation
  navigation: {
    items: NavigationItem[];
    showSocialLinks: boolean;
    social: SocialLink[];
  };

  // Features
  features: {
    darkMode: boolean;
    search: boolean;
    commandPalette: boolean;
    graphView: boolean;
    localGraph: boolean;
    backlinks: boolean;
    tableOfContents: boolean;
    comments: boolean;
    rss: boolean;
    // Gwern-style features
    sidenotes: boolean;
    linkPreviews: boolean;
    linkTypeIcons: boolean;
    dropCaps: boolean;
    imageLightbox: boolean;
  };

  // Garden-specific settings
  garden: {
    showGrowthStatus: boolean;
    defaultStatus: GrowthStatus;
    showPlantedDate: boolean;
    showLastTended: boolean;
    // Auto-growth: calculate growth based on backlinks and series
    autoGrowth: boolean;
  };

  // Posts settings
  posts: {
    postsPerPage: number;
    showReadingTime: boolean;
    showWordCount: boolean;
    showTags: boolean;
    layout: 'grid' | 'list';
    pagination: 'pages' | 'infinite';
  };

  // Comments (Giscus)
  comments?: {
    provider: 'giscus';
    repo: string;
    repoId: string;
    category: string;
    categoryId: string;
  };
}

export type ThemeName =
  | 'sage'        // Therapeutic sage greens (default)
  | 'forest'      // Deep greens
  | 'ocean'       // Blues
  | 'sunset'      // Warm oranges/reds
  | 'minimal'     // Grayscale
  | 'nord'        // Nord color palette
  | 'rose'        // Pink/rose tones
  | 'chalk'       // Study site: chalkboard green and paper
  ;

export type GrowthStatus = 'seedling' | 'budding' | 'evergreen';

export interface NavigationItem {
  title: string;
  url: string;
  icon?: string;
}

export interface SocialLink {
  title: string;
  url: string;
  icon: string;
}

// ============================================================================
// SITE CONFIGURATION - Edit these values
// ============================================================================

export const siteConfig: MyceliumConfig = {
  // Site Identity
  site: 'https://example.com',
  name: 'Study Reinforcement Learning',
  gardener: 'Yad Konrad',
  description: 'Notes, lectures, and exercises for learning reinforcement learning and how it is used to train language models.',
  language: 'en',

  // Appearance
  theme: 'chalk',
  fonts: {
    body: 'Inter',
    heading: 'Inter',
    mono: 'JetBrains Mono',
  },

  // Navigation
  navigation: {
    items: [
      { title: 'Home', url: '/' },
      { title: 'Start', url: '/start/' },
      { title: 'Library', url: '/library/' },
      { title: 'Curriculum', url: '/curriculum/' },
      { title: 'Watch', url: '/watch/' },
      { title: 'About', url: '/about/' },
    ],
    showSocialLinks: true,
    social: [
      { title: 'GitHub', url: 'https://github.com/0bserver07/Study-Reinforcement-Learning', icon: 'github' },
    ],
  },

  // Features
  features: {
    darkMode: true,
    search: true,
    commandPalette: true,
    graphView: true,
    localGraph: true,
    backlinks: true,
    tableOfContents: true,
    comments: false, // Enable when you configure Giscus
    rss: true,
    // Gwern-style features
    sidenotes: true,        // Convert footnotes to margin notes
    linkPreviews: true,     // Hover preview popups for internal links
    linkTypeIcons: true,    // Icons for PDF, external, wiki links
    dropCaps: false,        // Decorative first letter (enable per-post)
    imageLightbox: true,    // Click-to-zoom for images
  },

  // Garden settings
  garden: {
    showGrowthStatus: false, // study site shows review status instead
    defaultStatus: 'seedling',
    showPlantedDate: false,
    showLastTended: true,
    autoGrowth: false, // Auto-calculate growth based on backlinks and series
  },

  // Posts settings
  posts: {
    postsPerPage: 10,
    showReadingTime: true,
    showWordCount: false,
    showTags: true,
    layout: 'grid',        // 'grid' = card grid, 'list' = blog-style list
    pagination: 'pages',   // 'pages' = numbered pages, 'infinite' = infinite scroll
  },

  // Uncomment and configure when ready for comments
  // comments: {
  //   provider: 'giscus',
  //   repo: 'your-username/your-repo',
  //   repoId: 'your-repo-id',
  //   category: 'Comments',
  //   categoryId: 'your-category-id',
  // },
};

export default siteConfig;
