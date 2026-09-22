// No configuration values are printed: public env vars ship inside the app.
const fs = require('node:fs');
const path = require('node:path');
const errors = [];
for (const name of ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_API_URL']) {
  try {
    const url = new URL(process.env[name] || '');
    if (url.protocol !== 'https:' || ['localhost', '127.0.0.1', 'example.supabase.co'].includes(url.hostname)) errors.push(`${name} must be a deployed HTTPS endpoint.`);
  } catch { errors.push(`${name} is missing or invalid.`); }
}
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
let isPublic = key.startsWith('sb_publishable_');
if (key.split('.').length === 3) {
  try { isPublic = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon'; } catch {}
}
if (!isPublic) errors.push('EXPO_PUBLIC_SUPABASE_ANON_KEY must be a publishable or anon key.');
for (const [name, value] of Object.entries(process.env)) {
  if (name.startsWith('EXPO_PUBLIC_') && /sb_secret_|-----BEGIN (?:RSA )?PRIVATE KEY-----/.test(value || '')) errors.push(`${name} contains server-only credentials.`);
}
if (process.env.EXPO_PUBLIC_ENABLE_DEVICE_CHECKS === '1') errors.push('Internal device checks must be disabled in store builds.');
const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../app.json'), 'utf8')).expo;
if (config.android.allowBackup !== false) errors.push('Android backups must remain disabled for device-only encrypted records.');
const buildProps = config.plugins.find(p => Array.isArray(p) && p[0] === 'expo-build-properties')?.[1]?.android;
if (!buildProps?.enableMinifyInReleaseBuilds || !buildProps?.enableShrinkResourcesInReleaseBuilds || buildProps?.usesCleartextTraffic !== false) errors.push('Android release optimization or transport settings are incomplete.');
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('Release configuration checks passed. Signing, store declarations, and staging acceptance are separate release gates.');
