# UsTogether development

UsTogether is a private shared photo timeline for couples, friends, and teams. The npm workspace contains an Expo / React Native / Expo Router client, hosted Supabase, and a Vercel web export. Read the current package files before choosing version-specific APIs.

## Project map

- `client/app/`: routes, authentication, invitations, spaces, themes, and memories.
- `client/src/components/`: shared controls, romantic decorations, flashcards, and motion utilities.
- `client/src/theme/palettes.ts`: shared rose, lavender, peach, mint, and sky palettes.
- `client/src/features/`: typed auth, spaces, memories, and discussion services.
- `client/src/types/`: domain and database contracts.
- `client/tests/`: domain, upload, and theme regression tests using `tsx`.
- `supabase/migrations/`: schema, RPCs, membership policies, private storage, and realtime publication.
- `vercel.json` and `.github/workflows/deploy.yml`: web hosting and CI.

## Working rules

Preserve existing accounts, memories, membership rules, invitation redirects, and shared per-space themes. Use additive migrations; never reset the hosted database. Local Supabase requires Docker, but developing against hosted Supabase does not.

Keep photos private and enforce membership in database and storage policies. Only publishable/anon Supabase keys belong in the client. Never put secret keys or deployment tokens in source, public environment variables, logs, or responses.

Preserve the browser picker's original `File` upload path and native binary upload path. Supported images are JPEG, PNG, and WebP, up to 10 MB. Distinguish save failure from preview failure after a successful save; avoid duplicate memories and clean up uploads after failed database insertion.

Keep themes in palette tokens and confirm the updated space before showing save success. Preserve focus refresh, cache handling, and realtime subscriptions so members see current memories and palettes.

Follow the warm romantic design: cream backgrounds, plum text, rounded albums, pill controls, and paper-like captions. Use existing motion utilities: 120 ms press feedback, 220 ms content transitions, 300 ms entrances, and initial-card staggering capped at 200 ms. Respect reduced motion, preserve focus and form state, and avoid replaying entrances on background refresh. Keep the sign-in flashcards below the form, with manual navigation and automatic scrolling paused during interaction, submission, and inactivity.

Keep changes scoped. Do not add a framework, animation dependency, or test framework without a concrete need. Preserve native and web behavior; report platforms that were actually checked.

## Verification

Run commands from the repository root:

- `npm run typecheck`
- `npm test`
- `npm run test:deploy`
- `npm run test:e2e` (isolated Chromium browser checks; no real account credentials)
- `npm run build` (exports `client/dist`)
- `npm run web` for browser verification

Choose checks appropriate to the change. For UI work, inspect affected mobile and desktop layouts, keyboard/focus behavior, and relevant loading, empty, error, and populated states. For uploads, themes, auth, or invitations, check a success path and the meaningful failure paths. Agent-definition-only changes need configuration validation rather than an application build.

The GitHub workflow verifies pull requests and main pushes without deployment secrets. The user has chosen to keep automatic publishing disabled for now: it requires an explicit `ENABLE_VERCEL_DEPLOYMENT=true` repository variable plus the securely entered `VERCEL_TOKEN` secret. An enabled release verifies Preview and independent staged Production, rechecks main, promotes, checks the existing domain, and restores the previous deployment if release checks fail. Vercel's independent Git deployment trigger is disabled. Adding or using agents does not authorize publishing. Authorized manual releases may use existing Vercel login through `node scripts/deploy-release.mjs --local` after checks, from a clean pushed main checkout. See `docs/deployment.md` for setup and security details, including CLI-managed protected-preview bypass tokens.

## Project agents

Project skills are installed in `.agents/skills/` from the user's local skill collection. Use `apple-design` for interface and motion refinement while preserving the romantic palettes and photo-first layout. Apply platform-specific recipes only when they fit the installed Expo/React Native versions; skill examples do not authorize new dependencies or override reduced-motion, privacy, or deployment requirements. See `docs/project-skills.md` for the installed catalog.

Definitions and usage examples are in `.codex/agents/README.md`. When delegation is requested, choose only roles relevant to the task:

- `expo-react-native-expert`: app implementation, routing, state, images, motion, and platform behavior.
- `ui-designer`: concrete visual, interaction, and accessibility guidance; read-only by default.
- `supabase-developer`: typed services, database migrations, RPCs, RLS, storage, and realtime.
- `test-automator`: focused regression tests and behavioral verification.
- `security-auditor`: auth, membership, photo privacy, and credential review; read-only by default.
- `deployment-engineer`: Vercel, GitHub Actions, environment configuration, and release verification.
- `reviewer`: evidence-based review of correctness, regressions, and missing coverage; read-only by default.

Give each implementation agent explicit ownership of files or a feature boundary. Parallelize independent work; sequence edits to shared files and migrations. The parent integrates results and verifies the finished change. No agent should create further agents unless its assigned task asks for delegation.
