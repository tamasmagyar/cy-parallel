const esbuild = require('esbuild');
const glob = require('glob');

const entryPoints = glob.sync('./src/**/*.ts').filter((file) => {
  return !file.endsWith('.test.ts') && !file.endsWith('.spec.ts');
});

esbuild.build({
  entryPoints,
  bundle: true,
  platform: 'node',
  outdir: 'dist',
  banner: { js: '#!/usr/bin/env node' },
  external: [
    'typescript',
  ],
}).catch(() => process.exit(1));
