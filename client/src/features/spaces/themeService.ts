import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { ThemeKey } from '@/types/domain';
import { rememberSpaceTheme } from './themeCache';

export async function saveSpaceTheme(client: Pick<SupabaseClient<Database>, 'from'>, spaceId: string, themeKey: ThemeKey) {
  const { data, error } = await client.from('spaces').update({ theme_key: themeKey }).eq('id', spaceId)
    .select('id,name,kind,theme_key,created_at').single();
  if (error) throw new Error(error.message);
  if (!data || data.theme_key !== themeKey) throw new Error('Your theme was not saved. Check your membership and try again.');
  rememberSpaceTheme(spaceId, themeKey);
  return data;
}
