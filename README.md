# UsTogether

A shared, private photo timeline for couples, friends, and teams. The timeline runs on iOS, Android, and the web from an Expo app. Supabase provides authentication, PostgreSQL, private photo storage, and real-time collaboration.

## Run locally

1. Install Node.js 24 and run `npm ci` at the repository root.
2. Use the existing hosted Supabase configuration in `client/.env.local`, or set your hosted API URL and publishable key. Never use a service-role or secret key in the client. Docker is not needed when using hosted Supabase.
3. Run `npm run web` and open the localhost URL printed by Expo. Use `npm run dev` for the Expo development server, or `npm run android` / `npm run ios` for a device or simulator.

For an optional local backend, install Docker Desktop, select Linux containers, and wait until `docker info` shows a running Server. Then run `npx supabase start` at the repository root. A fresh local database applies the migrations automatically; `npx supabase status` shows the local connection values for `client/.env.local` below.

Without Supabase credentials, the app shows setup instructions and does not load demo memories.

```dotenv
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=replace-with-local-publishable-or-anon-key
EXPO_PUBLIC_APP_URL=http://localhost:8081
```

For the browser, run `npm run web` and open the localhost URL printed by Expo (usually `http://localhost:8081`). Keep the terminal running. Restart Expo after changing environment variables. To clear Metro's cache, run `npm run web -w client -- --clear`.

If `supabase start` reports `CliConfigParseError`, check `supabase/config.toml`. Function settings such as `verify_jwt` belong under `[functions.function_name]`, not directly under `[functions]`; this app does not currently use Edge Functions.

If a command cannot connect to `dockerDesktopLinuxEngine`, start Docker Desktop and wait until `docker info` succeeds, then retry `npx supabase start`. Only run `npx supabase db reset` when you intend to erase and recreate the local database.

You can also use a hosted Supabase project in `client/.env.local`; Docker is needed only for a local Supabase backend. The hosted project must have this repository's migrations applied.

## Commands

- `npm run typecheck` checks the Expo app TypeScript.
- `npm test` checks timeline ordering, dates, image validation, and theme defaults.
- `npm run test:deploy` checks release gates, public configuration, hosted-response validation, and rollback behavior.
- `npm run test:e2e` runs isolated browser tests against a separate web export with mock Supabase responses.
- `npm run build` exports the web app to `client/dist`.
- `npx supabase db reset` recreates the local database and applies migrations.

## Vercel deployment

The web app is deployed at https://ustogether-tau.vercel.app using hosted Supabase. Docker is not required for this setup. The root `vercel.json` installs with `npm ci`, builds with `npm run build`, and publishes `client/dist` with a single-page route fallback.

Set `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `EXPO_PUBLIC_APP_URL` in the Vercel project's Preview and Production environments. Use only a publishable or legacy anon key; service-role keys must never be included in a client build. Local environment files and verification fixtures are excluded by `.vercelignore`.

Authorized manual releases use `node scripts/deploy-release.mjs --local` with an existing Vercel CLI 62.1.0 login and linked project. The helper requires a clean, pushed main checkout and verifies Preview plus staged Production before assigning the production domain. See [deployment instructions](docs/deployment.md) for Windows CLI setup, checks, and rollback behavior.

The GitHub Actions workflow checks TypeScript, regression and release tests, browser behavior, and the production export on pull requests and pushes to `main`, without deployment secrets. Automatic publishing remains disabled unless the repository variable `ENABLE_VERCEL_DEPLOYMENT` is explicitly `true`; enabling it also requires the securely entered Actions secret `VERCEL_TOKEN`. Enabled releases verify a Preview build, independently build and verify staged Production, recheck main, then promote and verify the existing domain. A failed release check restores the previous production deployment. Fork PRs cannot publish, and Vercel's independent Git trigger is disabled so it cannot bypass the checks. Missing credentials fail an enabled publishing job rather than reporting a successful deployment. Never commit tokens or put them in public variables. GitHub Pages is no longer used; Supabase migrations remain a separate, deliberate step.

Apply missing Supabase migrations before publishing changes that depend on them. The October 1 migrations enable realtime updates for space themes and repair the private storage policies' object-path references. They preserve existing data and membership restrictions. Do not reset the hosted database.

Set Supabase Auth's Site URL to the production URL. Allow that URL's routes, local development (`http://localhost:8081/**`), and the native scheme (`ustogether://**`) as redirects. Add explicit preview URLs when testing email confirmation there.

Space palettes are shared by all members. Motion respects the device or browser's reduced-motion preference. The tests cover original-file uploads, validation, theme update confirmation, and stale theme reads alongside the existing domain checks.

The sign-in page keeps the form above a three-card romantic carousel. Cards advance every four seconds and pause during form or carousel interaction, submission, and background activity. Reduced-motion users navigate manually with the labeled controls.

## Supabase

The first migration in `supabase/migrations` creates spaces, memberships, invitations, memories, comments, reactions, private image storage, and row-level security policies. Invite tokens are single-use, expire after seven days, and are stored hashed. Authenticated RPC functions create spaces, issue/accept invites, leave spaces, and delete a space when its last member chooses to do so.

For production, create a Supabase project, link it with `npx supabase link`, apply migrations with `npx supabase db push`, and set `EXPO_PUBLIC_SUPABASE_URL` plus `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the web and EAS build environments. Configure the production web URL and native app links in Supabase Auth before sending invite links.

See [UsTogether.md](UsTogether.md) for the product and data model notes.

Project-local UI and motion skills are installed in `.agents/skills/`; see [the skill catalog](docs/project-skills.md). They retain the application's romantic palettes, existing motion utilities, reduced-motion support, and privacy requirements.
