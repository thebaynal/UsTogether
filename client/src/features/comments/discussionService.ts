import type { Comment, Reaction } from '@/types/domain';
import { requireSupabase } from '@/lib/supabase';

function raise(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(error.message);
}

export async function listDiscussion(memoryId: string) {
  const client = requireSupabase();
  const [{ data: commentRows, error: commentsError }, { data: reactionRows, error: reactionsError }] = await Promise.all([
    client.from('comments').select('id,memory_id,user_id,body,created_at,updated_at').eq('memory_id', memoryId).order('created_at'),
    client.from('reactions').select('id,memory_id,user_id,emoji').eq('memory_id', memoryId)
  ]);
  raise(commentsError);
  raise(reactionsError);

  const userIds = [...new Set((commentRows ?? []).map((row) => row.user_id))];
  const { data: profiles, error: profilesError } = userIds.length
    ? await client.from('profiles').select('id,display_name').in('id', userIds)
    : { data: [], error: null };
  raise(profilesError);
  const displayNames = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));

  const comments: Comment[] = (commentRows ?? []).map((row) => ({
    id: row.id,
    memoryId: row.memory_id,
    userId: row.user_id,
    authorName: displayNames.get(row.user_id) ?? 'Friend',
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
  const reactions: Reaction[] = (reactionRows ?? []).map((row) => ({
    id: row.id,
    memoryId: row.memory_id,
    userId: row.user_id,
    emoji: row.emoji
  }));
  return { comments, reactions };
}

export async function addComment(memoryId: string, userId: string, body: string) {
  const cleanBody = body.trim();
  if (!cleanBody || cleanBody.length > 500) throw new Error('Comments need 1–500 characters.');
  const { error } = await requireSupabase().from('comments').insert({ memory_id: memoryId, user_id: userId, body: cleanBody });
  raise(error);
}

export async function updateComment(commentId: string, body: string) {
  const cleanBody = body.trim();
  if (!cleanBody || cleanBody.length > 500) throw new Error('Comments need 1–500 characters.');
  const { error } = await requireSupabase().from('comments').update({ body: cleanBody }).eq('id', commentId);
  raise(error);
}

export async function removeComment(commentId: string) {
  const { error } = await requireSupabase().from('comments').delete().eq('id', commentId);
  raise(error);
}

export async function toggleReaction(memoryId: string, userId: string, emoji: string) {
  const client = requireSupabase();
  const { data: current, error: lookupError } = await client
    .from('reactions').select('id,emoji').eq('memory_id', memoryId).eq('user_id', userId).maybeSingle();
  raise(lookupError);

  if (current?.emoji === emoji) {
    const { error } = await client.from('reactions').delete().eq('id', current.id);
    raise(error);
    return;
  }

  const { error } = current
    ? await client.from('reactions').update({ emoji }).eq('id', current.id)
    : await client.from('reactions').insert({ memory_id: memoryId, user_id: userId, emoji });
  raise(error);
}
