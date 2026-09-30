# UsTogether

A shared, private photo timeline for couples, friends, and teams. The timeline runs on iOS, Android, and the web from an Expo app. Supabase provides authentication, PostgreSQL, private photo storage, and real-time collaboration.

## Run locally

1. Install Node.js 22.13 or newer and Docker Desktop.
2. Run `npm install` at the repository root.
3. Run `npx supabase start`, then `npx supabase db reset` to apply the local schema and policies.
4. Copy `client/.env.example` to `client/.env.local` and fill in the local Supabase URL and publishable key printed by the CLI.
5. Run `npm run dev` for the Expo development server. Use `npm run web` to open the web version, or `npm run android` / `npm run ios` for a device or simulator.

Without Supabase credentials, the app shows setup instructions and does not load demo memories.

## Commands

- `npm run typecheck` checks the Expo app TypeScript.
- `npm test` checks timeline ordering, dates, image validation, and theme defaults.
- `npm run build` exports the web app to `client/dist`.
- `npx supabase db reset` recreates the local database and applies migrations.

## Supabase

The first migration in `supabase/migrations` creates spaces, memberships, invitations, memories, comments, reactions, private image storage, and row-level security policies. Invite tokens are single-use, expire after seven days, and are stored hashed. Authenticated RPC functions create spaces, issue/accept invites, leave spaces, and delete a space when its last member chooses to do so.

For production, create a Supabase project, link it with `npx supabase link`, apply migrations with `npx supabase db push`, and set `EXPO_PUBLIC_SUPABASE_URL` plus `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in the web and EAS build environments. Configure the production web URL and native app links in Supabase Auth before sending invite links.

See [UsTogether.md](UsTogether.md) for the product and data model notes.
