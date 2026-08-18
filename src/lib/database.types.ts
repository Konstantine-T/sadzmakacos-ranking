/**
 * Hand-maintained mirror of the Postgres schema.
 *
 * Once you have the Supabase CLI linked, regenerate this instead of editing it:
 *   supabase gen types typescript --linked > src/lib/database.types.ts
 *
 * Until then: if you change a migration, change this file in the same commit.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type BadgeKey =
  | 'weekly_king'
  | 'crown_streak_3'
  | 'top_climber'
  | 'top_faller'
  | 'most_hated'
  | 'polarizing'
  | 'ghost'
  | 'all_time_leader';

export interface Database {
  public: {
    Tables: {
      members: {
        Row: {
          id: string;
          nickname: string;
          bio: string | null;
          avatar_url: string | null;
          is_active: boolean;
          is_admin: boolean;
          auth_user_id: string | null;
          created_at: string;
        };
        Insert: never;
        Update: { nickname?: string; bio?: string | null; avatar_url?: string | null };
        Relationships: [];
      };
      pending_accounts: {
        Row: {
          auth_user_id: string;
          email: string;
          google_name: string | null;
          google_avatar: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      weeks: {
        Row: {
          id: number;
          starts_at: string;
          ends_at: string;
          status: 'open' | 'closed';
          closed_at: string | null;
          is_paused: boolean;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      votes: {
        Row: {
          id: string;
          week_id: number;
          voter_id: string;
          target_id: string;
          value: -1 | 1;
          created_at: string;
          updated_at: string;
        };
        Insert: { week_id: number; voter_id: string; target_id: string; value: -1 | 1 };
        Update: { value?: -1 | 1 };
        Relationships: [];
      };
      vote_events: {
        Row: { id: number; week_id: number; target_id: string; created_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      score_events: {
        Row: {
          id: number;
          kind: 'post_vote' | 'post_reaction' | 'member_reaction';
          week_id: number | null;
          target_id: string;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      posts: {
        Row: {
          id: string;
          week_id: number;
          author_id: string;
          body: string;
          created_at: string;
        };
        Insert: { week_id: number; author_id: string; body: string };
        Update: never;
        Relationships: [];
      };
      post_votes: {
        Row: { post_id: string; voter_id: string; value: -1 | 1; updated_at: string };
        Insert: { post_id: string; voter_id: string; value: -1 | 1 };
        Update: { value?: -1 | 1 };
        Relationships: [];
      };
      member_reactions: {
        Row: {
          week_id: number;
          member_id: string;
          reactor_id: string;
          emoji: string;
          created_at: string;
        };
        Insert: { week_id: number; member_id: string; reactor_id: string; emoji: string };
        Update: never;
        Relationships: [];
      };
      post_reactions: {
        Row: { post_id: string; reactor_id: string; emoji: string; created_at: string };
        Insert: { post_id: string; reactor_id: string; emoji: string };
        Update: never;
        Relationships: [];
      };
      weekly_results: {
        Row: {
          week_id: number;
          member_id: string;
          up: number;
          down: number;
          net: number;
          total_votes: number;
          rank: number;
          prev_rank: number | null;
          movement: number | null;
          edited: boolean;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      member_badges: {
        Row: {
          id: string;
          member_id: string;
          badge_key: BadgeKey;
          week_id: number | null;
          awarded_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      announcements: {
        Row: { id: string; body: string; is_active: boolean; created_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      polls: {
        Row: {
          id: string;
          question: string;
          is_multi: boolean;
          is_active: boolean;
          created_at: string;
          closed_at: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      poll_options: {
        Row: { id: string; poll_id: string; label: string; position: number };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      /** Signed on purpose — see 20260818000100_polls.sql. */
      poll_answers: {
        Row: { poll_id: string; option_id: string; member_id: string; created_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: number;
          actor_id: string | null;
          action: string;
          detail: Json | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };

    Views: {
      live_standings: {
        Row: {
          week_id: number;
          member_id: string;
          nickname: string;
          avatar_url: string | null;
          up: number;
          down: number;
          net: number;
          total_votes: number;
        };
        Relationships: [];
      };
      week_standings: {
        Row: {
          week_id: number;
          member_id: string;
          nickname: string;
          avatar_url: string | null;
          up: number;
          down: number;
          net: number;
          total_votes: number;
          rank: number;
          prev_rank: number | null;
          movement: number | null;
          edited: boolean;
        };
        Relationships: [];
      };
      week_turnout: {
        Row: { week_id: number; voters: number; total_members: number };
        Relationships: [];
      };
      post_scores: {
        Row: { post_id: string; week_id: number; up: number; down: number; net: number };
        Relationships: [];
      };
      member_reaction_counts: {
        Row: { week_id: number; member_id: string; emoji: string; count: number };
        Relationships: [];
      };
      post_reaction_counts: {
        Row: { post_id: string; week_id: number; emoji: string; count: number };
        Relationships: [];
      };
      all_time_standings: {
        Row: {
          member_id: string;
          nickname: string;
          avatar_url: string | null;
          is_active: boolean;
          total_net: number;
          total_up: number;
          total_down: number;
          weeks_played: number;
          avg_net: number;
          weeks_at_one: number;
        };
        Relationships: [];
      };
    };

    Functions: {
      me: {
        Args: Record<string, never>;
        Returns: {
          member_id: string | null;
          nickname: string | null;
          bio: string | null;
          avatar_url: string | null;
          is_admin: boolean;
          is_active: boolean;
          pending: boolean;
        }[];
      };
      cast_vote: { Args: { p_target_id: string; p_value: number | null }; Returns: undefined };
      vote_post: { Args: { p_post_id: string; p_value: number | null }; Returns: undefined };
      toggle_member_reaction: { Args: { p_member_id: string; p_emoji: string }; Returns: boolean };
      toggle_post_reaction: { Args: { p_post_id: string; p_emoji: string }; Returns: boolean };
      create_post: { Args: { p_body: string }; Returns: string };

      admin_link_account: {
        Args: { p_auth_user_id: string; p_member_id: string };
        Returns: undefined;
      };
      admin_reject_account: { Args: { p_auth_user_id: string }; Returns: undefined };
      admin_create_member: {
        Args: { p_nickname: string; p_bio?: string | null; p_avatar_url?: string | null };
        Returns: string;
      };
      admin_update_member: {
        Args: {
          p_member_id: string;
          p_nickname?: string | null;
          p_bio?: string | null;
          p_avatar_url?: string | null;
          p_is_active?: boolean | null;
        };
        Returns: undefined;
      };
      admin_unlink_member: { Args: { p_member_id: string }; Returns: undefined };
      admin_delete_post: { Args: { p_post_id: string }; Returns: undefined };
      admin_set_week: {
        Args: { p_week_id: number; p_ends_at?: string | null; p_is_paused?: boolean | null };
        Returns: undefined;
      };
      admin_close_week: { Args: Record<string, never>; Returns: number };
      admin_update_result: {
        Args: { p_week_id: number; p_member_id: string; p_up: number; p_down: number };
        Returns: undefined;
      };
      admin_create_announcement: { Args: { p_body: string }; Returns: string };
      admin_set_announcement: { Args: { p_id: string; p_is_active: boolean }; Returns: undefined };

      answer_poll: { Args: { p_poll_id: string; p_option_ids: string[] }; Returns: undefined };
      admin_create_poll: {
        Args: { p_question: string; p_options: string[]; p_is_multi?: boolean };
        Returns: string;
      };
      admin_set_poll: {
        Args: { p_poll_id: string; p_is_active?: boolean | null; p_closed?: boolean | null };
        Returns: undefined;
      };
      admin_delete_poll: { Args: { p_poll_id: string }; Returns: undefined };
      admin_list_polls: { Args: Record<string, never>; Returns: Json };
      admin_dashboard: { Args: Record<string, never>; Returns: Json };
    };

    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

// -------- convenience aliases used across the app --------
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type Views<T extends keyof Database['public']['Views']> =
  Database['public']['Views'][T]['Row'];

export type Member = Tables<'members'>;
export type Week = Tables<'weeks'>;
export type Post = Tables<'posts'>;
export type MemberBadge = Tables<'member_badges'>;
export type Announcement = Tables<'announcements'>;
export type Poll = Tables<'polls'>;
export type PollOption = Tables<'poll_options'>;
export type PollAnswer = Tables<'poll_answers'>;
export type AuditEntry = Tables<'audit_log'>;
export type WeeklyResult = Tables<'weekly_results'>;
export type PendingAccount = Tables<'pending_accounts'>;

export type LiveStanding = Views<'live_standings'>;
export type WeekStanding = Views<'week_standings'>;
export type PostScore = Views<'post_scores'>;
export type AllTimeStanding = Views<'all_time_standings'>;
export type ReactionCount = Views<'post_reaction_counts'>;
