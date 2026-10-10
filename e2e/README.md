# Isolated browser regression tests

Run from the repository root:

```sh
npm ci
npx playwright install chromium
npm run test:e2e
```

`test:e2e` typechecks the tests, exports the real web application with a synthetic
Supabase origin, and serves `client/dist-e2e` on 127.0.0.1:4173. The normal
`client/dist` production export is separate. No hosted project or credentials
are used. `EXPO_NO_DOTENV=1` prevents local hosted configuration from leaking
into this child build; HTTP and WebSocket responses are controlled by the
test-side fixture. Unexpected remote calls fail tests. Each browser context
receives fresh data and synthetic auth storage; production auth is unchanged.

Both exports clear Metro's transform cache because Expo can otherwise reuse
inlined environment values from the other build. The production build also
checks every emitted web bundle and rejects the fixture origin/key.

Chromium omits file-backed multipart bytes from request interception. A test-side
fetch observer records the selected browser File's name, MIME type, size, and
SHA-256 before forwarding the original fetch unchanged. Upload assertions compare
that digest with the fixture image and separately count uploads and insertions.

The PNG portrait and JPEG landscape are generated illustrations used solely as
fixtures. Tests run Chromium at 390 × 844 and 1280 × 900, with failures captured
in ignored `test-results/` and `playwright-report/`. Populated timeline proof
screenshots are saved under ignored `.tmp/` for visual review.

Touch drags use separate input frames and verify centered native snapping,
flashcard boundary handling while a finger is held, and automatic resumption
without a mouse clearing touch hover. Sustained read outages remain active
through the SDK's retries until the test restores service. Membership-exit
coverage holds the Leave response while Realtime revokes access, checking both
immediate privacy clearing and completion of the successful exit.

For iterations against an already rebuilt test export, set `E2E_SKIP_BUILD=1`.
Do not use this shortcut after changing app code or build settings. CI always
builds a fresh isolated export. Live RLS/storage enforcement, real browsers on
devices, OS keyboards/background state, and native image reads require separate
verification; mocked browser tests do not establish those guarantees.
