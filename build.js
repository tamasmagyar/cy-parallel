const esbuild = require('esbuild');
const glob = require('glob'); // Install glob if you don't have it

// Get all TypeScript files in the src directory
const entryPoints = glob.sync('./src/**/*.ts');

esbuild.build({
  entryPoints,
  bundle: true,
  platform: 'node',
  outdir: 'dist', // This will output all files into dist folder
  banner: { js: '#!/usr/bin/env node' },
}).catch(() => process.exit(1));
