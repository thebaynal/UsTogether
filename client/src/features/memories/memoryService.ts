import * as Crypto from 'expo-crypto';
import type { ImageMimeType, Memory } from '@/types/domain';
import { requireSupabase } from '@/lib/supabase';
import { sortMemories } from './logic';
import { prepareImageUpload, type ImageSelection } from './imageUpload';

const SIGNED_URL_SECONDS = 10 * 60;

type MemoryInput = {
  spaceId: string;
  userId: string;
  title: string;
  date: string;
  caption: string;
  milestoneTag: string;
  image: ImageSelection;
};

type MemoryRow = {
  id: string;
  space_id: string;
  created_by: string | null;
  title: string;
  memory_date: string;
  caption: string | null;
  milestone_tag: string | null;
  image_path: string;
  image_mime_type: ImageMimeType;
  created_at: string;
};

function raise(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(error.message);
}

function fileExtension(type: ImageMimeType) {
  if (type === 'image/jpeg') return 'jpg';
  return type.split('/')[1];
}

function mapMemory(row: MemoryRow, imageUrl: string): Memory {
  return {
    id: row.id,
    spaceId: row.space_id,
    createdBy: row.created_by,
    title: row.title,
    date: row.memory_date,
    caption: row.caption,
    milestoneTag: row.milestone_tag,
    imagePath: row.image_path,
    imageUrl,
    imageMimeType: row.image_mime_type,
    createdAt: row.created_at
  };
}

async function signedImageUrl(path: string) {
  const { data, error } = await requireSupabase().storage.from('memory-images').createSignedUrl(path, SIGNED_URL_SECONDS);
  raise(error);
  return data.signedUrl;
}

export async function listMemories(spaceId: string): Promise<Memory[]> {
  const client = requireSupabase();
  const { data: rows, error } = await client
    .from('memories')
    .select('id,space_id,created_by,title,memory_date,caption,milestone_tag,image_path,image_mime_type,created_at')
    .eq('space_id', spaceId)
    .is('deleted_at', null)
    .order('memory_date', { ascending: true })
    .order('created_at', { ascending: true });
  raise(error);
  if (!rows?.length) return [];

  const { data: signedUrls, error: signedError } = await client.storage
    .from('memory-images')
    .createSignedUrls(rows.map((row) => row.image_path), SIGNED_URL_SECONDS);
  if (signedError) return sortMemories(rows.map((row) => mapMemory(row as MemoryRow, '')));
  const urlsByPath = new Map((signedUrls ?? []).map((item) => [item.path, item.signedUrl]));
  return sortMemories(rows.map((row) => mapMemory(row as MemoryRow, urlsByPath.get(row.image_path) ?? '')));
}

export async function getMemory(memoryId: string): Promise<Memory> {
  const { data: row, error } = await requireSupabase()
    .from('memories')
    .select('id,space_id,created_by,title,memory_date,caption,milestone_tag,image_path,image_mime_type,created_at')
    .eq('id', memoryId)
    .is('deleted_at', null)
    .single();
  raise(error);
  const typedRow = row as MemoryRow;
  return mapMemory(typedRow, await signedImageUrl(typedRow.image_path).catch(() => ''));
}

export async function createMemory(input: MemoryInput): Promise<Memory> {
  const client = requireSupabase();
  const { body, mimeType } = await prepareImageUpload(input.image);

  const id = Crypto.randomUUID();
  const imagePath = `${input.spaceId}/${id}.${fileExtension(mimeType)}`;
  const { error: uploadError } = await client.storage.from('memory-images').upload(imagePath, body, {
    contentType: mimeType,
    upsert: false
  });
  if (uploadError) throw new Error(`Your photo could not be uploaded: ${uploadError.message}`);

  const { data: row, error: insertError } = await client.from('memories').insert({
    id,
    space_id: input.spaceId,
    created_by: input.userId,
    title: input.title.trim(),
    memory_date: input.date,
    caption: input.caption.trim() || null,
    milestone_tag: input.milestoneTag.trim() || null,
    image_path: imagePath,
    image_mime_type: mimeType
  }).select('id,space_id,created_by,title,memory_date,caption,milestone_tag,image_path,image_mime_type,created_at').single();

  if (insertError) {
    const { error: cleanupError } = await client.storage.from('memory-images').remove([imagePath]);
    throw new Error(cleanupError
      ? `The memory was not saved and its uploaded photo needs cleanup: ${cleanupError.message}`
      : insertError.message);
  }

  const typedRow = row as MemoryRow;
  // The memory is already committed. A preview failure must not turn a saved
  // memory into an apparent save failure and invite duplicate submissions.
  const imageUrl = await signedImageUrl(imagePath).catch(() => '');
  return mapMemory(typedRow, imageUrl);
}

export async function updateMemory(memoryId: string, input: {
  title: string;
  date: string;
  caption: string;
  milestoneTag: string;
}) {
  const { error } = await requireSupabase().from('memories').update({
    title: input.title.trim(),
    memory_date: input.date,
    caption: input.caption.trim() || null,
    milestone_tag: input.milestoneTag.trim() || null
  }).eq('id', memoryId);
  raise(error);
  return getMemory(memoryId);
}

export async function deleteMemory(memoryId: string) {
  const client = requireSupabase();
  const { data: row, error: lookupError } = await client.from('memories').select('image_path,image_mime_type').eq('id', memoryId).single();
  raise(lookupError);
  const { data: backup, error: backupError } = await client.storage.from('memory-images').download(row.image_path);
  raise(backupError);
  const { error: storageError } = await client.storage.from('memory-images').remove([row.image_path]);
  raise(storageError);
  const { error } = await client.from('memories').delete().eq('id', memoryId);
  if (error) {
    const { error: restoreError } = await client.storage.from('memory-images').upload(row.image_path, backup, {
      contentType: row.image_mime_type,
      upsert: true
    });
    throw new Error(restoreError
      ? `Memory deletion failed and its photo could not be restored: ${restoreError.message}`
      : error.message);
  }
}
