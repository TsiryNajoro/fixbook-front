import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.js';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      pool: 'vmThreads',
      setupFiles: ['./tests/setup.js'],
      include: ['tests/**/*.test.{js,jsx}'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov'],
        reportsDirectory: 'coverage',
        include: ['src/**/*.{js,jsx}'],
        exclude: [
          'tests/**',
          '**/*.test.{js,jsx}',
          'vitest.config.js',
          'src/main.jsx',
          'src/components/NotificationBell.jsx',
          'src/pages/ProblemDetail.jsx',
          'src/pages/Profile.jsx',
        ],
      },
    },
  }),
);
