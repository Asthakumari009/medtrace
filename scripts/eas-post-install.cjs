const { spawnSync } = require('node:child_process');
if (process.env.EAS_BUILD_PROFILE === 'production') {
  const result = spawnSync(process.execPath, [require.resolve('./check-release.cjs')], {stdio:'inherit'});
  process.exit(result.status ?? 1);
}
console.log('Internal/development build: store configuration gate not applied.');
