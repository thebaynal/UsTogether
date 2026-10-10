# Photo-first timeline and motion verification — 2026-10-10

The timeline now centers the selected whole photo, hides its story until activation, and reveals album actions in reserved space above the rail. Create space is centered. Album options retain theme and membership actions in a bounded, keyboard-accessible dialog. Apple-inspired refinements add restrained depth, readable type, immediate interruptible press feedback, touch-safe hover, and continuous palette changes using the existing animation utilities.

## Local checks

- App TypeScript: passed.
- Four existing `tsx` regression suites: passed.
- Deployment safety tests: 16 passed, including rejection of fixture-contaminated export chunks, Windows build-shell PATH preservation, and credential-safe protected curl invocation.
- Fresh isolated Chromium export and browser suite: 65 passed, one intentionally skipped desktop case for the mobile-only held-finger regression. Viewports: 390 × 844 and 1280 × 900; short-dialog check: 568 × 320.
- Production web export clears Metro's cache and checks every emitted JavaScript bundle before publication. The final artifact scan caught stale fixture configuration before any deployment; cache clearing and the new build guard prevent that output from being released.
- Eight project-local skills: validated; reference files and MIT license retained.
- Reviewer and security auditor: no remaining confirmed findings in the integrated changes.

The authorized local Vercel Preview build passed after normalizing Windows `Path` to `PATH`. Protected checks keep CLI credentials and color settings in environment variables, because the pinned CLI's beta curl parser forwards unknown global flags to curl. These fixes preserve the existing release gates.

Browser checks cover centering, initial hidden controls, photo/keyboard disclosure, focus restoration, native web snapping, boundaries/resize, realtime ordering/removal, loading/empty/error states, denied-read clearing, sustained-outage retention, auth/invitation redirects, original-file uploads, cleanup/duplicate prevention, all five themes, flashcard pause/loop behavior, and reduced motion. A delayed successful Leave response and a held-finger boundary gesture both reproduced failures before their fixes and passed afterward. Synthetic fixtures intercept HTTP and WebSockets; unexpected external requests fail verification.

Mobile and desktop screenshots were inspected. Screenshots, traces, exports, runtime logs, and account credentials remain ignored and excluded from deployment.

## Hosted demo and privacy checks

A separate ordinary demo account signed in successfully and has a private sample album with three photos. Through its normal membership, photo rows and signed previews load. Anonymous requests cannot read that album or its memories, or sign its private images. Existing user accounts, albums, and hosted schema were not changed.

These checks do not establish native iOS/Android device behavior, native screen-reader/Back interactions, OS keyboard behavior, or every authenticated non-member policy path. Existing signed photo links remain usable until their configured expiry.

## Dependency advisory review

The production dependency audit reports 29 propagated entries (19 high, 10 moderate, zero critical) from four underlying advisories. No exploitable application path was confirmed. Versions remain unchanged because npm's proposed broad upgrades/downgrades would require a separate compatibility review.

- [decode-uri-component denial of service](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr): the decoder is present in the browser bundle through query-string and React Navigation's fallback parser. Active Expo Router linking uses its fork with native `URLSearchParams`. Track the dormant parser risk; a direct 0.5.0 override is incompatible with query-string 7's callable CommonJS import.
- [braces glob parsing](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm): used by Metro file-watch/build tooling; no production glob endpoint was found.
- [node-forge RSA signature verification](https://github.com/advisories/GHSA-86w9-cpqp-85rv): traced to Expo CLI/code-signing tooling, with no app Updates signing configuration or Forge RSA implementation found in emitted web JavaScript.
- [uuid caller-provided buffers](https://github.com/advisories/GHSA-w5hq-g745-h8pq): Xcode tooling uses unaffected v4 without a supplied output buffer. Application IDs use Expo Crypto `randomUUID()`.

This call-path review does not prove every dependency path safe. Track upstream fixes and repeat the review before enabling new linking, signing, or glob-processing behavior.

## Release policy

GitHub verifies PRs and main without deployment secrets. Automatic publishing remains disabled; the repository has no `ENABLE_VERCEL_DEPLOYMENT` opt-in variable. The authorized manual release uses the same Preview, independent staged Production, current-main, promotion, hosted-asset, and rollback gates. No hosted migrations are needed for this change. Release identity and hosted results are recorded separately after a successful publication.
