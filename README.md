# UsTogether

A shared, private photo timeline for couples, friends, and teams. The timeline runs on iOS, Android, and the web from an Expo app. Supabase provides authentication, PostgreSQL, private photo storage, and real-time collaboration.

## Run locally

1. Install Node.js 22.13 or newer and Docker Desktop. Open Docker Desktop, use Linux containers, and wait for its engine to be running. Run `docker info` in PowerShell to confirm it is reachable.
2. Run `npm install` at the repository root.
3. Run `npx supabase start` from the repository root. On a fresh local database, this applies the migrations automatically. Run `npx supabase status` to see the connection settings.
4. Create or edit `client/.env.local` with the values below. Use the API URL and publishable key (or legacy anon key) from `npx supabase status`. Never use the service-role or secret key in the client.
5. Run `npm run dev` for the Expo development server. Use `npm run web` to open the web version, or `npm run android` / `npm run ios` for a device or simulator.

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
- `npm run build` exports the web app to `client/dist`.
- `npx supabase db reset` recreates the local database and applies migrations.

## Vercel deployment

The web app is deployed at https://ustogether-tau.vercel.app using hosted Supabase. Docker is not required for this setup. The root `vercel.json` installs with `npm ci`, builds with `npm run build`, and publishes `client/dist` with a single-page route fallback.

Set `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `EXPO_PUBLIC_APP_URL` in the Vercel project's Preview and Production environments. Use only a publishable or legacy anon key; service-role keys must never be included in a client build. Local environment files and verification fixtures are excluded by `.vercelignore`.

After `npx vercel login` and `npx vercel link`, run `npx vercel deploy --target preview` to review a build, and `npx vercel deploy --prod` to publish.

The GitHub Actions workflow checks TypeScript, tests, and the web build on pull requests and pushes to `main`. To enable automatic Vercel deployment after successful checks, add a Vercel access token as the repository Actions secret `VERCEL_TOKEN` under Settings → Secrets and variables → Actions. Without the secret, deployment is skipped and the checks still run successfully. With it, successful pushes to `main` deploy to the existing Vercel project; you can also run the workflow manually on `main`. The workflow already includes this project's organization and project IDs. It pulls the production build environment from Vercel, builds there in the runner, and publishes the prebuilt output. Never commit the token or put it in a public build variable. GitHub Pages is no longer used. Supabase migrations remain a separate, deliberate step.

Apply missing Supabase migrations before publishing changes that depend on them. The October 1 migrations enable realtime updates for space themes and repair the private storage policies' object-path references. They preserve existing data and membership restrictions. Do not reset the hosted database.

Set Supabase Auth's Site URL to the production URL. Allow that URL's routes, local development (`http://localhost:8081/**`), and the native scheme (`ustogether://**`) as redirects. Add explicit preview URLs when testing email confirmation there.

Space palettes are shared by all members. Motion respects the device or browser's reduced-motion preference. The tests cover original-file uploads, validation, theme update confirmation, and stale theme reads alongside the existing domain checks.

The sign-in page keeps the form above a three-card romantic carousel. Cards advance every four seconds and pause during form or carousel interaction, submission, and background activity. Reduced-motion users navigate manually with the labeled controls.

## Supabase

The first migration in `supabase/migrations` creates spaces, memberships, invitations, memories, comments, reactions, private image storage, and row-level security policies. Invite tokens are single-use, expire after seven days, and are stored hashed. Authenticated RPC functions create spaces, issue/accept invites, leave spaces, and delete a space when its last member chooses to do so.

For production, create a Supabase project, link it with `npx supabase link`, apply migrations with `npx supabase db push`, and set `EXPO_PUBLIC_SUPABASE_URL` plus `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the web and EAS build environments. Configure the production web URL and native app links in Supabase Auth before sending invite links.

See [UsTogether.md](UsTogether.md) for the product and data model notes.
