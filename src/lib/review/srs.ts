/**
 * NUR Lingo — Smart Review System
 * Spaced Repetition System (SRS) for vocabulary review
 *
 * Intervals: 1h, 1d, 3d, 7d, 14d, 30d, 60d
 * Status: unknown → learning → known → mastered → forgotten
 */

import { dictionaryEngine, type DictionaryEntry, type WordProgress } from "../dictionary/engine";

// ─── SRS Configuration ────────────────────────────────────────────────────────

export interface SRSConfig {
  intervals: number[];           // Hours until next review per level
  strengthStep: number;          // Strength increase on correct
  strengthPenalty: number;       // Strength decrease on incorrect
  masterThreshold: number;       // Strength to become "mastered"
  knownThreshold: number;        // Strength to become "known"
  learningThreshold: number;     // Strength to become "learning"
}

const DEFAULT_SRS_CONFIG: SRSConfig = {
  intervals: [0, 1, 24, 72, 168, 336, 720, 1440], // hours: immediate, 1h, 1d, 3d, 7d, 14d, 30d, 60d
  strengthStep: 15,
  strengthPenalty: 20,
  masterThreshold: 80,
  knownThreshold: 50,
  learningThreshold: 20,
};

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReviewResult = "correct" | "incorrect" | "partial";

export interface ReviewSession {
  id: string;
  startedAt: string;
  words: DictionaryEntry[];
  currentIndex: number;
  correctCount: number;
  incorrectCount: number;
  isComplete: boolean;
}

export interface ReviewStats {
  totalWords: number;
  unknown: number;
  learning: number;
  known: number;
  mastered: number;
  forgotten: number;
  dueToday: number;
  dueNow: number;
}

// ─── SRS Engine ───────────────────────────────────────────────────────────────

class SRSEngine {
  private config: SRSConfig;

  constructor(config: SRSConfig = DEFAULT_SRS_CONFIG) {
    this.config = config;
  }

  /**
   * Get words due for review right now
   */
  getDueWords(limit = 20): DictionaryEntry[] {
    return dictionaryEngine.getDueForReview(limit);
  }

  /**
   * Get all words with their progress for stats
   */
  getReviewStats(): ReviewStats {
    const allWords = dictionaryEngine.getAll();
    const stats: ReviewStats = {
      totalWords: allWords.length,
      unknown: 0,
      learning: 0,
      known: 0,
      mastered: 0,
      forgotten: 0,
      dueToday: 0,
      dueNow: 0,
    };

    const now = new Date();
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    for (const word of allWords) {
      const progress = dictionaryEngine.getProgress(word.id);

      if (!progress) {
        stats.unknown++;
        stats.dueNow++;
        stats.dueToday++;
        continue;
      }

      switch (progress.status) {
        case "unknown":
          stats.unknown++;
          break;
        case "learning":
          stats.learning++;
          break;
        case "known":
          stats.known++;
          break;
        case "mastered":
          stats.mastered++;
          break;
        case "forgotten":
          stats.forgotten++;
          break;
      }

      if (progress.nextReview) {
        const nextReview = new Date(progress.nextReview);
        if (nextReview <= now) {
          stats.dueNow++;
          stats.dueToday++;
        } else if (nextReview <= todayEnd) {
          stats.dueToday++;
        }
      }
    }

    return stats;
  }

  /**
   * Calculate interval hours based on strength
   */
  getIntervalHours(strength: number): number {
    const level = Math.min(
      Math.floor(strength / (100 / (this.config.intervals.length - 1))),
      this.config.intervals.length - 1
    );
    return this.config.intervals[level];
  }

  /**
   * Process a review result
   */
  processReview(wordId: string, result: ReviewResult): WordProgress {
    const isCorrect = result === "correct";
    const progress = dictionaryEngine.updateProgress(wordId, isCorrect);

    // Adjust for partial correctness
    if (result === "partial") {
      const adjustedProgress = dictionaryEngine.getProgress(wordId);
      if (adjustedProgress) {
        adjustedProgress.strength = Math.max(0, adjustedProgress.strength - (this.config.strengthPenalty / 2));
        adjustedProgress.correctCount = Math.max(0, adjustedProgress.correctCount - 1);
      }
    }

    // If failed and was mastered/known, mark as forgotten
    if (!isCorrect && (progress.status === "mastered" || progress.status === "known")) {
      const forgottenProgress = dictionaryEngine.getProgress(wordId);
      if (forgottenProgress) {
        forgottenProgress.status = "forgotten";
      }
    }

    return progress;
  }

  /**
   * Create a new review session
   */
  createSession(limit = 20): ReviewSession {
    const dueWords = this.getDueWords(limit);

    return {
      id: `session_${Date.now()}`,
      startedAt: new Date().toISOString(),
      words: dueWords,
      currentIndex: 0,
      correctCount: 0,
      incorrectCount: 0,
      isComplete: false,
    };
  }

  /**
   * Advance session to next word
   */
  advanceSession(session: ReviewSession, result: ReviewResult): ReviewSession {
    const updated = { ...session };

    if (result === "correct") {
      updated.correctCount++;
    } else if (result === "incorrect") {
      updated.incorrectCount++;
    }

    updated.currentIndex++;

    if (updated.currentIndex >= updated.words.length) {
      updated.isComplete = true;
    }

    return updated;
  }

  /**
   * Get progress percentage for session
   */
  getSessionProgress(session: ReviewSession): number {
    if (session.words.length === 0) return 100;
    return Math.round((session.currentIndex / session.words.length) * 100);
  }

  /**
   * Get success rate for session
   */
  getSessionSuccessRate(session: ReviewSession): number {
    const total = session.correctCount + session.incorrectCount;
    if (total === 0) return 0;
    return Math.round((session.correctCount / total) * 100);
  }
}

// ─── Singleton Export ──────────────────────────────────────────────────────────

export const srsEngine = new SRSEngine();

export default srsEngine;
