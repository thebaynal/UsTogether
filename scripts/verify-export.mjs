import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertJavaScriptResponse, assertSpaResponse, staticScriptPath } from './deploy-utils.mjs';

export async function verifyExport(directory = 'client/dist') {
  const root = resolve(directory);
  const document = await readFile(resolve(root, 'index.html'), 'utf8');
  const scripts = assertSpaResponse({ status: 200, headers: { 'content-type': 'text/html' }, body: document });
  for (const source of scripts) {
    const path = staticScriptPath(source, 'https://export.local');
    if (!path.startsWith('/_expo/static/js/web/') || !path.endsWith('.js')) throw new Error('Unexpected exported app script.');
    await readFile(resolve(root, `.${path}`));
  }
  // Check every emitted web bundle, including chunks not named by index.html.
  const bundles = await readdir(resolve(root, '_expo/static/js/web'));
  let count = 0;
  for (const name of bundles.filter((file) => file.endsWith('.js'))) {
    assertJavaScriptResponse({ status: 200, headers: { 'content-type': 'application/javascript' },
      body: await readFile(resolve(root, '_expo/static/js/web', name), 'utf8') });
    count++;
  }
  if (!count) throw new Error('The export contains no app bundles.');
  return count;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyExport().then((count) => console.log(`Verified production export: ${count} bundle(s), no browser-test configuration.`))
    .catch((error) => { console.error(error.message); process.exitCode = 1; });
}
