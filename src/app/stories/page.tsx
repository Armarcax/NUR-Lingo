"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import BottomNav from "@/components/BottomNav";
import Nuri from "@/components/Nuri";
import { getAllStories, getStory, storyEngine, type Story, type StoryNode, type StorySession } from "@/lib/story";
import { ThemeToggle } from "@/lib/theme";
import { loadLangConfig, type LangCode } from "@/lib/i18n/index";

type ViewPhase = "list" | "playing";

export default function StoriesPage() {
  const [stories, setStories] = useState<Story[]>([]);
  const [nativeLang, setNativeLang] = useState<LangCode>("en");
  const [phase, setPhase] = useState<ViewPhase>("list");
  const [currentSession, setCurrentSession] = useState<StorySession | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const cfg = loadLangConfig();
    setNativeLang(cfg?.native || "en");
    setStories(getAllStories());
  }, []);

  const startStory = (storyId: string) => {
    const session = storyEngine.startSession(storyId);
    if (session) {
      setCurrentSession(session);
      setPhase("playing");
    }
  };

  const handleAdvance = () => {
    if (!currentSession) return;

    const nextNode = storyEngine.advanceNode(currentSession.story.id);
    if (nextNode) {
      setCurrentSession({
        ...currentSession,
        currentNode: nextNode,
        history: [...currentSession.history, currentSession.currentNode],
      });
    } else {
      // Story complete
      setPhase("list");
      setCurrentSession(null);
    }
    setShowTranslation(false);
  };

  const handleChoice = (choiceId: string) => {
    if (!currentSession) return;

    const result = storyEngine.makeChoice(currentSession.story.id, choiceId);
    setCurrentSession((prev) =>
      prev
        ? {
            ...prev,
            progress: storyEngine.getProgress(prev.story.id) || prev.progress,
            currentNode: result.nextNode || prev.currentNode,
          }
        : null
    );
    setShowTranslation(false);
  };

  const exitStory = () => {
    setPhase("list");
    setCurrentSession(null);
    setShowTranslation(false);
  };

  if (phase === "list") {
    return (
      <div className="min-h-screen pb-24">
        <header className="sticky top-0 z-40 backdrop-blur-xl bg-[var(--glass-bg)] border-b border-[var(--color-border)]">
          <div className="px-4 py-3 flex items-center justify-between">
            <div>
              <h1 className="font-black text-xl">📖 Stories</h1>
              <p className="text-xs text-[var(--color-text-muted)]">Learn through narrative</p>
            </div>
            <ThemeToggle />
          </div>
        </header>

        <main className="max-w-md mx-auto px-4 py-6">
          {stories.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-card glass-card-lg text-center py-12"
            >
              <span className="text-4xl mb-4 block">📚</span>
              <p className="text-[var(--color-text-muted)]">No stories available yet</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-2">Stories coming soon!</p>
            </motion.div>
          ) : (
            <div className="space-y-4">
              {stories.map((story, idx) => (
                <motion.div
                  key={story.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="glass-card glass-card-interactive overflow-hidden"
                >
                  <button
                    onClick={() => startStory(story.id)}
                    className="w-full text-left"
                  >
                    <div className="relative h-32 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-t-xl overflow-hidden">
                      <div className="absolute inset-0 flex items-center justify-center text-6xl">
                        🗣️
                      </div>
                      <div className="absolute bottom-2 left-2 flex gap-2">
                        <span className="badge bg-primary/80 text-white">{story.difficulty}</span>
                        <span className="badge bg-secondary/80 text-black">{story.estimatedMinutes} min</span>
                      </div>
                    </div>

                    <div className="p-4">
                      <h3 className="font-bold text-lg">{story.title[nativeLang] || story.title.en}</h3>
                      <p className="text-sm text-[var(--color-text-secondary)] mt-1">
                        {story.description[nativeLang] || story.description.en}
                      </p>

                      <div className="flex items-center justify-between mt-3 text-xs text-[var(--color-text-muted)]">
                        <span>📖 {story.vocabularyCovered.length} words</span>
                        <span className="text-secondary font-bold">+{story.rewards.hayq} HAYQ</span>
                      </div>
                    </div>
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </main>

        <BottomNav />
      </div>
    );
  }

  // Playing phase
  const session = currentSession;
  if (!session) return null;

  const currentNode = session.currentNode;
  const story = session.story;
  const character = currentNode.characterId
    ? story.characters.find((c) => c.id === currentNode.characterId)
    : null;

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[var(--glass-bg)] border-b border-[var(--color-border)]">
        <div className="px-4 py-3 flex items-center justify-between">
          <button onClick={exitStory} className="text-[var(--color-text-muted)]">
            ← Back
          </button>
          <h2 className="font-bold text-sm truncate">{story.title[nativeLang]}</h2>
          <span className="text-sm font-bold text-secondary">
            {session.progress.score}%
          </span>
        </div>
        {/* Progress bar */}
        <div className="progress-bar h-1 rounded-none">
          <div
            className="progress-bar-fill bg-primary"
            style={{
              width: `${(session.progress.completedNodeIds.length / story.nodes.length) * 100}%`,
            }}
          />
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentNode.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="min-h-[60vh]"
          >
            {/* Narration */}
            {currentNode.type === "narration" && (
              <div className="glass-card glass-card-lg">
                <p className="text-lg leading-relaxed">{currentNode.text[nativeLang]}</p>
                <div className="mt-6 text-center">
                  <button onClick={handleAdvance} className="btn-primary">
                    Continue →
                  </button>
                </div>
              </div>
            )}

            {/* Dialogue */}
            {currentNode.type === "dialogue" && character && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full ${character.bgColor} flex items-center justify-center text-2xl`}>
                    {character.avatar}
                  </div>
                  <span className={`font-bold ${character.color}`}>{character.name[nativeLang]}</span>
                </div>

                <div className="glass-card glass-card-lg">
                  <p className="text-xl font-armenian">{currentNode.text.hy}</p>

                  {showTranslation && currentNode.translation && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mt-4 pt-4 border-t border-[var(--color-border)]"
                    >
                      <p className="text-[var(--color-text-secondary)]">{currentNode.text.en}</p>
                      <p className="text-sm text-[var(--color-text-muted)] mt-1">{currentNode.text.ru}</p>
                    </motion.div>
                  )}

                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => setShowTranslation(!showTranslation)}
                      className="btn-ghost text-sm"
                    >
                      {showTranslation ? "Hide" : "Show"} Translation
                    </button>
                  </div>

                  <button onClick={handleAdvance} className="btn-primary w-full mt-4">
                    Continue →
                  </button>
                </div>
              </div>
            )}

            {/* Choice */}
            {currentNode.type === "choice" && currentNode.choices && (
              <div className="space-y-4">
                <p className="text-lg font-medium">{currentNode.text[nativeLang]}</p>

                <div className="space-y-3">
                  {currentNode.choices.map((choice) => (
                    <motion.button
                      key={choice.id}
                      onClick={() => handleChoice(choice.id)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="glass-card glass-card-interactive w-full p-4 text-left"
                    >
                      <p className="text-lg font-armenian">{choice.text.hy}</p>
                      <p className="text-sm text-[var(--color-text-secondary)] mt-1">{choice.text[nativeLang]}</p>
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {/* Vocabulary */}
            {currentNode.type === "vocabulary" && (
              <div className="glass-card glass-card-lg">
                <h3 className="font-bold mb-4">{currentNode.text[nativeLang]}</h3>
                <div className="text-center py-8 text-[var(--color-text-muted)]">
                  📖 Vocabulary review placeholder
                </div>
                <button onClick={handleAdvance} className="btn-primary w-full mt-4">
                  Continue →
                </button>
              </div>
            )}

            {/* Checkpoint */}
            {currentNode.type === "checkpoint" && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="glass-card glass-card-lg text-center py-8"
              >
                <Nuri mood="excited" size={120} />
                <h3 className="font-bold text-2xl mt-6 text-success">
                  {currentNode.text[nativeLang]}
                </h3>

                <div className="mt-6 flex justify-center gap-4">
                  <div className="text-center">
                    <p className="text-3xl font-black text-secondary">+{story.rewards.hayq}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">HAYQ</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-black text-accent">+{story.rewards.xp}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">XP</p>
                  </div>
                </div>

                <button onClick={exitStory} className="btn-primary mt-6">
                  Return to Stories
                </button>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Skip button */}
      <div className="fixed bottom-24 right-4">
        <button
          onClick={exitStory}
          className="btn-ghost px-4 py-2 bg-[var(--glass-bg)]"
        >
          ✕ Exit
        </button>
      </div>

      <BottomNav />
    </div>
  );
}
