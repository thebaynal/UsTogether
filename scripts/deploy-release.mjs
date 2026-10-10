import { spawn } from 'node:child_process';
import { appendFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  PRODUCTION_URL, VERCEL_ORG_ID, VERCEL_PROJECT_ID, assertJavaScriptResponse, assertSpaResponse, deploymentFromJson,
  parseResponseHeaders, runRelease, staticScriptPath, validatePublicEnvironment,
} from './deploy-utils.mjs';

function diagnostic(text, env) {
  let safe = text;
  for (const name of ['VERCEL_TOKEN', 'GITHUB_TOKEN', 'VERCEL_AUTOMATION_BYPASS_SECRET']) {
    if (env[name]) safe = safe.replaceAll(env[name], '[redacted]');
  }
  return safe.replace(/\b(?:sb_secret_|sb_service_role_)\S+/g, '[redacted]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[redacted]').slice(-6000);
}

export function releaseConfig(env, { local = false, context } = {}) {
  if (local) {
    if (context?.branch !== 'main' || !context.clean) throw new Error('A local release requires a clean main checkout. Commit and verify the changes first.');
  } else {
    if (env.ENABLE_VERCEL_DEPLOYMENT !== 'true') throw new Error('Automatic publishing is disabled. Enable it explicitly before running this CI release.');
    if (env.GITHUB_ACTIONS !== 'true' || env.GITHUB_REF !== 'refs/heads/main' ||
        !['push', 'workflow_dispatch'].includes(env.GITHUB_EVENT_NAME)) {
      throw new Error('CI releases only publish main from GitHub Actions.');
    }
    if (!env.VERCEL_TOKEN?.trim()) {
      throw new Error('Automatic deployment is not configured: add VERCEL_TOKEN securely in GitHub Actions secrets. No deployment was made.');
    }
    if (!env.GITHUB_TOKEN || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(env.GITHUB_REPOSITORY ?? '')) {
      throw new Error('The release is missing its GitHub repository configuration.');
    }
  }
  const expectedSha = local ? context.sha : env.GITHUB_SHA;
  const orgId = local ? context.orgId : env.VERCEL_ORG_ID;
  const projectId = local ? context.projectId : env.VERCEL_PROJECT_ID;
  if (!/^[a-f0-9]{40}$/.test(expectedSha ?? '') || !/^team_[A-Za-z0-9]+$/.test(orgId ?? '') ||
      !/^prj_[A-Za-z0-9]+$/.test(projectId ?? '')) {
    throw new Error('The release is missing its repository, commit, or linked Vercel project configuration.');
  }
  if (orgId !== VERCEL_ORG_ID || projectId !== VERCEL_PROJECT_ID) throw new Error('This helper only releases the existing UsTogether Vercel project.');
  if (env.VERCEL_CLI_PATH && !isAbsolute(env.VERCEL_CLI_PATH)) throw new Error('VERCEL_CLI_PATH must be absolute.');
  return { expectedSha, repository: env.GITHUB_REPOSITORY, productionUrl: PRODUCTION_URL, orgId, projectId };
}

function vercelRunner(env) {
  const executable = env.VERCEL_CLI_PATH ? process.execPath : 'vercel';
  const prefix = env.VERCEL_CLI_PATH ? [env.VERCEL_CLI_PATH] : [];
  return (args, { timeout = 15 * 60_000, quietFailure = false } = {}) => new Promise((resolve, reject) => {
    // Never enable debug/trace: CLI protection-bypass debug output contains credentials.
    const auth = env.VERCEL_TOKEN?.trim() ? ['--token', env.VERCEL_TOKEN] : [];
    const child = spawn(executable, [...prefix, ...auth, '--no-color', ...args], {
      env: { ...env, VERCEL_TELEMETRY_DISABLED: '1', NO_COLOR: '1', EXPO_NO_DOTENV: '1' },
      stdio: ['ignore', 'pipe', 'pipe'], shell: false,
    });
    let stdout = '', stderr = '', exceeded = false;
    const timer = setTimeout(() => child.kill('SIGTERM'), timeout);
    for (const [stream, collect] of [[child.stdout, data => { stdout += data; }], [child.stderr, data => { stderr += data; }]]) {
      stream.setEncoding('utf8');
      stream.on('data', data => {
        collect(data);
        if (stdout.length + stderr.length > 32 * 1024 * 1024) { exceeded = true; child.kill('SIGTERM'); }
      });
    }
    child.on('error', error => { clearTimeout(timer); reject(new Error(`Unable to run the pinned Vercel CLI: ${error.code ?? 'spawn failed'}.`)); });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (code !== 0 || signal || exceeded) {
        // JSON responses and HTTP bodies stay private to the helper. Diagnostics are redacted.
        if (!quietFailure) console.error(diagnostic(stderr, env));
        reject(new Error(`Vercel ${args[0]} failed${signal ? ` (${signal})` : ''}.`));
      } else resolve(stdout);
    });
  });
}

async function protectedResponse(run, deployment, path) {
  const directory = await mkdtemp(join(tmpdir(), 'ustogether-deploy-'));
  try {
    const headersFile = join(directory, 'headers.txt');
    const bodyFile = join(directory, 'body.txt');
    // The CLI reuses (or initially creates) this project's automation protection-bypass token.
    // Save response headers/body only to temporary files, never logs or workflow artifacts.
    const status = await run(['curl', path, '--deployment', deployment, '--yes', '--',
      '--silent', '--show-error', '--connect-timeout', '10', '--max-time', '30',
      '--dump-header', headersFile, '--output', bodyFile, '--write-out', '%{http_code}'], { timeout: 90_000, quietFailure: true });
    return { status: Number(status.trim()), headers: parseResponseHeaders(await readFile(headersFile, 'utf8')), body: await readFile(bodyFile, 'utf8') };
  } finally { await rm(directory, { recursive: true, force: true }); }
}

async function publicResponse(origin, path) {
  const response = await fetch(new URL(path, origin), { redirect: 'manual', signal: AbortSignal.timeout(30_000) });
  return { status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() };
}

async function retry(check) {
  let error;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try { return await check(); } catch (failure) { error = failure; }
    if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw error;
}

export function hostedSmoke(run) {
  return async (origin, protectedDeployment) => {
    const request = path => protectedDeployment ? protectedResponse(run, origin, path) : publicResponse(origin, path);
    let bundlePaths = [];
    for (const path of ['/', '/sign-in', '/spaces', '/invite/deployment-smoke-invalid-token']) {
      const scripts = await retry(async () => assertSpaResponse(await request(path)));
      if (path === '/sign-in') bundlePaths = scripts.map(src => staticScriptPath(src, origin));
    }
    for (const path of [...new Set(bundlePaths)]) {
      await retry(async () => assertJavaScriptResponse(await request(path)));
    }
    console.log(`Hosted app routes and JavaScript assets passed: ${origin}`);
  };
}

function gitRead(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { stdio: ['ignore', 'pipe', 'pipe'], shell: false });
    let stdout = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', data => { stdout += data; });
    child.stderr.resume(); // Remote diagnostics can contain credential-bearing URLs.
    const timer = setTimeout(() => child.kill('SIGTERM'), 60_000);
    child.on('error', () => { clearTimeout(timer); reject(new Error('Git is required to verify a local main release.')); });
    child.on('close', code => { clearTimeout(timer); code === 0 ? resolve(stdout.trim()) : reject(new Error('Unable to verify the local checkout or remote main commit.')); });
  });
}

async function localContext() {
  const [branch, sha, status, linked] = await Promise.all([
    gitRead(['branch', '--show-current']), gitRead(['rev-parse', 'HEAD']), gitRead(['status', '--porcelain']),
    readFile('.vercel/project.json', 'utf8'),
  ]);
  const project = JSON.parse(linked);
  return { branch, sha, clean: !status, orgId: project.orgId, projectId: project.projectId };
}

export async function releaseFromActions(env = process.env, { local = false } = {}) {
  const config = releaseConfig(env, { local, context: local ? await localContext() : undefined });
  const releaseEnv = { ...env, VERCEL_ORG_ID: config.orgId, VERCEL_PROJECT_ID: config.projectId };
  const run = vercelRunner(releaseEnv);
  const version = (await run(['--version'], { timeout: 60_000 })).trim();
  if (!/^62\.1\.0$/.test(version)) throw new Error('The release requires Vercel CLI 62.1.0.');
  const cli = {
    async inspect(url, target) { return deploymentFromJson(JSON.parse(await run(['inspect', url, '--json'])), target); },
    async build(target) {
      console.log(`Preparing an independent ${target} build.`);
      await run(['pull', '--yes', `--environment=${target}`]);
      validatePublicEnvironment(await readFile(`.vercel/.env.${target}.local`, 'utf8'), target, config.productionUrl);
      await run(target === 'production' ? ['build', '--prod', '--yes'] : ['build', '--yes']);
    },
    async deploy(target) {
      const args = ['deploy', '--prebuilt', '--yes', '--json'];
      args.push(...(target === 'production' ? ['--prod', '--skip-domain'] : ['--target=preview']));
      return deploymentFromJson(JSON.parse(await run(args)), target);
    },
    async promote(url) { console.log('Promoting the verified production build.'); await run(['promote', url, '--yes', '--timeout', '5m']); },
    async rollback(url) { console.log('Restoring the preceding Ready production deployment.'); await run(['rollback', url, '--yes', '--timeout', '5m']); },
  };
  const currentMain = async () => {
    if (local) return (await gitRead(['ls-remote', '--exit-code', 'origin', 'refs/heads/main'])).split(/\s+/)[0];
    const response = await fetch(`https://api.github.com/repos/${config.repository}/commits/main`, {
      headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error('Unable to verify the current main commit before publishing.');
    return (await response.json()).sha;
  };
  const records = [];
  try {
    return await runRelease({ cli, smoke: hostedSmoke(run), currentMain, ...config, record(label, deployment) {
      console.log(`${label}: ${deployment.url} (${deployment.id})`);
      records.push(`- ${label}: [${deployment.id}](${deployment.url})`);
    } });
  } finally {
    if (env.GITHUB_STEP_SUMMARY) await appendFile(env.GITHUB_STEP_SUMMARY,
      `\n## UsTogether release\n\nCommit: \`${config.expectedSha}\`\n\n${records.join('\n')}\n`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  releaseFromActions(process.env, { local: process.argv.includes('--local') }).catch(error => {
    console.error(diagnostic(error.message, process.env));
    if (error instanceof AggregateError) for (const failure of error.errors) console.error(diagnostic(failure.message, process.env));
    process.exitCode = 1;
  });
}
