"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import BottomNav from "@/components/BottomNav";
import Nuri from "@/components/Nuri";
import { srsEngine, type ReviewResult, type ReviewSession, type ReviewStats } from "@/lib/review/srs";
import { dictionaryEngine, type DictionaryEntry } from "@/lib/dictionary/engine";
import { ThemeToggle } from "@/lib/theme";
import { useRouter } from "next/navigation";

type ReviewPhase = "stats" | "review" | "complete";

export default function ReviewPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<ReviewPhase>("stats");
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [session, setSession] = useState<ReviewSession | null>(null);
  const [currentWord, setCurrentWord] = useState<DictionaryEntry | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [userAnswer, setUserAnswer] = useState("");

  useEffect(() => {
    dictionaryEngine.initialize().then(() => {
      setStats(srsEngine.getReviewStats());
    });
  }, []);

  const startReview = useCallback(() => {
    const newSession = srsEngine.createSession(20);
    if (newSession.words.length === 0) {
      return;
    }
    setSession(newSession);
    setCurrentWord(newSession.words[0]);
    setPhase("review");
  }, []);

  const handleReveal = useCallback(() => {
    setShowAnswer(true);
  }, []);

  const handleGrade = useCallback((result: ReviewResult) => {
    if (!session || !currentWord) return;

    srsEngine.processReview(currentWord.id, result);
    const updatedSession = srsEngine.advanceSession(session, result);
    setSession(updatedSession);

    if (updatedSession.isComplete) {
      setPhase("complete");
    } else {
      const nextWord = updatedSession.words[updatedSession.currentIndex];
      setCurrentWord(nextWord);
      setShowAnswer(false);
      setUserAnswer("");
    }
  }, [session, currentWord]);

  if (phase === "stats" && stats) {
    return (
      <div className="min-h-screen pb-24">
        <header className="sticky top-0 z-40 backdrop-blur-xl bg-[var(--glass-bg)] border-b border-[var(--color-border)]">
          <div className="px-4 py-3 flex items-center justify-between">
            <div>
              <h1 className="font-black text-xl">Smart Review</h1>
              <p className="text-xs text-[var(--color-text-muted)]">Spaced repetition</p>
            </div>
            <ThemeToggle />
          </div>
        </header>

        <main className="max-w-md mx-auto px-4 py-8">
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-4 mb-8 text-center"
          >
            <Nuri mood="happy" size={120} />
            <div>
              <h2 className="font-bold text-2xl">Time to Review!</h2>
              <p className="text-sm text-[var(--color-text-secondary)]">
                {stats.dueNow} words need your attention
              </p>
            </div>
          </motion.div>

          {/* Stats Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card glass-card-md mb-6"
          >
            <h3 className="font-bold mb-4">Word Status</h3>
            <div className="space-y-3">
              {[
                { label: "Unknown", count: stats.unknown, color: "text-[var(--color-text-muted)]" },
                { label: "Learning", count: stats.learning, color: "text-warning" },
                { label: "Known", count: stats.known, color: "text-accent" },
                { label: "Mastered", count: stats.mastered, color: "text-success" },
                { label: "Forgotten", count: stats.forgotten, color: "text-error" },
              ].map(({ label, count, color }) => (
                <div key={label} className="flex justify-between items-center">
                  <span className="text-sm">{label}</span>
                  <span className={`font-bold ${color}`}>{count}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Due Today */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card glass-card-md mb-6"
          >
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-[var(--color-text-secondary)]">Due Today</p>
                <p className="text-3xl font-black text-primary">{stats.dueToday}</p>
              </div>
              <div>
                <p className="text-sm text-[var(--color-text-secondary)]">Due Now</p>
                <p className="text-3xl font-black text-secondary">{stats.dueNow}</p>
              </div>
            </div>
          </motion.div>

          {/* Start Button */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            onClick={startReview}
            disabled={stats.dueNow === 0}
            className="btn-primary w-full py-4 text-lg disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {stats.dueNow === 0 ? "All caught up!" : `Start Review (${stats.dueNow} words)`}
          </motion.button>

          {stats.dueNow === 0 && (
            <p className="text-center text-sm text-[var(--color-text-muted)] mt-4">
              Come back later for more reviews!
            </p>
          )}
        </main>

        <BottomNav />
      </div>
    );
  }

  if (phase === "review" && currentWord && session) {
    const progress = srsEngine.getSessionProgress(session);

    return (
      <div className="min-h-screen pb-24">
        <header className="sticky top-0 z-40 backdrop-blur-xl bg-[var(--glass-bg)] border-b border-[var(--color-border)]">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-[var(--color-text-muted)]">
                {session.currentIndex + 1} / {session.words.length}
              </span>
              <span className="text-sm font-bold text-success">{session.correctCount}</span>
              <span className="text-sm font-bold text-error">{session.incorrectCount}</span>
            </div>
            <div className="progress-bar h-2">
              <div
                className="progress-bar-fill bg-primary"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </header>

        <main className="max-w-md mx-auto px-4 py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentWord.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="glass-card glass-card-lg"
            >
              {/* Word to review */}
              <div className="text-center mb-6">
                <p className="text-sm text-[var(--color-text-muted)] uppercase mb-2">
                  Translate to English
                </p>
                <h2 className="text-4xl font-black font-armenian text-primary">
                  {currentWord.hy}
                </h2>
              </div>

              {/* Input / Answer */}
              {!showAnswer ? (
                <div className="space-y-4">
                  <input
                    type="text"
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    placeholder="Type your answer..."
                    className="input-field w-full text-center text-lg"
                    autoFocus
                  />
                  <button
                    onClick={handleReveal}
                    className="btn-secondary w-full"
                  >
                    Show Answer
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Correct answer */}
                  <div className="glass-card glass-card-sm bg-success/10 border-success/20 text-center">
                    <p className="text-sm text-[var(--color-text-muted)] mb-1">Correct Answer</p>
                    <p className="text-xl font-bold text-success">{currentWord.en}</p>
                    <p className="text-sm text-[var(--color-text-secondary)] mt-1">{currentWord.ru}</p>
                  </div>

                  {/* User's answer */}
                  {userAnswer && (
                    <div className={`glass-card glass-card-sm text-center ${
                      userAnswer.toLowerCase().trim() === currentWord.en.toLowerCase().trim()
                        ? "bg-success/10 border-success/20"
                        : "bg-error/10 border-error/20"
                    }`}>
                      <p className="text-sm text-[var(--color-text-muted)] mb-1">Your Answer</p>
                      <p className={`font-bold ${
                        userAnswer.toLowerCase().trim() === currentWord.en.toLowerCase().trim()
                          ? "text-success"
                          : "text-error"
                      }`}>{userAnswer}</p>
                    </div>
                  )}

                  {/* Grade buttons */}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleGrade("incorrect")}
                      className="btn-secondary py-4 bg-error/20 hover:bg-error/30 border-error/30"
                    >
                      Again
                    </button>
                    <button
                      onClick={() => handleGrade("partial")}
                      className="btn-secondary py-4 bg-warning/20 hover:bg-warning/30 border-warning/30"
                    >
                      Hard
                    </button>
                    <button
                      onClick={() => handleGrade("correct")}
                      className="btn-primary py-4"
                    >
                      Easy
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        <BottomNav />
      </div>
    );
  }

  if (phase === "complete" && session) {
    const successRate = srsEngine.getSessionSuccessRate(session);

    return (
      <div className="min-h-screen pb-24">
        <header className="sticky top-0 z-40 backdrop-blur-xl bg-[var(--glass-bg)] border-b border-[var(--color-border)]">
          <div className="px-4 py-3 flex items-center justify-between">
            <div>
              <h1 className="font-black text-xl">Session Complete!</h1>
              <p className="text-xs text-[var(--color-text-muted)]">Great work!</p>
            </div>
            <ThemeToggle />
          </div>
        </header>

        <main className="max-w-md mx-auto px-4 py-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-6 text-center"
          >
            <Nuri mood={successRate >= 70 ? "happy" : "thinking"} size={120} />

            {/* Results */}
            <div className="glass-card glass-card-lg w-full">
              <h2 className="font-bold text-lg mb-4">Results</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-3xl font-black text-success">{session.correctCount}</p>
                  <p className="text-sm text-[var(--color-text-muted)]">Correct</p>
                </div>
                <div>
                  <p className="text-3xl font-black text-error">{session.incorrectCount}</p>
                  <p className="text-sm text-[var(--color-text-muted)]">Incorrect</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
                <div className="progress-bar h-3 mb-2">
                  <div
                    className={`progress-bar-fill ${successRate >= 70 ? "bg-success" : "bg-warning"}`}
                    style={{ width: `${successRate}%` }}
                  />
                </div>
                <p className="text-sm font-bold">{successRate}% Accuracy</p>
              </div>
            </div>

            {/* Actions */}
            <div className="w-full space-y-3">
              <button
                onClick={() => {
                  setPhase("stats");
                  setStats(srsEngine.getReviewStats());
                }}
                className="btn-secondary w-full"
              >
                Back to Stats
              </button>
              <button
                onClick={() => router.push("/")}
                className="btn-ghost w-full"
              >
                Return Home
              </button>
            </div>
          </motion.div>
        </main>

        <BottomNav />
      </div>
    );
  }

  return null;
}
