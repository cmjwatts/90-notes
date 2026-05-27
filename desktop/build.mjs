import { build, context } from 'esbuild';
import { cpSync, mkdirSync } from 'node:fs';

const watch = process.argv.includes('--watch');

mkdirSync('dist/renderer', { recursive: true });

// Main + preload run in Electron's Node context (CommonJS). electron and the
// native DSDK module must stay external (not bundled).
const nodeCommon = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['electron', '@recallai/desktop-sdk'],
  sourcemap: true,
  logLevel: 'info',
};

const targets = [
  { ...nodeCommon, entryPoints: ['src/main.ts'], outfile: 'dist/main.js' },
  { ...nodeCommon, entryPoints: ['src/preload.ts'], outfile: 'dist/preload.js' },
  // Renderer runs in the browser context.
  {
    bundle: true,
    platform: 'browser',
    format: 'iife',
    target: 'es2022',
    entryPoints: ['src/renderer/popover.ts'],
    outfile: 'dist/renderer/popover.js',
    sourcemap: true,
    logLevel: 'info',
  },
];

cpSync('src/renderer/index.html', 'dist/renderer/index.html');
// Bundle tray icons next to the compiled main process (loaded via join(__dirname,'assets',...)).
cpSync('assets', 'dist/assets', { recursive: true });

if (watch) {
  for (const t of targets) {
    const ctx = await context(t);
    await ctx.watch();
  }
  console.log('[build] watching…');
} else {
  await Promise.all(targets.map((t) => build(t)));
  console.log('[build] done');
}
