# Photo-first timeline and motion verification — 2026-10-10

The timeline now centers the selected whole photo, hides its story until activation, and reveals album actions in reserved space above the rail. Create space is centered. Album options retain theme and membership actions in a bounded, keyboard-accessible dialog. Apple-inspired refinements add restrained depth, readable type, immediate interruptible press feedback, touch-safe hover, and continuous palette changes using the existing animation utilities.

## Local checks

- App TypeScript: passed.
- Four existing `tsx` regression suites: passed.
- Deployment safety tests: 13 passed.
- Fresh isolated Chromium export and browser suite: 65 passed, one intentionally skipped desktop case for the mobile-only held-finger regression. Viewports: 390 × 844 and 1280 × 900; short-dialog check: 568 × 320.
- Production web export: passed after the final gesture fix.
- Eight project-local skills: validated; reference files and MIT license retained.
- Reviewer and security auditor: no remaining confirmed findings in the integrated changes.

Browser checks cover centering, initial hidden controls, photo/keyboard disclosure, focus restoration, native web snapping, boundaries/resize, realtime ordering/removal, loading/empty/error states, denied-read clearing, sustained-outage retention, auth/invitation redirects, original-file uploads, cleanup/duplicate prevention, all five themes, flashcard pause/loop behavior, and reduced motion. A delayed successful Leave response and a held-finger boundary gesture both reproduced failures before their fixes and passed afterward. Synthetic fixtures intercept HTTP and WebSockets; unexpected external requests fail verification.

Mobile and desktop screenshots were inspected. Screenshots, traces, exports, runtime logs, and account credentials remain ignored and excluded from deployment.

## Hosted demo and privacy checks

A separate ordinary demo account signed in successfully and has a private sample album with three photos. Through its normal membership, photo rows and signed previews load. Anonymous requests cannot read that album or its memories, or sign its private images. Existing user accounts, albums, and hosted schema were not changed.

These checks do not establish native iOS/Android device behavior, native screen-reader/Back interactions, OS keyboard behavior, or every authenticated non-member policy path. Existing signed photo links remain usable until their configured expiry.

## Release policy

GitHub verifies PRs and main without deployment secrets. Automatic publishing remains disabled; the repository has no `ENABLE_VERCEL_DEPLOYMENT` opt-in variable. The authorized manual release uses the same Preview, independent staged Production, current-main, promotion, hosted-asset, and rollback gates. No hosted migrations are needed for this change. Release identity and hosted results are recorded separately after a successful publication.
