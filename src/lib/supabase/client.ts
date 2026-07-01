import { createClient } from "@supabase/supabase-js";

// Database type for TypeScript generics
export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          auth_id: string | null;  // UUID from Supabase Auth
          username: string | null;
          email: string | null;
          display_name: string | null;
          cefr_level: string;
          xp_total: number;
          hayq_total: number;
          seeds_total: number;
          streak_days: number;
          streak_last_date: string | null;
          preferences: Record<string, unknown>;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      user_lesson_progress: {
        Row: {
          id: string;
          user_id: string;
          lesson_id: string;
          status: "not_started" | "in_progress" | "completed";
          score: number;
          hayq_earned: number;
          seeds_earned: number;
          attempts: number;
          completed_at: string | null;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      exercise_attempts: {
        Row: {
          id: string;
          user_id: string;
          exercise_id: string | null;
          user_answer: string;
          expected_answer: string;
          is_accepted: boolean;
          score: number | null;
          hayq_awarded: number;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
      };
      user_dictionary: {
        Row: {
          id: string;
          user_id: string;
          word_id: string;
          word_hy: string;
          word_en: string;
          word_ru: string;
          word_type: string;
          recording_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          word_id: string;
          word_hy: string;
          word_en: string;
          word_ru: string;
          word_type?: string;
          recording_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          word_id?: string;
          word_hy?: string;
          word_en?: string;
          word_ru?: string;
          word_type?: string;
          recording_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      word_progress: {
        Row: {
          id: string;
          user_id: string;
          word_id: string;
          status: "unknown" | "learning" | "known" | "mastered" | "forgotten";
          strength: number;
          last_reviewed: string | null;
          next_review: string | null;
          correct_count: number;
          incorrect_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          word_id: string;
          status?: "unknown" | "learning" | "known" | "mastered" | "forgotten";
          strength?: number;
          last_reviewed?: string | null;
          next_review?: string | null;
          correct_count?: number;
          incorrect_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          word_id?: string;
          status?: "unknown" | "learning" | "known" | "mastered" | "forgotten";
          strength?: number;
          last_reviewed?: string | null;
          next_review?: string | null;
          correct_count?: number;
          incorrect_count?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
};

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function getSupabaseBrowser() {
  return supabase;
}
