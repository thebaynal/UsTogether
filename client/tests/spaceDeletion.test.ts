import assert from 'node:assert/strict';
import { deleteSpaceSafely, MAX_DELETION_BACKUP_BYTES } from '../src/features/spaces/spaceDeletion';

const SPACE = 'my-space';
const first = `${SPACE}/first.jpg`;
const second = `${SPACE}/second.png`;
type Options = {
  spaceId?: string;
  counts?: (number | null)[];
  countError?: string;
  memoryError?: string;
  readError?: string;
  hugePhoto?: boolean;
  removeError?: string;
  rpcError?: string;
  rpcThrows?: boolean;
  restoreFailures?: number;
  empty?: boolean;
  nativeBlobs?: boolean;
  truncatedMemories?: boolean;
  changedMemories?: boolean;
  rpcCommitted?: boolean;
  claimedPhotoSize?: number;
};

function fixture(options: Options = {}) {
  const fixtureSpace = options.spaceId ?? SPACE;
  const firstPath = `${fixtureSpace}/first.jpg`;
  const secondPath = `${fixtureSpace}/second.png`;
  const originals = options.empty ? new Map<string, string>() : new Map([[firstPath, 'first photo'], [secondPath, 'second photo']]);
  const stored = new Map(originals);
  const events: string[] = [];
  let countReads = 0;
  let restores = 0;
  let rpcCalls = 0;
  let memoryReads = 0;
  let committed = false;
  const error = (value?: string) => value ? { message: value } : null;
  const bucket = {
    async download(path: string) {
      events.push(`read:${path}`);
      if (options.readError && path === secondPath) return { data: null, error: error(options.readError) };
      if (options.hugePhoto) return {
        data: { size: MAX_DELETION_BACKUP_BYTES + 1, arrayBuffer() { throw new Error('Should not allocate oversized bytes'); } }, error: null
      };
      if (options.claimedPhotoSize) return {
        data: { size: options.claimedPhotoSize, arrayBuffer() { throw new Error('Must reject the shared backup budget before allocation'); } }, error: null
      };
      const photo = stored.get(path);
      if (photo && options.nativeBlobs) return {
        data: { size: photo.length, bytes: new TextEncoder().encode(photo), close() { events.push(`release:${path}`); } }, error: null
      };
      return { data: photo ? new Blob([photo]) : null, error: photo ? null : { message: 'Photo missing' } };
    },
    async remove(paths: string[]) {
      events.push('remove');
      assert.deepEqual(paths, [...originals.keys()]);
      // Simulate a partially committed request even if the response is an error.
      if (options.removeError) stored.delete(paths[0]);
      else for (const path of paths) stored.delete(path);
      return { error: error(options.removeError) };
    },
    async upload(path: string, body: ArrayBuffer, value: { contentType: string; upsert: boolean }) {
      events.push(`restore:${path}`);
      assert.equal(value.contentType, path.endsWith('.jpg') ? 'image/jpeg' : 'image/png');
      assert.equal(value.upsert, true);
      assert.ok(body instanceof ArrayBuffer, 'Native restores must use binary ArrayBuffer bodies');
      if (committed) return { error: { message: 'Membership required' } };
      if (++restores <= (options.restoreFailures ?? 0)) return { error: { message: 'Offline' } };
      stored.set(path, new TextDecoder().decode(body));
      return { error: null };
    }
  };
  const client = {
    from(table: string) {
      const query = {
        select(fields: string, value?: { count: string; head?: boolean }) {
          if (table === 'space_members') {
            assert.deepEqual(value, { count: 'exact', head: true });
            assert.equal(fields, 'user_id');
          } else {
            assert.equal(table, 'memories');
            assert.equal(fields, 'image_path,image_mime_type');
            assert.deepEqual(value, { count: 'exact' });
          }
          return query;
        },
        async eq(key: string, value: string) {
          assert.equal(key, 'space_id');
          assert.equal(value, fixtureSpace);
          if (table === 'space_members') {
            events.push('members');
            const counts = options.counts ?? [1];
            return { count: committed ? 0 : counts[Math.min(countReads++, counts.length - 1)], error: error(options.countError) };
          }
          events.push('memories');
          if (++memoryReads === 2 && options.changedMemories) {
            originals.set(`${fixtureSpace}/new.webp`, 'new photo');
            stored.set(`${fixtureSpace}/new.webp`, 'new photo');
          }
          return {
            data: committed ? [] : [...originals.keys()].map((path) => ({ image_path: path, image_mime_type: path.endsWith('.jpg') ? 'image/jpeg' : 'image/png' })),
            count: committed ? 0 : originals.size + (options.truncatedMemories ? 1 : 0),
            error: error(options.memoryError)
          };
        }
      };
      return query;
    },
    storage: { from(bucketName: string) { assert.equal(bucketName, 'memory-images'); return bucket; } },
    async rpc(name: string, value: { p_space_id: string }) {
      assert.equal(name, 'delete_space');
      assert.deepEqual(value, { p_space_id: fixtureSpace });
      events.push('rpc');
      rpcCalls++;
      if (options.rpcCommitted) committed = true;
      if (options.rpcThrows) throw new Error('Connection interrupted');
      return { error: error(options.rpcError) };
    }
  } as unknown as Parameters<typeof deleteSpaceSafely>[0];
  return { client, events, stored, originals, rpcCalls: () => rpcCalls };
}

async function main() {
  for (const count of [0, 2, null]) {
    const test = fixture({ counts: [count] });
    await assert.rejects(deleteSpaceSafely(test.client, SPACE), /membership|last remaining member/);
    assert.deepEqual(test.events, ['members']);
    assert.deepEqual(test.stored, test.originals);
  }
  const changedMembers = fixture({ counts: [1, 2] });
  await assert.rejects(deleteSpaceSafely(changedMembers.client, SPACE), /last remaining member/);
  assert.deepEqual(changedMembers.stored, changedMembers.originals);
  assert.equal(changedMembers.events.includes('remove'), false);
  console.log('✓ non-final or changed membership never removes photos');

  for (const options of [{ countError: 'Offline' }, { memoryError: 'Permission denied' }, { readError: 'Read failed' }, { hugePhoto: true }, { truncatedMemories: true }, { changedMemories: true }]) {
    const test = fixture(options);
    await assert.rejects(deleteSpaceSafely(test.client, SPACE));
    assert.deepEqual(test.stored, test.originals);
    assert.equal(test.events.includes('remove'), false);
    assert.equal(test.rpcCalls(), 0);
  }
  console.log('✓ query, read, budget, truncated-result, and changed-album failures leave originals intact');

  for (const options of [{ rpcError: 'Another member joined' }, { rpcThrows: true }, { removeError: 'Storage request failed' }]) {
    const test = fixture(options);
    await assert.rejects(deleteSpaceSafely(test.client, SPACE), /photos were restored/);
    assert.deepEqual(test.stored, test.originals);
    assert.equal(test.rpcCalls(), options.removeError ? 0 : 1);
  }
  console.log('✓ RPC rejection, transport failure, and partial storage failure restore original photos');

  const success = fixture();
  await deleteSpaceSafely(success.client, SPACE);
  assert.deepEqual(success.events, ['members', 'memories', `read:${first}`, `read:${second}`, 'members', 'memories', 'remove', 'rpc']);
  assert.equal(success.stored.size, 0);
  const empty = fixture({ empty: true });
  await deleteSpaceSafely(empty.client, SPACE);
  assert.deepEqual(empty.events, ['members', 'memories', 'members', 'memories', 'rpc']);
  console.log('✓ successful deletion backs up all photos before removal and database deletion');

  const previousReader = globalThis.FileReader;
  class NativeReader {
    result: ArrayBuffer | null = null;
    onload: (() => void) | null = null;
    readAsArrayBuffer(blob: { bytes: Uint8Array }) {
      this.result = blob.bytes.buffer as ArrayBuffer;
      this.onload?.();
    }
  }
  Object.defineProperty(globalThis, 'FileReader', { configurable: true, writable: true, value: NativeReader });
  try {
    const native = fixture({ nativeBlobs: true, rpcError: 'Rejected' });
    await assert.rejects(deleteSpaceSafely(native.client, SPACE), /photos were restored/);
    assert.deepEqual(native.stored, native.originals);
    assert.ok(native.events.includes(`release:${first}`));
    assert.ok(native.events.includes(`release:${second}`));
  } finally {
    Object.defineProperty(globalThis, 'FileReader', { configurable: true, writable: true, value: previousReader });
  }
  console.log('✓ native Blob backups use FileReader and restore binary bodies without retaining Blob resources');

  const recovery = fixture({ rpcError: 'Deletion rejected', restoreFailures: 1 });
  await assert.rejects(deleteSpaceSafely(recovery.client, SPACE), /1 photo\(s\) could not be restored.*Keep this page open/);
  const unrelated = fixture({ spaceId: 'other-space' });
  await deleteSpaceSafely(unrelated.client, 'other-space');
  assert.equal(unrelated.stored.size, 0);
  const retryOffset = recovery.events.length;
  await assert.rejects(deleteSpaceSafely(recovery.client, SPACE), /photos were restored/);
  assert.deepEqual(recovery.stored, recovery.originals);
  assert.equal(recovery.events[retryOffset], `restore:${first}`, 'A retry must repair retained backups before any new deletion');
  console.log('✓ per-space retries repair retained backups first without blocking unrelated deletions');

  const ambiguousSpace = 'committed-space';
  const ambiguous = fixture({ spaceId: ambiguousSpace, rpcThrows: true, rpcCommitted: true });
  await assert.rejects(deleteSpaceSafely(ambiguous.client, ambiguousSpace), /Deletion could not be confirmed.*2 photo\(s\) could not be restored/);
  const another = fixture({ spaceId: 'another-space' });
  await deleteSpaceSafely(another.client, 'another-space');
  assert.equal(another.stored.size, 0);
  const budget = fixture({ spaceId: 'large-space', claimedPhotoSize: MAX_DELETION_BACKUP_BYTES - 1 });
  await assert.rejects(deleteSpaceSafely(budget.client, 'large-space'), /Safety backups from an earlier deletion/);
  assert.equal(budget.events.includes('remove'), false);
  assert.equal(budget.rpcCalls(), 0);
  const retryAmbiguousOffset = ambiguous.events.length;
  await assert.rejects(deleteSpaceSafely(ambiguous.client, ambiguousSpace), /Could not restore 2 photo\(s\)/);
  assert.deepEqual(ambiguous.events.slice(retryAmbiguousOffset), [`restore:${ambiguousSpace}/first.jpg`, `restore:${ambiguousSpace}/second.png`]);
  assert.equal(ambiguous.rpcCalls(), 1, 'Do not repeat database deletion before retained photos can be repaired');
  console.log('✓ committed-RPC transport ambiguity retains its photos without locking other spaces, within a shared 64 MiB budget');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
