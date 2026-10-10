/** Shared release checks. These functions make no network requests. */
export const PRODUCTION_URL = 'https://ustogether-tau.vercel.app';
export const VERCEL_PROJECT_ID = 'prj_BXk6UvqA0rakAOFaTb8nZvj0PPt1';
export const VERCEL_ORG_ID = 'team_HGo6OUiSMKwQ5AmVfXvxjRPP';

export function deploymentFromJson(payload, target) {
  const deployment = payload.deployment ?? payload;
  if (!deployment || !/^dpl_[A-Za-z0-9]+$/.test(deployment.id ?? '')) {
    throw new Error('Vercel did not return a deployment identity.');
  }
  const url = new URL(deployment.url?.startsWith('https://') ? deployment.url : `https://${deployment.url}`);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.vercel.app') || url.username || url.password || url.pathname !== '/') {
    throw new Error('Vercel returned an unexpected deployment URL.');
  }
  if (deployment.readyState !== 'READY') throw new Error('The Vercel deployment is not Ready.');
  const actualTarget = deployment.target ?? 'preview';
  if (actualTarget !== target) throw new Error(`Expected a ${target} deployment.`);
  return { id: deployment.id, url: url.origin, target: actualTarget };
}

export function assertCurrentMain(expectedSha, actualSha) {
  if (!/^[a-f0-9]{40}$/.test(expectedSha ?? '') || !/^[a-f0-9]{40}$/.test(actualSha ?? '')) {
    throw new Error('A valid main commit SHA is required.');
  }
  if (actualSha !== expectedSha) throw new Error('Main has moved. This older run will not publish production.');
}

function readDotenv(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    let value = match[2];
    if (value.startsWith('"') && value.endsWith('"')) {
      try { value = JSON.parse(value); } catch { throw new Error('Vercel returned an invalid environment file.'); }
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

function publicHttpsUrl(value, name) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`${name} must contain a hosted HTTPS URL.`); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hostname === 'localhost' ||
      /^127\./.test(url.hostname) || url.hostname.endsWith('.invalid') || url.hostname.endsWith('.localhost')) {
    throw new Error(`${name} must contain a hosted HTTPS URL.`);
  }
  return url;
}

export function validatePublicEnvironment(text, target, productionUrl = PRODUCTION_URL) {
  const values = readDotenv(text);
  publicHttpsUrl(values.EXPO_PUBLIC_SUPABASE_URL, 'EXPO_PUBLIC_SUPABASE_URL');
  const appUrl = publicHttpsUrl(values.EXPO_PUBLIC_APP_URL, 'EXPO_PUBLIC_APP_URL');
  const key = values.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
  let isAnonJwt = false;
  try { isAnonJwt = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon'; } catch { /* publishable keys are not JWTs */ }
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key) && !isAnonJwt) {
    throw new Error('The client requires a Supabase publishable or legacy anon key.');
  }
  for (const [name, value] of Object.entries(values)) {
    if (name.startsWith('EXPO_PUBLIC_') && (value.startsWith('sb_secret_') || value.startsWith('sb_service_role_'))) {
      throw new Error('A secret Supabase key must not enter the client build.');
    }
    if (name.startsWith('EXPO_PUBLIC_')) {
      try {
        const payload = JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString());
        if (payload.role === 'service_role') throw new Error('A service-role key must not enter the client build.');
      } catch (error) {
        if (error.message === 'A service-role key must not enter the client build.') throw error;
      }
    }
  }
  if (appUrl.pathname !== '/' || appUrl.search || appUrl.hash) throw new Error('EXPO_PUBLIC_APP_URL must be an app origin without a path or query.');
  if (target === 'production' && appUrl.origin !== new URL(productionUrl).origin) {
    throw new Error('Production EXPO_PUBLIC_APP_URL must match the existing production domain.');
  }
}

export function parseResponseHeaders(text) {
  const blocks = text.trim().split(/\r?\n\r?\n/).filter(block => /^HTTP\//i.test(block));
  const headers = {};
  for (const line of (blocks.at(-1) ?? '').split(/\r?\n/).slice(1)) {
    const colon = line.indexOf(':');
    if (colon > 0) headers[line.slice(0, colon).toLowerCase()] = line.slice(colon + 1).trim();
  }
  return headers;
}

export function assertSpaResponse(response) {
  if (response.status !== 200 || !/text\/html/i.test(response.headers['content-type'] ?? '') ||
      !/<(?:!doctype\s+html|html)\b/i.test(response.body)) {
    throw new Error('A deployed app route did not return the SPA document.');
  }
  const scripts = [...response.body.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)]
    .map(match => match[1]).filter(src => /(?:^|\/)\_expo\/static\/js\/web\/[^?]+\.js(?:\?|$)/i.test(src));
  if (!scripts.length) throw new Error('The deployed SPA document has no JavaScript bundle.');
  return scripts;
}

export function staticScriptPath(src, origin) {
  const url = new URL(src, origin);
  if (url.origin !== origin) throw new Error('A deployed script unexpectedly points outside this deployment.');
  return `${url.pathname}${url.search}`;
}

export function assertJavaScriptResponse(response) {
  if (response.status !== 200 || !/(?:java|ecma)script/i.test(response.headers['content-type'] ?? '') ||
      !response.body.trim() || /^\s*(?:<!doctype|<html)/i.test(response.body)) {
    throw new Error('A deployed JavaScript asset is missing or incorrectly returns the SPA fallback.');
  }
  if (response.body.includes('ustogether-test.invalid') || response.body.includes('sb_publishable_isolated_browser_fixture')) {
    throw new Error('The deployed JavaScript contains isolated browser-test configuration. Production was not verified.');
  }
}

export async function runRelease({ cli, smoke, currentMain, expectedSha, productionUrl = PRODUCTION_URL, record = () => {} }) {
  assertCurrentMain(expectedSha, await currentMain());
  const previous = await cli.inspect(productionUrl, 'production');
  record('Previous production', previous);

  await cli.build('preview');
  const preview = await cli.deploy('preview');
  await smoke(preview.url, true);
  record('Verified source preview', preview);

  await cli.build('production');
  const staged = await cli.deploy('production');
  record('Staged production', staged);
  await smoke(staged.url, true);
  assertCurrentMain(expectedSha, await currentMain());

  // Once promotion starts, any failure must restore the previous Ready production.
  let promotionStarted = false;
  try {
    promotionStarted = true;
    await cli.promote(staged.url);
    const active = await cli.inspect(productionUrl, 'production');
    if (active.id !== staged.id) throw new Error('The production domain does not serve the staged deployment.');
    await smoke(productionUrl, false);
    record('Released production', staged);
    return { previous, preview, staged };
  } catch (releaseError) {
    if (promotionStarted) {
      record('Release check failed; restoring production', previous);
      try {
        await cli.rollback(previous.url);
        const restored = await cli.inspect(productionUrl, 'production');
        if (restored.id !== previous.id) throw new Error('The production domain did not return to its previous deployment.');
        await smoke(productionUrl, false);
        record('Production restored', previous);
      } catch (rollbackError) {
        throw new AggregateError([releaseError, rollbackError], 'Release verification and automatic rollback failed. Inspect production immediately.');
      }
    }
    throw releaseError;
  }
}
