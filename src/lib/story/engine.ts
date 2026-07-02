/**
 * NUR Lingo — Story Engine
 * Reusable architecture for interactive story-based learning content.
 *
 * Stories are narrative-driven lessons where users learn vocabulary
 * and phrases in context through interactive storytelling.
 */

import type { LangCode } from "../i18n/multilingual";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface StoryCharacter {
  id: string;
  name: Record<LangCode, string>;
  avatar: string;
  voiceId?: string;
  color: string;
  bgColor: string;
}

export interface StoryChoice {
  id: string;
  text: Record<LangCode, string>;
  isCorrect: boolean;
  feedback?: Record<LangCode, string>;
  nextNodeId?: string;
}

export interface StoryNode {
  id: string;
  type: "narration" | "dialogue" | "choice" | "vocabulary" | "checkpoint";
  characterId?: string;
  text: Record<LangCode, string>;
  translation?: Record<LangCode, string>;
  vocabularySpotlight?: string[];  // Word IDs to highlight
  audio?: {
    hy?: string;
    en?: string;
    ru?: string;
  };
  choices?: StoryChoice[];
  nextNodeId?: string;
  delayMs?: number;
}

export interface Story {
  id: string;
  worldId: string;
  lessonId: string;
  title: Record<LangCode, string>;
  description: Record<LangCode, string>;
  thumbnail: string;
  difficulty: "A1" | "A2" | "B1" | "B2";
  estimatedMinutes: number;
  characters: StoryCharacter[];
  nodes: StoryNode[];
  startNodeId: string;
  vocabularyCovered: string[];
  rewards: {
    hayq: number;
    seeds?: number;
    xp: number;
  };
}

export interface StoryProgress {
  storyId: string;
  currentNodeId: string;
  completedNodeIds: string[];
  choices: Record<string, string>;
  startedAt: string;
  lastPlayedAt: string;
  isComplete: boolean;
  score: number;
  correctChoices: number;
  totalChoices: number;
}

export interface StorySession {
  story: Story;
  progress: StoryProgress;
  currentNode: StoryNode;
  history: StoryNode[];
}

// ─── Story Registry ─────────────────────────────────────────────────────────────

const storyRegistry = new Map<string, Story>();

export function registerStory(story: Story): void {
  storyRegistry.set(story.id, story);
}

export function getStory(id: string): Story | undefined {
  return storyRegistry.get(id);
}

export function getAllStories(): Story[] {
  return Array.from(storyRegistry.values());
}

export function getStoriesByWorld(worldId: string): Story[] {
  return getAllStories().filter((s) => s.worldId === worldId);
}

export function getStoriesByLesson(lessonId: string): Story[] {
  return getAllStories().filter((s) => s.lessonId === lessonId);
}

// ─── Story Engine Class ───────────────────────────────────────────────────────────

class StoryEngine {
  private sessions = new Map<string, StorySession>();
  private progressStorage = new Map<string, StoryProgress>();

  /**
   * Start a new story session
   */
  startSession(storyId: string): StorySession | null {
    const story = getStory(storyId);
    if (!story) return null;

    // Check for existing progress
    const existingProgress = this.loadProgress(storyId);
    const progress = existingProgress || this.createProgress(story);

    const startNodeId = progress.isComplete ? story.startNodeId : progress.currentNodeId;
    const currentNode = story.nodes.find((n) => n.id === startNodeId);

    if (!currentNode) {
      console.error(`Start node not found: ${startNodeId}`);
      return null;
    }

    const session: StorySession = {
      story,
      progress,
      currentNode,
      history: [],
    };

    this.sessions.set(storyId, session);
    return session;
  }

  /**
   * Get current session
   */
  getSession(storyId: string): StorySession | undefined {
    return this.sessions.get(storyId);
  }

  /**
   * Advance to the next node
   */
  advanceNode(storyId: string, nodeId?: string): StoryNode | null {
    const session = this.sessions.get(storyId);
    if (!session) return null;

    const targetNodeId = nodeId || session.currentNode.nextNodeId;
    if (!targetNodeId) return null;

    const nextNode = session.story.nodes.find((n) => n.id === targetNodeId);
    if (!nextNode) {
      // Story complete
      session.progress.isComplete = true;
      this.saveProgress(session.progress);
      return null;
    }

    // Update session
    session.history.push(session.currentNode);
    session.currentNode = nextNode;
    session.progress.currentNodeId = nextNode.id;
    session.progress.completedNodeIds.push(session.currentNode.id);
    session.progress.lastPlayedAt = new Date().toISOString();

    this.saveProgress(session.progress);
    return nextNode;
  }

  /**
   * Make a choice at a choice node
   */
  makeChoice(storyId: string, choiceId: string): {
    correct: boolean;
    feedback?: Record<LangCode, string>;
    nextNode: StoryNode | null;
  } {
    const session = this.sessions.get(storyId);
    if (!session) return { correct: false, nextNode: null };

    const choice = session.currentNode.choices?.find((c) => c.id === choiceId);
    if (!choice) return { correct: false, nextNode: null };

    // Update progress
    session.progress.choices[session.currentNode.id] = choiceId;
    session.progress.totalChoices++;

    if (choice.isCorrect) {
      session.progress.correctChoices++;
    }

    // Calculate score update
    session.progress.score = Math.round(
      (session.progress.correctChoices / session.progress.totalChoices) * 100
    );

    this.saveProgress(session.progress);

    // Advance to next node
    const nextNodeId = choice.nextNodeId || session.currentNode.nextNodeId;
    const nextNode = this.advanceNode(storyId, nextNodeId);

    return {
      correct: choice.isCorrect,
      feedback: choice.feedback,
      nextNode,
    };
  }

  /**
   * Get character by ID
   */
  getCharacter(storyId: string, characterId: string): StoryCharacter | undefined {
    const story = getStory(storyId);
    if (!story) return undefined;
    return story.characters.find((c) => c.id === characterId);
  }

  /**
   * Get vocabulary covered in a story
   */
  getStoryVocabulary(storyId: string): string[] {
    const story = getStory(storyId);
    return story?.vocabularyCovered || [];
  }

  /**
   * Get story progress
   */
  getProgress(storyId: string): StoryProgress | undefined {
    return this.progressStorage.get(storyId);
  }

  /**
   * Check if story is complete
   */
  isComplete(storyId: string): boolean {
    const progress = this.progressStorage.get(storyId);
    return progress?.isComplete || false;
  }

  // ─── Private Methods ──────────────────────────────────────────────────────────

  private createProgress(story: Story): StoryProgress {
    return {
      storyId: story.id,
      currentNodeId: story.startNodeId,
      completedNodeIds: [],
      choices: {},
      startedAt: new Date().toISOString(),
      lastPlayedAt: new Date().toISOString(),
      isComplete: false,
      score: 0,
      correctChoices: 0,
      totalChoices: 0,
    };
  }

  private loadProgress(storyId: string): StoryProgress | null {
    // Try localStorage first
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(`story_progress_${storyId}`);
      if (stored) {
        try {
          const progress = JSON.parse(stored);
          this.progressStorage.set(storyId, progress);
          return progress;
        } catch {
          return null;
        }
      }
    }
    return this.progressStorage.get(storyId) || null;
  }

  private saveProgress(progress: StoryProgress): void {
    this.progressStorage.set(progress.storyId, progress);

    // Persist to localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem(`story_progress_${progress.storyId}`, JSON.stringify(progress));
    }

    // TODO: Sync with Supabase when authenticated
  }
}

// ─── Singleton Export ───────────────────────────────────────────────────────────

export const storyEngine = new StoryEngine();

// ─── Story Template Builder ─────────────────────────────────────────────────────

/**
 * Helper to build stories with type safety
 */
export function createStory(config: {
  id: string;
  worldId: string;
  lessonId: string;
  title: Record<LangCode, string>;
  description: Record<LangCode, string>;
  thumbnail?: string;
  difficulty?: "A1" | "A2" | "B1" | "B2";
  estimatedMinutes?: number;
  characters: StoryCharacter[];
  nodes: StoryNode[];
  startNodeId: string;
  vocabularyCovered?: string[];
  rewards?: {
    hayq?: number;
    seeds?: number;
    xp?: number;
  };
}): Story {
  const story: Story = {
    id: config.id,
    worldId: config.worldId,
    lessonId: config.lessonId,
    title: config.title,
    description: config.description,
    thumbnail: config.thumbnail || "/images/stories/default.png",
    difficulty: config.difficulty || "A1",
    estimatedMinutes: config.estimatedMinutes || 5,
    characters: config.characters,
    nodes: config.nodes,
    startNodeId: config.startNodeId,
    vocabularyCovered: config.vocabularyCovered || [],
    rewards: {
      hayq: config.rewards?.hayq || 10,
      seeds: config.rewards?.seeds,
      xp: config.rewards?.xp || 25,
    },
  };

  registerStory(story);
  return story;
}

export default storyEngine;
