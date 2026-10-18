import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.tsx'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  clean: true,
  banner: { js: '#!/usr/bin/env node' },
});
