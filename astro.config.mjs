import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
import { calloutsPlugin } from './src/plugins/callouts.js';

export default defineConfig({
  site: 'https://sdxzy.github.io',
  base: '/insights',
  trailingSlash: 'always',
  markdown: {
    processor: satteri({
      features: {
        gfm: true,
        smartPunctuation: false,
      },
      hastPlugins: [calloutsPlugin],
    }),
  },
});
