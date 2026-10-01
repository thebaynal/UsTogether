import * as Linking from 'expo-linking';
import { Platform } from 'react-native';
import type { Space, SpaceKind, SpaceMember, ThemeKey } from '@/types/domain';
import { requireSupabase } from '@/lib/supabase';
import { saveSpaceTheme } from './themeService';
import { beginThemeRead, rememberSpaceTheme } from './themeCache';

type SpaceRow = {
  id: string;
  name: string;
  kind: SpaceKind;
  theme_key: ThemeKey | null;
  created_at: string;
};

function raise(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(error.message);
}

export async function listSpaces(userId: string): Promise<Space[]> {
  const client = requireSupabase();
  const { data: memberships, error: membershipError } = await client
    .from('space_members').select('space_id').eq('user_id', userId);
  raise(membershipError);

  const ids = (memberships ?? []).map((row) => row.space_id);
  if (ids.length === 0) return [];
  const themeRevisions = new Map(ids.map((id) => [id, beginThemeRead(id)]));

  const [{ data: spaces, error: spacesError }, { data: memberRows, error: memberError }] = await Promise.all([
    client.from('spaces').select('id,name,kind,theme_key,created_at').in('id', ids).order('updated_at', { ascending: false }),
    client.from('space_members').select('space_id').in('space_id', ids)
  ]);
  raise(spacesError);
  raise(memberError);
  for (const row of spaces ?? []) rememberSpaceTheme(row.id, row.theme_key as ThemeKey | null, themeRevisions.get(row.id));

  const counts = new Map<string, number>();
  for (const row of memberRows ?? []) counts.set(row.space_id, (counts.get(row.space_id) ?? 0) + 1);
  return (spaces ?? []).map((row) => mapSpace(row as SpaceRow, counts.get(row.id) ?? 1));
}

export async function getSpace(spaceId: string): Promise<Space> {
  const revision = beginThemeRead(spaceId);
  const client = requireSupabase();
  const [{ data: row, error }, { count, error: countError }] = await Promise.all([
    client.from('spaces').select('id,name,kind,theme_key,created_at').eq('id', spaceId).single(),
    client.from('space_members').select('user_id', { count: 'exact', head: true }).eq('space_id', spaceId)
  ]);
  raise(error);
  raise(countError);
  rememberSpaceTheme(spaceId, (row as SpaceRow).theme_key, revision);
  return mapSpace(row as SpaceRow, count ?? 1);
}

function mapSpace(row: SpaceRow, memberCount: number): Space {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    themeKey: row.theme_key,
    createdAt: row.created_at,
    memberCount
  };
}

export async function createSpace(name: string, kind: SpaceKind) {
  const { data, error } = await requireSupabase().rpc('create_space', { p_name: name.trim(), p_kind: kind });
  raise(error);
  return data;
}

export async function setSpaceTheme(spaceId: string, themeKey: ThemeKey) {
  return saveSpaceTheme(requireSupabase(), spaceId, themeKey);
}

export async function createInvite(spaceId: string) {
  const { data, error } = await requireSupabase().rpc('create_space_invite', { p_space_id: spaceId });
  raise(error);
  const invite = data?.[0];
  if (!invite) throw new Error('The invite could not be created. Please try again.');
  const publicUrl = process.env.EXPO_PUBLIC_APP_URL?.trim().replace(/\/$/, '');
  const webBase = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : null;
  const base = webBase ?? publicUrl;
  const url = base ? `${base}/invite/${invite.invite_token}` : Linking.createURL(`/invite/${invite.invite_token}`);
  return { url, expiresAt: invite.expires_at };
}

export async function acceptInvite(token: string) {
  const { data, error } = await requireSupabase().rpc('accept_space_invite', { p_token: token });
  raise(error);
  return data;
}

export async function getSpaceMembers(spaceId: string): Promise<SpaceMember[]> {
  const client = requireSupabase();
  const { data: rows, error } = await client.from('space_members').select('user_id,joined_at').eq('space_id', spaceId);
  raise(error);
  const userIds = (rows ?? []).map((row) => row.user_id);
  if (!userIds.length) return [];
  const { data: profiles, error: profileError } = await client.from('profiles').select('id,display_name').in('id', userIds);
  raise(profileError);
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));
  return (rows ?? []).map((row) => ({
    userId: row.user_id,
    displayName: names.get(row.user_id) ?? 'Friend',
    joinedAt: row.joined_at
  }));
}

export async function leaveSpace(spaceId: string) {
  const { error } = await requireSupabase().rpc('leave_space', { p_space_id: spaceId });
  raise(error);
}

export async function deleteSpace(spaceId: string) {
  const client = requireSupabase();
  const { data: memories, error: memoriesError } = await client
    .from('memories').select('image_path').eq('space_id', spaceId);
  raise(memoriesError);

  const paths = (memories ?? []).map((memory) => memory.image_path);
  if (paths.length) {
    const { error: storageError } = await client.storage.from('memory-images').remove(paths);
    raise(storageError);
  }

  const { error } = await client.rpc('delete_space', { p_space_id: spaceId });
  raise(error);
}
