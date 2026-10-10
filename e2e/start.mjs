import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const expo = resolve(dirname(require.resolve('expo/package.json')), 'bin/cli');

// These values belong only to this child export. Production uses its own build
// and client/dist; the fake origin cannot contact a hosted Supabase project.
if (process.env.E2E_SKIP_BUILD !== '1') {
  const result = spawnSync(process.execPath, [expo, 'export', '--platform', 'web', '--output-dir', 'dist-e2e'], {
    cwd: resolve(root, 'client'),
    stdio: 'inherit',
    env: {
      ...process.env,
      CI: '1',
      EXPO_NO_DOTENV: '1',
      EXPO_PUBLIC_SUPABASE_URL: 'https://ustogether-test.invalid',
      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_isolated_browser_fixture',
      EXPO_PUBLIC_APP_URL: 'http://127.0.0.1:4173'
    }
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

await import('./serve.mjs');
