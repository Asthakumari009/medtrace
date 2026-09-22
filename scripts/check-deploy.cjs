// Post-deploy gate. Usage: node scripts/check-deploy.cjs https://your-url
//
// Checks the things that fail *quietly* -- a protected deployment answers every
// request with a redirect a browser silently follows, and a web bundle built
// without EXPO_PUBLIC_API_URL points at localhost while looking perfectly fine.
// No configuration values are printed.

const base = (process.argv[2] || '').replace(/\/+$/, '');
if (!/^https:\/\//.test(base)) {
  console.error('Usage: node scripts/check-deploy.cjs https://your-deployment-url');
  process.exit(2);
}

const get = async (path) => {
  const res = await fetch(base + path, { redirect: 'manual' });
  return { status: res.status, location: res.headers.get('location') || '', body: await res.text() };
};

const checks = [
  {
    name: 'Deployment Protection is off (non-browser callers can reach the app)',
    async run() {
      const { status, location } = await get('/health');
      if (location.includes('vercel.com/sso-api'))
        return 'Vercel Authentication is ON. Settings -> Deployment Protection. The app and the doctor QR both break on this.';
      if (status === 302 || status === 307)
        return `unexpected redirect to ${location || '(none)'}`;
      return null;
    },
  },
  {
    name: 'API is wired (/health reports supabase + vertex present)',
    async run() {
      const { status, body } = await get('/health');
      if (status !== 200) return `expected 200, got ${status}`;
      let json;
      try { json = JSON.parse(body); } catch { return 'response was not JSON -- is /health hitting the web app instead of the function?'; }
      const cfg = json.config || {};
      if (cfg.supabase !== true) return 'supabase:false -- SUPABASE_URL and/or SUPABASE_SECRET_KEY missing in Vercel';
      if (cfg.vertex !== true) return 'vertex:false -- set GOOGLE_SA_JSON (and GOOGLE_CLOUD_PROJECT), and do NOT also set GOOGLE_APPLICATION_CREDENTIALS';
      return null;
    },
  },
  {
    name: 'Web export is served at / (not the API)',
    async run() {
      const { status, body } = await get('/');
      if (status !== 200) return `expected 200, got ${status}`;
      if (!/<html/i.test(body)) return 'root did not return HTML -- check buildCommand/outputDirectory and .vercelignore';
      return null;
    },
  },
  {
    // The API URL lands in the __common chunk, not entry -- Expo Router
    // code-splits. Reading entry alone made this pass on any bundle, because
    // the string it was looking for was never there to begin with.
    name: 'Web bundle points at this deployment (not localhost, not a stale alias)',
    async run() {
      const { body } = await get('/');
      const chunks = [...new Set(body.match(/\/_expo\/static\/js\/web\/[\w[\]-]+-[a-f0-9]+\.js/g) || [])];
      if (!chunks.length) return 'no bundle chunks referenced from index.html';
      const host = new URL(base).host;
      let sawHost = false;
      for (const chunk of chunks) {
        const { body: js } = await get(chunk);
        if (/localhost:8000/.test(js))
          return `${chunk} contains localhost:8000 -- EXPO_PUBLIC_API_URL was unset at build time, so http.ts fell back. Set it in Vercel and redeploy.`;
        if (js.includes(host)) sawHost = true;
      }
      if (!sawHost)
        return `none of the ${chunks.length} chunk(s) mention ${host} -- EXPO_PUBLIC_API_URL points somewhere else (an old project or a preview alias). Run this against the production domain.`;
      return null;
    },
  },
  {
    name: '/extract requires a bearer token (401, not open and not redirected)',
    async run() {
      const res = await fetch(base + '/extract', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ report_id: '00000000-0000-0000-0000-000000000000' }),
        redirect: 'manual',
      });
      if (res.status !== 401) return `expected 401, got ${res.status}`;
      // Vercel's SSO wall also answers 401 to a POST (it cannot meaningfully
      // redirect one), so the status alone would pass on a protected
      // deployment. Only FastAPI returns a JSON body with `detail`.
      const body = await res.text();
      let json;
      try { json = JSON.parse(body); } catch {
        return '401 was not JSON -- this is the protection wall answering, not the API';
      }
      if (typeof json.detail !== 'string')
        return '401 JSON had no `detail` -- not a FastAPI response';
      return null;
    },
  },
  {
    name: 'Doctor page assets are bundled with the function',
    async run() {
      const { status } = await get('/doctor-assets/doctor.css');
      if (status !== 200) return `expected 200, got ${status} -- check includeFiles in vercel.ts and the doctor-web/ location`;
      return null;
    },
  },
];

(async () => {
  let failed = 0;
  for (const check of checks) {
    let problem;
    try { problem = await check.run(); } catch (e) { problem = e.message; }
    if (problem) { failed++; console.error(`FAIL  ${check.name}\n        ${problem}`); }
    else console.log(`ok    ${check.name}`);
  }
  console.log(failed ? `\n${failed} check(s) failed.` : '\nDeployment looks good.');
  process.exit(failed ? 1 : 0);
})();
