# UsTogether release verification — 8 October 2026

## Changes

- Added an original album-and-heart logo, reusable native/web wordmark, app icon, and favicon.
- Refined album cards, responsive page widths, paper forms, theme previews, timeline cards, and uncropped memory details. The sign-in form and flashcards remain in one centered column.
- Reused the existing motion system and reduced-motion preference handling; added no animation dependency.
- Bridged native accessibility state to ARIA for React Native Web 0.21, so theme/type radio choices, loading buttons, and reaction toggles expose their state correctly.
- Added guarded album deletion: confirm sole membership, back up photos within a shared 64 MiB budget, recheck album state, and restore on failed storage/database operations. Recovery is scoped to each album.
- Replaced inaccessible album/memory database errors with actionable messages.
- Patched compatible shell-quote and source-map-js dependencies.

## Verification

- TypeScript and all four regression suites passed, including browser/native upload preparation, theme update confirmation/cache ordering, and album-deletion failure/recovery paths.
- Vercel preview ran root `npm ci` and `npm run build` successfully and exported `client/dist`.
- Browser checks used 390 × 844 and 1280 × 900 viewports. Checked empty and populated albums, loading and access-error states, logo/sign-in, photo selection, JPEG and PNG saving, oversized-file rejection, saved photo reload, portrait containment, theme selection/persistence, and invitation joining between two ordinary mock accounts.
- An authenticated account outside an album could not read its contents. The hosted memory-images bucket is private, limited to 10 MB, and restricted to JPEG, PNG, and WebP.
- Anonymous album API access returned 401 / 42501; an unauthenticated public URL for a known QA photo returned 400 and no image. Sign-in flashcards retained typed email/focus while paused and manually navigated.
- Verified checked/unchecked theme radio state in the DOM and keyboard activation with Enter. React Native Web derives disabled semantics from the actual Pressable disabled prop, which current app callers provide. Its radio roles do not activate with Space.
- Android/iOS device execution and OS-level reduced-motion behavior were not exercised; native binary preparation and reduced-motion handling were checked in tests/source as applicable.

## Deployment

The verified preview was `https://ustogether-fqrf8f9t5-thebaynals-projects.vercel.app`. The production build was checked with production environment settings before promotion. Vercel independently confirms the Ready production deployment `dpl_6jBCk2CaAhgTq1QiTxcgfXZcSFmv` and the existing `https://ustogether-tau.vercel.app` alias. Live sign-in and the shared QA album work on that domain.

The preceding Ready production deployment, `dpl_E5mEF5sKVXLMs4Z8CdJL6YsLACsp` (`https://ustogether-kyypgv139-thebaynals-projects.vercel.app`), is the verified rollback candidate. To roll back an authorized release, promote that deployment using Vercel; no database rollback is needed for this release because it applied no migration.

## Remaining limitations

- npm reports 29 dependency advisory entries (19 high, 10 moderate, no critical), including transitive propagation. Remaining upstream items include decode-uri-component through Expo Router, node-forge, braces, and uuid through xcode. Do not use `npm audit fix --force`: the proposed dependency changes downgrade Expo/React Native incompatibly. The malformed-query decoder issue remains a browser availability risk; build-tool advisories remain documented maintenance work.
- Database and object storage do not share one transaction. Album deletion uses compensating restoration; recovery bytes are held in memory. Closing the app during recovery can lose those bytes, and a concurrent photo inserted after the final snapshot can leave an orphaned object. Large albums exceeding the backup budget must have memories removed individually before album deletion.
- Mock accounts and a clearly labeled Design QA album with synthetic images were created in hosted Supabase for verification. Existing user accounts and albums were preserved. No hosted reset, migration, policy expansion, or secret exposure was required.
- GitHub Actions still verifies changes; production deployment remains conditional on the optional VERCEL_TOKEN secret, which the user chose to leave unset.
