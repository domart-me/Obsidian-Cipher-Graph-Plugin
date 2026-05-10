import esbuild from 'esbuild';
import { readFileSync } from 'node:fs';

const prod = process.argv.includes('--production');

const ngraphEventsSource = readFileSync(
  'node_modules/ngraph.events/index.js',
  'utf8'
);

const unminifiedPlugin = {
  name: 'unminified-ngraph-events',
  setup(build) {
    build.onResolve({ filter: /^ngraph\.events$/ }, () => ({
      path: 'ngraph.events',
      namespace: 'unminified-ngraph',
    }));
    build.onLoad({ filter: /.*/, namespace: 'unminified-ngraph' }, () => ({
      contents: ngraphEventsSource,
      loader: 'js',
    }));
  },
};

const buildOptions = {
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: ['obsidian'],
  format: 'cjs',
  target: 'es2018',
  keepNames: true,
  outfile: 'main.js',
  plugins: [unminifiedPlugin],
  logLevel: 'info',
};

if (prod) {
  await esbuild.build(buildOptions);
} else {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log('Watching for changes...');
}
