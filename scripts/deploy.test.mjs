import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import test from 'node:test';
import { releaseConfig, vercelChildEnvironment, vercelRunner } from './deploy-release.mjs';
import { verifyExport } from './verify-export.mjs';
import {
  PRODUCTION_URL, VERCEL_ORG_ID, VERCEL_PROJECT_ID, assertCurrentMain,
  assertJavaScriptResponse, assertSpaResponse, deploymentFromJson,
  parseResponseHeaders, runRelease, staticScriptPath, validatePublicEnvironment,
} from './deploy-utils.mjs';

const SHA = 'a'.repeat(40);
const env = {
  ENABLE_VERCEL_DEPLOYMENT: 'true', GITHUB_ACTIONS: 'true', GITHUB_REF: 'refs/heads/main',
  GITHUB_EVENT_NAME: 'push', GITHUB_SHA: SHA, GITHUB_REPOSITORY: 'thebaynal/UsTogether',
  VERCEL_TOKEN: 'test-token', GITHUB_TOKEN: 'test-github-token', VERCEL_ORG_ID, VERCEL_PROJECT_ID,
};
const publicEnvironment = (key = 'sb_publishable_test_key', appUrl = PRODUCTION_URL) =>
  `EXPO_PUBLIC_SUPABASE_URL="https://example.supabase.co"\nEXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY="${key}"\nEXPO_PUBLIC_APP_URL="${appUrl}"`;
const jwt = role => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.signature`;
const document = '<!doctype html><html><script src="/_expo/static/js/web/entry-test.js" defer></script></html>';
const htmlResponse = { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' }, body: document };

test('CI publishing requires explicit opt-in, a credential, and main', () => {
  assert.equal(releaseConfig(env).expectedSha, SHA);
  assert.throws(() => releaseConfig({ ...env, ENABLE_VERCEL_DEPLOYMENT: undefined }), /disabled/);
  assert.throws(() => releaseConfig({ ...env, VERCEL_TOKEN: '' }), /VERCEL_TOKEN/);
  assert.throws(() => releaseConfig({ ...env, GITHUB_EVENT_NAME: 'pull_request' }), /only publish main/);
  assert.throws(() => releaseConfig({ ...env, GITHUB_REF: 'refs/heads/feature' }), /only publish main/);
  assert.throws(() => releaseConfig({ ...env, VERCEL_PROJECT_ID: 'prj_other' }), /existing UsTogether/);
});

test('an explicit local release uses existing login and requires clean linked main', () => {
  const context = { branch: 'main', clean: true, sha: SHA, orgId: VERCEL_ORG_ID, projectId: VERCEL_PROJECT_ID };
  assert.equal(releaseConfig({}, { local: true, context }).expectedSha, SHA);
  assert.throws(() => releaseConfig({}, { local: true, context: { ...context, clean: false } }), /clean main/);
  assert.throws(() => releaseConfig({}, { local: true, context: { ...context, branch: 'feature' } }), /clean main/);
});

test('Windows Vercel builds retain the system PATH without conflicting spellings', () => {
  const original = { Path: 'C:\\Windows\\System32;C:\\Program Files\\nodejs', PUBLIC_SETTING: 'unchanged' };
  const child = vercelChildEnvironment(original, 'win32');
  assert.equal(child.PATH, original.Path);
  assert.equal(child.PUBLIC_SETTING, original.PUBLIC_SETTING);
  assert.equal('Path' in child, false);
  assert.equal(original.Path, child.PATH);
  assert.equal('PATH' in original, false);
  assert.equal(child.EXPO_NO_DOTENV, '1');
  const duplicate = vercelChildEnvironment({ Path: 'old', PATH: 'canonical' }, 'win32');
  assert.equal(duplicate.PATH, 'canonical');
  assert.deepEqual(Object.keys(duplicate).filter(key => key.toLowerCase() === 'path'), ['PATH']);
  assert.equal(vercelChildEnvironment({ PATH: '/usr/bin', Path: 'case-sensitive-setting' }, 'linux').Path, 'case-sensitive-setting');
});

test('protected curl receives only its own arguments, with credentials kept in the environment', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'ustogether-cli-test-'));
  try {
    const cli = join(directory, 'fake-cli.mjs');
    writeFileSync(cli, `console.log(JSON.stringify({ args: process.argv.slice(2), tokenPresent: process.env.VERCEL_TOKEN === 'test-token', noColor: process.env.NO_COLOR, dotenvDisabled: process.env.EXPO_NO_DOTENV }));`);
    const run = vercelRunner({ ...process.env, VERCEL_CLI_PATH: cli, VERCEL_TOKEN: 'test-token' });
    const args = ['curl', '/sign-in', '--deployment', 'https://test.vercel.app', '--yes', '--', '--silent'];
    const result = JSON.parse(await run(args));
    assert.deepEqual(result.args, args);
    assert.equal(result.tokenPresent, true);
    assert.equal(result.noColor, '1');
    assert.equal(result.dotenvDisabled, '1');
    assert.equal(result.args.includes('test-token'), false);
    const inspectArgs = ['inspect', 'https://test.vercel.app', '--json'];
    assert.deepEqual(JSON.parse(await run(inspectArgs)).args, inspectArgs);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('superseded or malformed main SHAs cannot publish', () => {
  assert.doesNotThrow(() => assertCurrentMain(SHA, SHA));
  assert.throws(() => assertCurrentMain(SHA, 'b'.repeat(40)), /Main has moved/);
  assert.throws(() => assertCurrentMain(SHA, ''), /valid main commit/);
});

test('both CLI JSON formats require Ready deployments of the intended environment', () => {
  const ready = { id: 'dpl_test123', url: 'ustogether-test.vercel.app', readyState: 'READY', target: 'production' };
  assert.equal(deploymentFromJson(ready, 'production').url, 'https://ustogether-test.vercel.app');
  assert.equal(deploymentFromJson({ status: 'ok', deployment: ready }, 'production').id, ready.id);
  assert.throws(() => deploymentFromJson({ ...ready, readyState: 'BUILDING' }, 'production'), /not Ready/);
  assert.throws(() => deploymentFromJson(ready, 'preview'), /Expected a preview/);
  assert.throws(() => deploymentFromJson({ ...ready, url: 'https://attacker.example' }, 'production'), /unexpected/);
});

test('hosted build config accepts public keys and rejects secrets or test URLs', () => {
  assert.doesNotThrow(() => validatePublicEnvironment(publicEnvironment(), 'production'));
  assert.doesNotThrow(() => validatePublicEnvironment(publicEnvironment(jwt('anon')), 'production'));
  assert.throws(() => validatePublicEnvironment(publicEnvironment('sb_secret_private'), 'production'), /publishable or legacy anon/);
  assert.throws(() => validatePublicEnvironment(publicEnvironment(jwt('service_role')), 'production'), /publishable or legacy anon/);
  assert.throws(() => validatePublicEnvironment(publicEnvironment().replace('example.supabase.co', 'fixture.invalid'), 'preview'), /hosted HTTPS/);
  assert.throws(() => validatePublicEnvironment(publicEnvironment('sb_publishable_test_key', 'https://another.vercel.app'), 'production'), /existing production domain/);
  assert.throws(() => validatePublicEnvironment(publicEnvironment('sb_publishable_test_key', `${PRODUCTION_URL}/wrong`), 'production'), /app origin/);
  assert.throws(() => validatePublicEnvironment(`${publicEnvironment()}\nEXPO_PUBLIC_OTHER="${jwt('service_role')}"`, 'preview'), /service-role/);
});

test('HTTP smoke rejects protected login HTML, missing scripts, redirects, and SPA asset fallbacks', () => {
  assert.deepEqual(assertSpaResponse(htmlResponse), ['/_expo/static/js/web/entry-test.js']);
  assert.throws(() => assertSpaResponse({ ...htmlResponse, status: 302 }), /SPA document/);
  assert.throws(() => assertSpaResponse({ ...htmlResponse, body: '<!doctype html><html>Vercel login</html>' }), /no JavaScript bundle/);
  assert.throws(() => assertSpaResponse({ ...htmlResponse, body: '<!doctype html><html><script src="/_next/static/chunks/auth.js"></script></html>' }), /no JavaScript bundle/);
  assert.throws(() => assertSpaResponse({ ...htmlResponse, body: '<!doctype html><html></html>' }), /no JavaScript bundle/);
  assert.equal(staticScriptPath('/bundle.js?v=1', PRODUCTION_URL), '/bundle.js?v=1');
  assert.throws(() => staticScriptPath('https://other.example/bundle.js', PRODUCTION_URL), /outside/);
  assert.doesNotThrow(() => assertJavaScriptResponse({ status: 200, headers: { 'content-type': 'application/javascript' }, body: 'window.app = true;' }));
  assert.throws(() => assertJavaScriptResponse(htmlResponse), /SPA fallback/);
  assert.throws(() => assertJavaScriptResponse({ ...htmlResponse, headers: { 'content-type': 'application/javascript' } }), /SPA fallback/);
  assert.throws(() => assertJavaScriptResponse({ status: 404, headers: { 'content-type': 'application/javascript' }, body: '' }), /missing/);
  for (const marker of ['ustogether-test.invalid', 'sb_publishable_isolated_browser_fixture']) {
    assert.throws(() => assertJavaScriptResponse({ status: 200, headers: { 'content-type': 'application/javascript' }, body: `window.config="${marker}";` }), /browser-test configuration/);
  }
});

test('HTTP response parsing checks the final header block', () => {
  assert.deepEqual(parseResponseHeaders('HTTP/1.1 200 Connection established\r\n\r\nHTTP/2 200\r\nContent-Type: application/javascript\r\nX-Test: value\r\n\r\n'), {
    'content-type': 'application/javascript', 'x-test': 'value',
  });
});

test('production build guard rejects fixture configuration in any emitted bundle', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'ustogether-export-test-'));
  try {
    const bundles = join(directory, '_expo/static/js/web');
    mkdirSync(bundles, { recursive: true });
    writeFileSync(join(directory, 'index.html'), document);
    writeFileSync(join(bundles, 'entry-test.js'), 'window.app = true;');
    assert.equal(await verifyExport(directory), 1);
    for (const marker of ['ustogether-test.invalid', 'sb_publishable_isolated_browser_fixture']) {
      writeFileSync(join(bundles, 'unreferenced-chunk.js'), `window.configuration="${marker}";`);
      await assert.rejects(verifyExport(directory), /browser-test configuration/);
    }
  } finally {
    if (!resolve(directory).startsWith(resolve(tmpdir()) + sep)) throw new Error('Unexpected test directory.');
    rmSync(directory, { recursive: true, force: true });
  }
});

function harness({ previewFailure = false, stagedFailure = false, publishedFailure = false, rollbackFailure = false, mainMoves = false } = {}) {
  const previous = { id: 'dpl_previous', url: 'https://ustogether-previous.vercel.app', target: 'production' };
  const preview = { id: 'dpl_preview', url: 'https://ustogether-preview.vercel.app', target: 'preview' };
  const staged = { id: 'dpl_staged', url: 'https://ustogether-staged.vercel.app', target: 'production' };
  const calls = [];
  let active = previous, mainReads = 0;
  return { calls, options: {
    expectedSha: SHA,
    currentMain: async () => { mainReads += 1; return mainMoves && mainReads > 1 ? 'b'.repeat(40) : SHA; },
    cli: {
      inspect: async () => { calls.push('inspect'); return active; },
      build: async target => { calls.push(`build:${target}`); },
      deploy: async target => { calls.push(`deploy:${target}`); return target === 'production' ? staged : preview; },
      promote: async () => { calls.push('promote'); active = staged; },
      rollback: async () => { calls.push('rollback'); if (rollbackFailure) throw new Error('rollback unavailable'); active = previous; },
    },
    smoke: async (url, protectedDeployment) => {
      calls.push(`smoke:${url}:${protectedDeployment}`);
      if (previewFailure && url === preview.url || stagedFailure && url === staged.url || publishedFailure && active.id === staged.id && url === PRODUCTION_URL) {
        throw new Error('smoke failed');
      }
    },
  } };
}

test('release verifies preview and independent production before promotion and public-domain checks', async () => {
  const { calls, options } = harness();
  await runRelease(options);
  assert.deepEqual(calls, [
    'inspect', 'build:preview', 'deploy:preview', 'smoke:https://ustogether-preview.vercel.app:true',
    'build:production', 'deploy:production', 'smoke:https://ustogether-staged.vercel.app:true',
    'promote', 'inspect', `smoke:${PRODUCTION_URL}:false`,
  ]);
});

test('preview failure leaves production untouched', async () => {
  const { calls, options } = harness({ previewFailure: true });
  await assert.rejects(runRelease(options), /smoke failed/);
  assert.ok(!calls.includes('build:production') && !calls.includes('promote') && !calls.includes('rollback'));
});

test('staged smoke failure or newer main leaves the production alias untouched', async () => {
  for (const change of [{ stagedFailure: true }, { mainMoves: true }]) {
    const { calls, options } = harness(change);
    await assert.rejects(runRelease(options));
    assert.ok(!calls.includes('promote') && !calls.includes('rollback'));
  }
});

test('failed production checks automatically restore and verify the preceding production', async () => {
  const { calls, options } = harness({ publishedFailure: true });
  await assert.rejects(runRelease(options), /smoke failed/);
  assert.ok(calls.includes('rollback'));
  assert.deepEqual(calls.slice(-3), ['rollback', 'inspect', `smoke:${PRODUCTION_URL}:false`]);
});

test('rollback failure reports both failures rather than claiming recovery', async () => {
  const { options } = harness({ publishedFailure: true, rollbackFailure: true });
  await assert.rejects(runRelease(options), error => error instanceof AggregateError && error.errors.length === 2 && /Inspect production immediately/.test(error.message));
});

test('Vercel Git automation cannot bypass the release gate and test exports are excluded', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(config.git.deploymentEnabled, false);
  assert.equal(config.outputDirectory, 'client/dist');
  const ignored = readFileSync(new URL('../.vercelignore', import.meta.url), 'utf8');
  for (const path of ['client/dist-e2e', 'playwright-report', 'test-results', 'e2e', '.agents', '.codex', '**/.env*']) assert.ok(ignored.split(/\r?\n/).includes(path));
});
