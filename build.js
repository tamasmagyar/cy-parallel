const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['./src/index.ts'],
  bundle: true,
  platform: 'node',
  outdir: 'dist',
  banner: { js: '#!/usr/bin/env node' },
  external: ['typescript'],
}).catch(() => process.exit(1));
