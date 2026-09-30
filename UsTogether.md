# UsTogether — Product and Architecture

## Product

UsTogether is a private, shared photo timeline for couples, friends and family, and teams. People add one photo with a date, title, optional caption, and optional milestone tag. The timeline sorts by the date the memory happened, not the date it was uploaded.

The app targets iOS, Android, and web. Its visual direction is cute and pastel, with a clean journal layout, rounded photo cards, gentle accents, and readable dark text. Couple spaces default to rose, friend/group spaces to peach, and team spaces to sky; any member can choose another palette.

## Collaboration and access

- Spaces are private and joined through an invitation. A recipient signs in before accepting.
- Any member can invite another person, add/edit/delete memories, comment, and add a reaction.
- Members can edit or delete their own comments and change or remove their own reaction.
- A member can leave only for themselves. No member can remove another.
- The last member must explicitly delete the space rather than leave it empty.
- V1 includes live timeline, comment, and reaction updates; it does not include public galleries, chat, or offline edits.

Invitations use a random, single-use token. The database stores only its SHA-256 digest, and the token expires after seven days.

## Technical architecture

- **Client:** Expo, React Native, Expo Router, and TypeScript; one app project targets native iOS, Android, and web.
- **Backend:** Supabase Auth, PostgreSQL, Storage, and Realtime.
- **Access control:** PostgreSQL row-level security checks membership for spaces, memories, discussions, and photo objects. Image URLs are signed and short-lived.
- **Database:** profiles, spaces, space_members, space_invites, memories, comments, and reactions.
- **Media:** a private `memory-images` bucket accepts JPEG, PNG, and WebP files up to 10 MB. Object paths are kept in database rows, not public URLs.
- **Server operations:** authenticated PostgreSQL functions create spaces, issue and accept invites, leave a space, and delete a space when only its final member remains.

## Repository layout

```text
client/
  app/                  Expo Router screens
  src/components/       Shared UI building blocks
  src/features/         Auth, spaces, memories, comments, reactions
  src/lib/              Supabase client and platform setup
  src/theme/            Pastel palettes and design tokens
  src/types/            Database and domain types
  tests/                Domain-level checks
supabase/
  migrations/           Schema, functions, storage rules, and RLS policies
```

## Local setup

Run `npm install`, then `npx supabase start` and `npx supabase db reset`. Copy `client/.env.example` to `client/.env.local` and add the local Supabase URL and publishable key. Start the app with `npm run dev`; `npm run web`, `npm run android`, and `npm run ios` select a target. Without Supabase configuration, the client shows setup guidance and does not display seeded or fallback data.

## Acceptance checks

- A user can sign up, sign in, create a space, invite someone, and accept the invite after signing in.
- A used, expired, or invalid invite cannot add a member.
- Non-members cannot query private space data or fetch its images.
- Members see photo additions, comments, and reactions without refreshing.
- Timeline ordering remains correct for out-of-order uploads and same-day memories.
- Upload validation rejects unsupported formats and files larger than 10 MB.
- Theme defaults follow the space type, and a member can override the palette.
