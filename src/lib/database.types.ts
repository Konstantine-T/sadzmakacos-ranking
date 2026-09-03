/**
 * Hand-maintained mirror of the Postgres schema.
 *
 * Once you have the Supabase CLI linked, regenerate this instead of editing it:
 *   supabase gen types typescript --linked > src/lib/database.types.ts
 *
 * Until then: if you change a migration, change this file in the same commit.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

/** The four notification streams. Each carries its own read cursor. */
export type NotificationKind = 'post' | 'rank' | 'reaction' | 'post_vote';

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
      /**
       * Read-only to clients: every row is written by a trigger or by
       * cast_vote, and there is no INSERT grant. `actor_id` is non-null only
       * for `kind: 'post'` — a CHECK constraint enforces it, because posts are
       * signed and reactions and votes are not (rule 1).
       */
      notifications: {
        Row: {
          id: number;
          kind: NotificationKind;
          recipient_id: string | null;
          actor_id: string | null;
          week_id: number | null;
          post_id: string | null;
          emoji: string | null;
          rank_from: number | null;
          rank_to: number | null;
          tally: number;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      /** One read cursor per kind. Written only by mark_notifications_read(). */
      notification_reads: {
        Row: { member_id: string; kind: NotificationKind; read_at: string };
        Insert: never;
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
      /**
       * `correct_index` is deliberately absent from `Row`: migration
       * 20260830000100_trivia.sql grants select on exactly the other six
       * columns, so a client-side `select('*')` fails outright rather than
       * ever returning the answer key.
       */
      trivia_questions: {
        Row: {
          id: string;
          week_id: number | null;
          position: number | null;
          section: string;
          prompt: string;
          /** 2–6 answer strings, per the check constraint, original order. NEVER shuffled: correct_index points into it. */
          options: string[];
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      /** select-own; no `or public.is_admin()` escape hatch, unlike votes_select_own. */
      trivia_answers: {
        Row: {
          question_id: string;
          member_id: string;
          week_id: number;
          choice_index: number;
          is_correct: boolean;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      /** Frozen on week close by a trigger (rule 3) — never written by a client. */
      trivia_results: {
        Row: {
          week_id: number;
          member_id: string;
          correct: number;
          answered: number;
          rank: number;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      /** Identity-free realtime ping, exactly like vote_events / score_events. */
      messages: {
        Row: {
          id: number;
          author_id: string;
          body: string;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      message_reactions: {
        Row: {
          message_id: number;
          reactor_id: string;
          emoji: string;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      chat_reads: {
        Row: { member_id: string; last_read_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      chat_events: {
        Row: { id: number; kind: 'reaction'; created_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      snake_scores: {
        Row: {
          member_id: string;
          best_score: number;
          plays: number;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      trivia_events: {
        Row: { id: number; week_id: number; created_at: string };
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
      message_reaction_counts: {
        Row: { message_id: number; emoji: string; count: number };
        Relationships: [];
      };

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
      /** Owned by postgres, security_invoker = off — see trivia_questions above. */
      trivia_week_scores: {
        Row: {
          week_id: number;
          member_id: string;
          nickname: string;
          avatar_url: string | null;
          correct: number;
          answered: number;
        };
        Relationships: [];
      };
      trivia_totals: {
        Row: {
          member_id: string;
          nickname: string;
          avatar_url: string | null;
          total_correct: number;
          total_answered: number;
          tests_taken: number;
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
      unread_counts: {
        Args: Record<string, never>;
        Returns: { kind: NotificationKind; unread: number }[];
      };
      /** Omit p_kind to mark every stream read; pass one to mark just that one. */
      mark_notifications_read: {
        Args: { p_kind?: NotificationKind | null };
        Returns: undefined;
      };

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
      /** Grades server-side; the key comes back only after the write commits. */
      send_message: {
        Args: { p_body: string };
        Returns: number;
      };
      toggle_message_reaction: {
        Args: { p_message_id: number; p_emoji: string };
        Returns: undefined;
      };
      mark_chat_read: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      chat_unread: {
        Args: Record<string, never>;
        Returns: number;
      };
      admin_delete_message: {
        Args: { p_message_id: number };
        Returns: undefined;
      };
      submit_snake_score: {
        Args: { p_score: number };
        Returns: number;
      };
      answer_trivia: {
        Args: { p_question_id: string; p_choice_index: number };
        Returns: { correct_index: number; is_correct: boolean }[];
      };
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
export type Notification = Tables<'notifications'>;
export type NotificationRead = Tables<'notification_reads'>;

export type LiveStanding = Views<'live_standings'>;
export type WeekStanding = Views<'week_standings'>;
export type PostScore = Views<'post_scores'>;
export type AllTimeStanding = Views<'all_time_standings'>;
export type ReactionCount = Views<'post_reaction_counts'>;

export type TriviaQuestion = Tables<'trivia_questions'>;
export type TriviaAnswer = Tables<'trivia_answers'>;
export type TriviaResult = Tables<'trivia_results'>;
export type SnakeScore = Tables<'snake_scores'>;
export type ChatMessage = Tables<'messages'>;
export type MessageReactionCount = Views<'message_reaction_counts'>;
export type TriviaEvent = Tables<'trivia_events'>;
export type TriviaWeekScore = Views<'trivia_week_scores'>;
export type TriviaTotal = Views<'trivia_totals'>;

/** What answer_trivia() hands back once your choice is committed. */
export interface TriviaGrade {
  correct_index: number;
  is_correct: boolean;
}
