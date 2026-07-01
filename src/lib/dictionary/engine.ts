/**
 * NUR Lingo — Unified Dictionary Engine
 *
 * Three-tier dictionary system:
 * - VERIFIED: 1152 words, read-only, human-verified MP3 audio (IDs 000001-001152)
 * - EXTENDED: Additional words with TTS audio (IDs 002001-004000, future expansion)
 * - USER: Custom user-added words with optional recordings (IDs 900001+)
 *
 * NEVER modify verified data. User dictionary syncs with Supabase.
 */

import { supabase } from "../supabase/client";
import type { LangCode } from "../i18n/multilingual";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type DictionaryTier = "verified" | "extended" | "user";
export type WordType = "vocab" | "phrase" | "sentence" | "user";

export interface DictionaryEntry {
  id: string;                    // 6-digit canonical ID (e.g., "000001")
  hy: string;                    // Armenian
  en: string;                    // English
  ru: string;                    // Russian
  type: WordType;
  tier: DictionaryTier;
  audioVerified: boolean;        // Has human-recorded MP3?
  audioHy?: string;              // Path to Armenian audio
  audioEn?: string;              // Path to English audio
  audioRu?: string;              // Path to Russian audio
  userRecording?: string;        // User's own recording (blob URL or base64)
  isUserAdded?: boolean;         // True for user-added words
  createdAt?: string;
  updatedAt?: string;
}

export interface WordProgress {
  wordId: string;
  status: "unknown" | "learning" | "known" | "mastered" | "forgotten";
  strength: number;              // 0-100
  lastReviewed: string | null;
  nextReview: string | null;
  correctCount: number;
  incorrectCount: number;
}

export interface SearchResult {
  entry: DictionaryEntry;
  matchLang: LangCode;
  matchType: "exact" | "prefix" | "contains";
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const VERIFIED_RANGE = { min: 1, max: 1152 };
const EXTENDED_RANGE = { min: 2001, max: 4000 };
const USER_RANGE = { min: 900001, max: 999999 };

const LOCAL_STORAGE_KEY = "nur_user_dictionary";
const PROGRESS_STORAGE_KEY = "nur_word_progress";

// ─── Verified Dictionary (Static Import) ───────────────────────────────────────

import verifiedData from "../../../data/dictionaries/unified-dictionary.json";
import audioManifest from "../../../public/audio/manifest.json";

type AudioManifest = Record<string, { hy: string; en: string; ru: string }>;

const VERIFIED_DICT: DictionaryEntry[] = verifiedData.map((item: any) => {
  const id = item.id.padStart(6, "0");
  const audioPaths = (audioManifest as AudioManifest)[id] || {};
  return {
    id,
    hy: item.hy,
    en: item.en,
    ru: item.ru,
    type: item.type || "vocab",
    tier: "verified",
    audioVerified: !!(audioPaths.hy && audioPaths.en && audioPaths.ru),
    audioHy: audioPaths.hy,
    audioEn: audioPaths.en,
    audioRu: audioPaths.ru,
  };
});

// ─── Dictionary Engine Class ───────────────────────────────────────────────────

class DictionaryEngine {
  private userDict: DictionaryEntry[] = [];
  private extendedDict: DictionaryEntry[] = [];
  private progress: Map<string, WordProgress> = new Map();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Load user dictionary from localStorage (immediate)
    this.loadUserDictFromLocalStorage();

    // Load word progress from localStorage (immediate)
    this.loadProgressFromLocalStorage();

    // Async: sync with Supabase if authenticated
    this.syncWithSupabase().catch(console.warn);

    this.initialized = true;
  }

  // ─── Dictionary Access ───────────────────────────────────────────────────────

  /** Get all verified words (read-only) */
  getVerified(): DictionaryEntry[] {
    return VERIFIED_DICT;
  }

  /** Get extended dictionary words */
  getExtended(): DictionaryEntry[] {
    return this.extendedDict;
  }

  /** Get user-added words */
  getUserWords(): DictionaryEntry[] {
    return this.userDict.filter(w => w.isUserAdded);
  }

  /** Get full dictionary (verified + extended + user) */
  getAll(): DictionaryEntry[] {
    return [...VERIFIED_DICT, ...this.extendedDict, ...this.userDict];
  }

  /** Get entry by canonical ID */
  getById(id: string): DictionaryEntry | null {
    const paddedId = id.padStart(6, "0");

    // Check verified first
    const verified = VERIFIED_DICT.find(e => e.id === paddedId);
    if (verified) return verified;

    // Check extended
    const extended = this.extendedDict.find(e => e.id === paddedId);
    if (extended) return extended;

    // Check user
    const user = this.userDict.find(e => e.id === paddedId);
    return user || null;
  }

  /** Get entry by word (searches all languages) */
  getByWord(word: string): DictionaryEntry | null {
    const normalized = word.toLowerCase().trim();
    return this.getAll().find(e =>
      e.hy.toLowerCase() === normalized ||
      e.en.toLowerCase() === normalized ||
      e.ru.toLowerCase() === normalized
    ) || null;
  }

  /** Check if a word exists in any dictionary */
  exists(word: string): boolean {
    return !!this.getByWord(word);
  }

  /** Check if a word exists in verified dictionary */
  isVerified(word: string): boolean {
    const normalized = word.toLowerCase().trim();
    return VERIFIED_DICT.some(e =>
      e.hy.toLowerCase() === normalized ||
      e.en.toLowerCase() === normalized ||
      e.ru.toLowerCase() === normalized
    );
  }

  // ─── Search ───────────────────────────────────────────────────────────────────

  /** Search across all dictionaries */
  search(query: string, limit = 50): SearchResult[] {
    const normalized = query.toLowerCase().trim();
    const results: SearchResult[] = [];

    for (const entry of this.getAll()) {
      const hyMatch = entry.hy.toLowerCase();
      const enMatch = entry.en.toLowerCase();
      const ruMatch = entry.ru.toLowerCase();

      let matchLang: LangCode | null = null;
      let matchType: "exact" | "prefix" | "contains" = "contains";

      // Check for exact match
      if (hyMatch === normalized) { matchLang = "hy"; matchType = "exact"; }
      else if (enMatch === normalized) { matchLang = "en"; matchType = "exact"; }
      else if (ruMatch === normalized) { matchLang = "ru"; matchType = "exact"; }
      // Check for prefix match
      else if (hyMatch.startsWith(normalized)) { matchLang = "hy"; matchType = "prefix"; }
      else if (enMatch.startsWith(normalized)) { matchLang = "en"; matchType = "prefix"; }
      else if (ruMatch.startsWith(normalized)) { matchLang = "ru"; matchType = "prefix"; }
      // Check for contains match
      else if (hyMatch.includes(normalized)) { matchLang = "hy"; matchType = "contains"; }
      else if (enMatch.includes(normalized)) { matchLang = "en"; matchType = "contains"; }
      else if (ruMatch.includes(normalized)) { matchLang = "ru"; matchType = "contains"; }

      if (matchLang) {
        results.push({ entry, matchLang, matchType });
        if (results.length >= limit) break;
      }
    }

    // Sort: exact > prefix > contains, then by tier priority
    const tierPriority = { verified: 0, extended: 1, user: 2 };
    results.sort((a, b) => {
      if (a.matchType !== b.matchType) {
        const order = { exact: 0, prefix: 1, contains: 2 };
        return order[a.matchType] - order[b.matchType];
      }
      return tierPriority[a.entry.tier] - tierPriority[b.entry.tier];
    });

    return results;
  }

  // ─── User Dictionary Management ──────────────────────────────────────────────

  /** Add a new word to user dictionary */
  async addUserWord(
    hy: string,
    en: string,
    ru: string,
    type: WordType = "vocab",
    recording?: string
  ): Promise<DictionaryEntry | null> {
    // Check if already exists in verified
    if (this.isVerified(hy) || this.isVerified(en) || this.isVerified(ru)) {
      console.warn(`Word already exists in verified dictionary`);
      return null;
    }

    // Check if already in user dictionary
    const existing = this.userDict.find(e =>
      e.hy === hy || e.en === en || e.ru === ru
    );
    if (existing) {
      console.warn(`Word already exists in user dictionary`);
      return null;
    }

    // Generate new ID
    const maxId = this.userDict.reduce((max, e) => {
      const num = parseInt(e.id);
      return num > max ? num : max;
    }, USER_RANGE.min - 1);
    const newId = String(Math.min(maxId + 1, USER_RANGE.max)).padStart(6, "0");

    const entry: DictionaryEntry = {
      id: newId,
      hy,
      en,
      ru,
      type,
      tier: "user",
      audioVerified: false,
      userRecording: recording,
      isUserAdded: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.userDict.push(entry);
    this.saveUserDictToLocalStorage();

    // Sync with Supabase
    await this.syncUserWordToSupabase(entry);

    return entry;
  }

  /** Update an existing user word */
  async updateUserWord(
    id: string,
    updates: Partial<Pick<DictionaryEntry, "hy" | "en" | "ru" | "type" | "userRecording">>
  ): Promise<boolean> {
    const idx = this.userDict.findIndex(e => e.id === id.padStart(6, "0"));
    if (idx === -1) return false;

    const entry = this.userDict[idx];
    if (!entry.isUserAdded) return false;

    // Check for conflicts with verified
    if (updates.hy && this.isVerified(updates.hy)) return false;
    if (updates.en && this.isVerified(updates.en)) return false;
    if (updates.ru && this.isVerified(updates.ru)) return false;

    this.userDict[idx] = {
      ...entry,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.saveUserDictToLocalStorage();
    await this.syncUserWordToSupabase(this.userDict[idx]);

    return true;
  }

  /** Delete a user word */
  async deleteUserWord(id: string): Promise<boolean> {
    const idx = this.userDict.findIndex(e => e.id === id.padStart(6, "0"));
    if (idx === -1) return false;

    const entry = this.userDict[idx];
    if (!entry.isUserAdded) return false;

    this.userDict.splice(idx, 1);
    this.saveUserDictToLocalStorage();

    // Delete from Supabase
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: userRecord } = await supabase
        .from("users")
        .select("id")
        .eq("auth_id", user.id)
        .single();

      if (userRecord) {
        await supabase
          .from("user_dictionary")
          .delete()
          .eq("user_id", userRecord.id)
          .eq("word_id", id.padStart(6, "0"));
      }
    }

    return true;
  }

  // ─── Word Progress Tracking ──────────────────────────────────────────────────

  /** Get progress for a word */
  getProgress(wordId: string): WordProgress | null {
    return this.progress.get(wordId.padStart(6, "0")) || null;
  }

  /** Update progress for a word */
  updateProgress(wordId: string, correct: boolean): WordProgress {
    const paddedId = wordId.padStart(6, "0");
    let progress = this.progress.get(paddedId);

    if (!progress) {
      progress = {
        wordId: paddedId,
        status: "unknown",
        strength: 0,
        lastReviewed: null,
        nextReview: null,
        correctCount: 0,
        incorrectCount: 0,
      };
    }

    if (correct) {
      progress.correctCount++;
      progress.strength = Math.min(100, progress.strength + 15);
    } else {
      progress.incorrectCount++;
      progress.strength = Math.max(0, progress.strength - 20);
    }

    progress.lastReviewed = new Date().toISOString();
    progress.nextReview = this.calculateNextReview(progress);

    // Update status based on strength
    if (progress.strength >= 80) progress.status = "mastered";
    else if (progress.strength >= 50) progress.status = "known";
    else if (progress.strength >= 20) progress.status = "learning";
    else progress.status = "unknown";

    this.progress.set(paddedId, progress);
    this.saveProgressToLocalStorage();

    // Async sync
    this.syncProgressToSupabase(progress).catch(console.warn);

    return progress;
  }

  /** Get words due for review */
  getDueForReview(limit = 20): DictionaryEntry[] {
    const now = new Date();
    const due: DictionaryEntry[] = [];

    for (const entry of this.getAll()) {
      const progress = this.progress.get(entry.id);
      if (!progress || !progress.nextReview) continue;

      if (new Date(progress.nextReview) <= now) {
        due.push(entry);
        if (due.length >= limit) break;
      }
    }

    return due;
  }

  // ─── Private Methods ──────────────────────────────────────────────────────────

  private calculateNextReview(progress: WordProgress): string {
    // SRS intervals based on strength
    const intervals = [
      0,           // unknown: immediate
      1,           // learning: 1 hour
      24,          // approaching: 1 day
      24 * 3,      // known: 3 days
      24 * 7,      // well-known: 1 week
      24 * 14,     // mastered: 2 weeks
      24 * 30,     // long-term: 1 month
    ];

    const strengthIdx = Math.min(Math.floor(progress.strength / 20), intervals.length - 1);
    const hours = intervals[strengthIdx];
    const next = new Date(Date.now() + hours * 60 * 60 * 1000);

    return next.toISOString();
  }

  private loadUserDictFromLocalStorage(): void {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        this.userDict = JSON.parse(stored);
      }
    } catch {
      this.userDict = [];
    }
  }

  private saveUserDictToLocalStorage(): void {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.userDict));
    } catch (e) {
      console.warn("Failed to save user dictionary:", e);
    }
  }

  private loadProgressFromLocalStorage(): void {
    try {
      const stored = localStorage.getItem(PROGRESS_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.progress = new Map(Object.entries(data));
      }
    } catch {
      this.progress = new Map();
    }
  }

  private saveProgressToLocalStorage(): void {
    try {
      const obj = Object.fromEntries(this.progress);
      localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(obj));
    } catch (e) {
      console.warn("Failed to save progress:", e);
    }
  }

  private async syncWithSupabase(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get the user record from our users table
    const { data: userRecord } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .single();

    const userId = userRecord?.id;
    if (!userId) return;

    // Load user dictionary from Supabase
    const { data: userWords } = await supabase
      .from("user_dictionary")
      .select("*")
      .eq("user_id", userId);

    if (userWords && userWords.length > 0) {
      // Merge with local (Supabase wins for conflicts)
      const supabaseIds = new Set(userWords.map(w => w.word_id));
      this.userDict = this.userDict.filter(w => !supabaseIds.has(w.id));

      for (const w of userWords) {
        this.userDict.push({
          id: w.word_id,
          hy: w.word_hy,
          en: w.word_en,
          ru: w.word_ru,
          type: w.word_type || "vocab",
          tier: "user",
          audioVerified: false,
          userRecording: w.recording_url,
          isUserAdded: true,
          createdAt: w.created_at,
          updatedAt: w.updated_at,
        });
      }
      this.saveUserDictToLocalStorage();
    }

    // Load progress from Supabase
    const { data: progressData } = await supabase
      .from("word_progress")
      .select("*")
      .eq("user_id", userId);

    if (progressData && progressData.length > 0) {
      for (const p of progressData) {
        this.progress.set(p.word_id, {
          wordId: p.word_id,
          status: p.status,
          strength: p.strength,
          lastReviewed: p.last_reviewed,
          nextReview: p.next_review,
          correctCount: p.correct_count,
          incorrectCount: p.incorrect_count,
        });
      }
      this.saveProgressToLocalStorage();
    }
  }

  private async syncUserWordToSupabase(entry: DictionaryEntry): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get the user record from our users table
    const { data: userRecord } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .single();

    if (!userRecord) return;

    await supabase.from("user_dictionary").upsert({
      user_id: userRecord.id,
      word_id: entry.id,
      word_hy: entry.hy,
      word_en: entry.en,
      word_ru: entry.ru,
      word_type: entry.type,
      recording_url: entry.userRecording,
      updated_at: entry.updatedAt,
    });
  }

  private async syncProgressToSupabase(progress: WordProgress): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get the user record from our users table
    const { data: userRecord } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .single();

    if (!userRecord) return;

    await supabase.from("word_progress").upsert({
      user_id: userRecord.id,
      word_id: progress.wordId,
      status: progress.status,
      strength: progress.strength,
      last_reviewed: progress.lastReviewed,
      next_review: progress.nextReview,
      correct_count: progress.correctCount,
      incorrect_count: progress.incorrectCount,
    });
  }
}

// ─── Singleton Export ───────────────────────────────────────────────────────────

export const dictionaryEngine = new DictionaryEngine();

// Initialize on import (client-side only)
if (typeof window !== "undefined") {
  dictionaryEngine.initialize();
}

// ─── Convenience Exports (Backward Compatible) ───────────────────────────────────

export const baseDictionary = VERIFIED_DICT;
export const getUserAddedWords = () => dictionaryEngine.getUserWords();
export const addToUserDictionary = (hy: string, en: string, ru: string, type?: WordType) =>
  dictionaryEngine.addUserWord(hy, en, ru, type);
export const removeFromUserDictionary = (id: string) => dictionaryEngine.deleteUserWord(id);
export const getFullDictionary = () => dictionaryEngine.getAll();

export default dictionaryEngine;
