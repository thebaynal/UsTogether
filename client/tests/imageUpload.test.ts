import assert from 'node:assert/strict';
import { prepareImageUpload } from '../src/features/memories/imageUpload';
import { MAX_IMAGE_BYTES } from '../src/features/memories/logic';

async function main() {
  let reads = 0;
  const unexpectedRead: typeof fetch = async () => { reads++; throw new Error('Preview URI must not be read'); };
  for (const [extension, type] of [['jpg', 'image/jpeg'], ['png', 'image/png'], ['webp', 'image/webp']]) {
    const file = new File([new Uint8Array([1, 2, 3])], `photo.${extension}`, { type });
    const upload = await prepareImageUpload({ uri: 'unreadable-preview', fileName: file.name, file }, unexpectedRead);
    assert.equal(upload.body, file);
    assert.equal(upload.mimeType, type);
  }
  assert.equal(reads, 0);
  console.log('✓ browser uploads preserve original files without fetching preview URIs');

  await assert.rejects(prepareImageUpload({ uri: '', fileName: 'empty.jpg', file: new File([], 'empty.jpg', { type: 'image/jpeg' }) }, unexpectedRead), /empty/);
  await assert.rejects(prepareImageUpload({ uri: '', fileName: 'big.jpg', file: new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], 'big.jpg', { type: 'image/jpeg' }) }, unexpectedRead), /10 MB/);
  await assert.rejects(prepareImageUpload({ uri: '', fileName: 'photo.jpg', file: new File(['gif'], 'photo.jpg', { type: 'image/gif' }) }, unexpectedRead), /JPEG, PNG, or WebP/);
  console.log('✓ validation uses actual file size and MIME type');

  const image = { uri: 'file:///photo.jpg', fileName: 'photo.jpg', mimeType: 'image/jpeg' };
  const bytes = new Uint8Array([1, 2, 3]).buffer;
  const nativeRead = (async () => ({ ok: false, status: 0, arrayBuffer: async () => bytes })) as typeof fetch;
  assert.equal((await prepareImageUpload(image, nativeRead)).body, bytes);
  await assert.rejects(prepareImageUpload(image, (async () => new Response(null, { status: 404 })) as typeof fetch), /Could not read/);
  await assert.rejects(prepareImageUpload(image, (async () => { throw new Error('Network'); }) as typeof fetch), /Could not read/);
  await assert.rejects(prepareImageUpload(image, (async () => new Response(new Uint8Array())) as typeof fetch), /empty/);
  console.log('✓ native status-zero reads work; failures and empty images are handled');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
