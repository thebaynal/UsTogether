export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Table<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        { id: string; display_name: string; created_at: string },
        { id: string; display_name: string; created_at?: string },
        { display_name?: string }
      >;
      spaces: Table<
        {
          id: string;
          name: string;
          kind: 'couple' | 'group' | 'team';
          theme_key: 'rose' | 'lavender' | 'peach' | 'mint' | 'sky' | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          name: string;
          kind: 'couple' | 'group' | 'team';
          theme_key?: 'rose' | 'lavender' | 'peach' | 'mint' | 'sky' | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        },
        { name?: string; kind?: 'couple' | 'group' | 'team'; theme_key?: 'rose' | 'lavender' | 'peach' | 'mint' | 'sky' | null }
      >;
      space_members: Table<
        { space_id: string; user_id: string; joined_at: string },
        { space_id: string; user_id: string; joined_at?: string }
      >;
      memories: Table<
        {
          id: string;
          space_id: string;
          created_by: string | null;
          title: string;
          memory_date: string;
          caption: string | null;
          milestone_tag: string | null;
          image_path: string;
          image_mime_type: 'image/jpeg' | 'image/png' | 'image/webp';
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        },
        {
          id?: string;
          space_id: string;
          created_by?: string | null;
          title: string;
          memory_date: string;
          caption?: string | null;
          milestone_tag?: string | null;
          image_path: string;
          image_mime_type: 'image/jpeg' | 'image/png' | 'image/webp';
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        },
        {
          title?: string;
          memory_date?: string;
          caption?: string | null;
          milestone_tag?: string | null;
          updated_at?: string;
        }
      >;
      comments: Table<
        { id: string; memory_id: string; user_id: string; body: string; created_at: string; updated_at: string },
        { id?: string; memory_id: string; user_id: string; body: string; created_at?: string; updated_at?: string },
        { body?: string; updated_at?: string }
      >;
      reactions: Table<
        { id: string; memory_id: string; user_id: string; emoji: string; created_at: string; updated_at: string },
        { id?: string; memory_id: string; user_id: string; emoji: string; created_at?: string; updated_at?: string },
        { emoji?: string; updated_at?: string }
      >;
      space_invites: Table<
        { id: string; space_id: string; created_by: string; token_hash: string; expires_at: string; redeemed_at: string | null; created_at: string },
        { id?: string; space_id: string; created_by: string; token_hash: string; expires_at: string; redeemed_at?: string | null; created_at?: string }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      create_space: { Args: { p_name: string; p_kind: 'couple' | 'group' | 'team' }; Returns: string };
      create_space_invite: { Args: { p_space_id: string }; Returns: { invite_token: string; expires_at: string }[] };
      accept_space_invite: { Args: { p_token: string }; Returns: string };
      leave_space: { Args: { p_space_id: string }; Returns: undefined };
      delete_space: { Args: { p_space_id: string }; Returns: undefined };
      is_space_member: { Args: { target_space_id: string }; Returns: boolean };
      can_view_profile: { Args: { target_user_id: string }; Returns: boolean };
      can_access_memory: { Args: { target_memory_id: string }; Returns: boolean };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
