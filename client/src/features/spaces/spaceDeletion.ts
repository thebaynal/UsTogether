import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { ImageMimeType } from '@/types/domain';

type DeletionClient = Pick<SupabaseClient<Database>, 'from' | 'rpc' | 'storage'>;
type PhotoBackup = { path: string; mimeType: ImageMimeType; body: ArrayBuffer };

// A whole-album rollback must fit in memory on native and web. Keep failed
// restores in this session so a retry can repair them before deleting anything.
export const MAX_DELETION_BACKUP_BYTES = 64 * 1024 * 1024;
const recovery = new Map<string, PhotoBackup[]>();
let deleting = false;

function retainedBackupBytes() {
  let bytes = 0;
  for (const photos of recovery.values()) for (const photo of photos) bytes += photo.body.byteLength;
  return bytes;
}

function message(error: unknown) {
  return error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Please check your connection.';
}

function photoBytes(photo: Blob): Promise<ArrayBuffer> {
  if (typeof photo.arrayBuffer === 'function') return photo.arrayBuffer();
  // React Native's Blob implements FileReader, but not Blob.arrayBuffer.
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Photo read failed.'));
    reader.onabort = () => reject(new Error('Photo read was cancelled.'));
    reader.onload = () => reader.result instanceof ArrayBuffer
      ? resolve(reader.result) : reject(new Error('Photo read did not return image bytes.'));
    reader.readAsArrayBuffer(photo);
  });
}

async function requireLastMember(client: DeletionClient, spaceId: string) {
  const { count, error } = await client.from('space_members')
    .select('user_id', { count: 'exact', head: true }).eq('space_id', spaceId);
  if (error) throw new Error(`Could not check this space's members: ${error.message}`);
  if (count !== 1) throw new Error(count && count > 1
    ? 'Only the last remaining member can delete a space. Leave the space instead.'
    : 'Your membership could not be confirmed. Refresh your spaces before trying again.');
}

async function readPhotos(client: DeletionClient, spaceId: string) {
  const { data, count, error } = await client.from('memories')
    .select('image_path,image_mime_type', { count: 'exact' }).eq('space_id', spaceId);
  if (error || !data) throw new Error(`Could not read this space's memories: ${error?.message ?? 'Please check your connection.'}`);
  // PostgREST can cap a result page. Never remove a space after backing up
  // only the visible subset of its photos.
  if (count !== data.length) throw new Error('The complete album could not be backed up safely. Delete individual memories before deleting the space.');
  return data;
}

async function restorePhotos(client: DeletionClient, spaceId: string, photos: PhotoBackup[]) {
  const failed: PhotoBackup[] = [];
  const bucket = client.storage.from('memory-images');
  for (const photo of photos) {
    try {
      const { error } = await bucket.upload(photo.path, photo.body, { contentType: photo.mimeType, upsert: true });
      if (error) failed.push(photo);
    } catch {
      failed.push(photo);
    }
  }
  if (failed.length) recovery.set(spaceId, failed);
  else recovery.delete(spaceId);
  return failed.length;
}

export async function deleteSpaceSafely(client: DeletionClient, spaceId: string): Promise<void> {
  if (deleting) throw new Error('A space deletion is already in progress. Please wait.');
  deleting = true;
  try {
    const pending = recovery.get(spaceId);
    if (pending) {
      const failed = await restorePhotos(client, spaceId, pending);
      if (failed) throw new Error(`Could not restore ${failed} photo(s). Keep this page open, check your connection, and retry. If access changed, ask a member to restore your access first.`);
    }
    await requireLastMember(client, spaceId);
    const memories = await readPhotos(client, spaceId);
    const bucket = client.storage.from('memory-images');
    const photos: PhotoBackup[] = [];
    // Unresolved deletion results must not block other spaces, but their
    // retained bytes and this operation share one bounded safety budget.
    const backupLimit = MAX_DELETION_BACKUP_BYTES - retainedBackupBytes();
    const budgetMessage = backupLimit < MAX_DELETION_BACKUP_BYTES
      ? 'Safety backups from an earlier deletion use some of this device\'s memory budget. Retry restoring those photos before deleting this large album, or delete individual memories.'
      : 'This album is too large to back up safely on this device. Delete individual memories before deleting the space.';
    let bytes = 0;
    try {
      for (const memory of memories) {
        const { data, error: readError } = await bucket.download(memory.image_path);
        if (readError || !data) throw new Error(`Could not back up a photo: ${readError?.message ?? 'Please check your connection.'}`);
        try {
          if (bytes + data.size > backupLimit) throw new Error(budgetMessage);
          // ArrayBuffer preserves Supabase's supported native binary upload path.
          const body = await photoBytes(data);
          if (!body.byteLength) throw new Error('A photo backup was empty. Please try again.');
          bytes += body.byteLength;
          if (bytes > backupLimit) throw new Error(budgetMessage);
          photos.push({ path: memory.image_path, mimeType: memory.image_mime_type, body });
        } finally {
          // Release native Blob resources after copying their bytes.
          (data as Blob & { close?: () => void }).close?.();
        }
      }
    } catch (cause) {
      throw new Error(`Nothing was deleted. ${message(cause)}`);
    }
    // Membership may have changed while downloading. The RPC still makes the
    // final authoritative check; its rejection rolls photos back below.
    await requireLastMember(client, spaceId);
    const latest = await readPhotos(client, spaceId);
    const backedUp = new Set(photos.map((photo) => `${photo.path}:${photo.mimeType}`));
    if (latest.length !== photos.length || latest.some((photo) => !backedUp.has(`${photo.image_path}:${photo.image_mime_type}`))) {
      throw new Error('Nothing was deleted. The album changed while backing up its photos. Refresh the album and try again.');
    }
    let removalAttempted = false;
    try {
      if (photos.length) {
        removalAttempted = true;
        const { error: removeError } = await bucket.remove(photos.map((photo) => photo.path));
        if (removeError) throw removeError;
      }
      const { error: deleteError } = await client.rpc('delete_space', { p_space_id: spaceId });
      if (deleteError) throw deleteError;
    } catch (cause) {
      // A storage request can partially commit even when its response fails.
      const failed = removalAttempted ? await restorePhotos(client, spaceId, photos) : 0;
      if (failed) throw new Error(`Deletion could not be confirmed and ${failed} photo(s) could not be restored. Keep this page open, check your connection, and retry. If the space has disappeared, refresh your spaces before proceeding.`);
      throw new Error(`Space deletion failed. ${removalAttempted ? 'Your photos were restored. ' : ''}${message(cause)}`);
    }
  } finally {
    deleting = false;
  }
}
