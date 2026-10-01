import assert from 'node:assert/strict';
import { saveSpaceTheme } from '../src/features/spaces/themeService';
import { beginThemeRead, readCachedTheme, rememberSpaceTheme } from '../src/features/spaces/themeCache';

function client(result: { data: { theme_key: string } | null; error: { message: string } | null }) {
  const query = {
    update(value: unknown) { assert.deepEqual(value, { theme_key: 'mint' }); return query; },
    eq(key: string, value: string) { assert.equal(key, 'id'); assert.equal(value, 'my-space'); return query; },
    select() { return query; }, single: async () => result
  };
  return { from(table: string) { assert.equal(table, 'spaces'); return query; } } as unknown as Parameters<typeof saveSpaceTheme>[0];
}

async function main() {
  assert.equal((await saveSpaceTheme(client({ data: { theme_key: 'mint' }, error: null }), 'my-space', 'mint')).theme_key, 'mint');
  await assert.rejects(saveSpaceTheme(client({ data: null, error: null }), 'my-space', 'mint'), /not saved/);
  await assert.rejects(saveSpaceTheme(client({ data: { theme_key: 'rose' }, error: null }), 'my-space', 'mint'), /not saved/);
  await assert.rejects(saveSpaceTheme(client({ data: null, error: { message: 'Permission denied' } }), 'my-space', 'mint'), /Permission denied/);
  console.log('✓ themes require a confirmed update and surface missing rows or permission failures');
  const pendingRead = beginThemeRead('my-space');
  rememberSpaceTheme('my-space', 'sky');
  rememberSpaceTheme('my-space', 'rose', pendingRead);
  assert.equal(readCachedTheme('my-space'), 'sky');
  rememberSpaceTheme('my-space', 'peach', beginThemeRead('my-space'));
  assert.equal(readCachedTheme('my-space'), 'peach');
  console.log('✓ delayed theme reads cannot overwrite a newly saved palette');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
