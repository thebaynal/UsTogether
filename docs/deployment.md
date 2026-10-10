# Deploying UsTogether

Production is [ustogether-tau.vercel.app](https://ustogether-tau.vercel.app), backed by hosted Supabase. Builds run at the repository root with Node 24, `npm ci`, and `npm run build`; Vercel publishes `client/dist`. Local Supabase/Docker is not needed for deployment. Hosted database migrations remain a separate, deliberate operation; never reset the hosted database.

## GitHub checks and optional publishing

Pull requests and pushes to `main` run TypeScript, existing regression tests, release safety tests, Chromium browser tests, and the production export. These checks do not receive deployment secrets. Fork PRs use the same checks and cannot publish. The workflow uses `pull_request`, never `pull_request_target`, and uploads no environment files or browser-test configuration.

Automatic publishing is **disabled by default**, matching the current preference. Successful main checks say that publishing is disabled; they do not claim a deployment occurred. Vercel's independent Git deployment trigger is disabled through `git.deploymentEnabled: false` so connecting a Git repository later cannot bypass the workflow gates. [Vercel documents this setting](https://vercel.com/docs/project-configuration/git-configuration#turning-off-all-automatic-deployments).

To opt in later:

1. Create an expiring Vercel token scoped to the existing `thebaynals-projects` team. Enter it directly in GitHub → Settings → Secrets and variables → Actions as the secret `VERCEL_TOKEN`; never put it in chat, source, or a public build variable.
2. Set the GitHub repository Actions variable `ENABLE_VERCEL_DEPLOYMENT` to `true`.
3. Push a verified commit to `main`, or run the workflow manually on `main`.

An enabled publishing job with a missing token fails clearly before creating a deployment. Set the variable back to `false` to disable future automatic publishing. The read-only `GITHUB_TOKEN` provided by Actions checks main's current commit; no additional GitHub secret is required.

## Release gates

`scripts/deploy-release.mjs` performs the following sequence:

1. Check that the verified commit is still the head of main, and record the existing Ready production deployment as a rollback reference.
2. Pull Preview settings, validate the public Supabase configuration, build and deploy a Preview export, and check hosted app routes plus their JavaScript assets.
3. Independently pull Production settings and build again. Production `EXPO_PUBLIC_APP_URL` must match the existing production origin.
4. Deploy the production build with `--prod --skip-domain`, keeping the current production domain unchanged; repeat hosted checks on that staged build.
5. Recheck main immediately before promotion, promote the staged production build, verify the domain's deployment identity, and repeat checks against the public production domain.

Checks cover `/`, `/sign-in`, `/spaces`, the invitation direct link, and the Expo bundle. They reject redirects, missing assets, HTML returned for JavaScript, and isolated browser-test configuration. They complement local browser tests; they do not sign into real accounts or change private memories.

Main workflow runs are serialized without cancelling an active release. A failure before promotion leaves the domain unchanged. A failure during promotion or subsequent verification automatically restores and verifies the recorded production deployment; the run still fails to report the release problem. If rollback also fails, it reports both failures and requires immediate inspection. Deployment IDs and outcomes are recorded in the Actions summary. This process does not roll back database migrations.

Protected Preview/staged checks use Vercel CLI 62.1.0's `vercel curl`. It can create a project automation protection-bypass token the first time, then reuse it; the protection itself remains enabled. This is part of the authorized publishing setup. Never enable CLI debug, verbose request logging, or tracing: they can expose the bypass credential. Responses are kept in temporary files and removed, not uploaded as artifacts.

## Authorized manual release

An explicit manual release can use an existing Vercel login without creating a GitHub token or enabling future automatic publishing. First run the same checks locally, including `npm run test:deploy` and `npm run test:e2e`, then commit/push the reviewed changes. The local helper requires a clean `main` checkout whose commit matches `origin/main`; it uses the same preview, production staging, main-head, domain, and rollback checks.

Use Vercel CLI 62.1.0, logged in and linked to this existing project, then run:

```sh
node scripts/deploy-release.mjs --local
```

On Windows, point `VERCEL_CLI_PATH` at the installed CLI's absolute `vercel/dist/vc.js` path; the helper executes it with Node rather than a shell wrapper. For a global installation:

```powershell
npm install --global vercel@62.1.0
$env:VERCEL_CLI_PATH = Join-Path (npm root --global) 'vercel/dist/vc.js'
node scripts/deploy-release.mjs --local
```

Existing cached installations work with the same variable. Use `vercel login`/`vercel link` first if needed. Local manual releases should not run concurrently with another release. No local DNS workaround is committed into the release path.

## Public environment and auth

Set `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `EXPO_PUBLIC_APP_URL` in the Vercel project's Preview and Production environments. Only a publishable or legacy anon key is allowed in the client. Environment files, `client/dist-e2e`, browser fixtures/reports, and agent configuration are excluded from uploaded source; the normal export remains `client/dist`. Expo local dotenv loading is disabled for release builds so Vercel settings supply the build configuration.

Supabase Auth's Site URL stays at production. Allow production routes, local development, and `ustogether://**`; add explicit preview URLs when testing email confirmation on a preview. Core accounts, private photos, membership policies, and shared themes are preserved.
