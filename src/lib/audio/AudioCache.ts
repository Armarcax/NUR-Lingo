// src/lib/audio/AudioCache.ts
// NUR Lingo Audio Engine — Intelligent Audio Caching with IndexedDB Persistence

import { AudioCacheStats } from "./AudioTypes";

const DB_NAME = "nur_audio_cache";
const DB_VERSION = 1;
const STORE_NAME = "audio_blobs";
const CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CachedBlob {
  url: string;
  blob: Blob;
  timestamp: number;
}

interface CacheEntry {
  audio: HTMLAudioElement;
  url: string;
  size: number;
  lastAccessed: number;
  hits: number;
}

// ─── IndexedDB Helper ───────────────────────────────────────────────────────────

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB not available"));
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "url" });
      }
    };
  });

  return dbPromise;
}

async function getFromIndexedDB(url: string): Promise<Blob | null> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(url);

      request.onsuccess = () => {
        const result = request.result as CachedBlob | undefined;
        if (result && Date.now() - result.timestamp <= CACHE_DURATION_MS) {
          resolve(result.blob);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

async function storeInIndexedDB(url: string, blob: Blob): Promise<void> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({ url, blob, timestamp: Date.now() });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch {
    // Fail silently
  }
}

/**
 * LRU Cache for audio elements with size limits and statistics
 */
export class AudioCache {
  private cache = new Map<string, CacheEntry>();
  private loading = new Map<string, Promise<HTMLAudioElement>>();
  private headChecks = new Map<string, Promise<boolean>>();
  private headCheckCache = new Map<string, boolean>();

  private hits = 0;
  private misses = 0;
  private maxSizeBytes: number;
  private maxEntries: number;

  constructor(options?: { maxSizeMB?: number; maxEntries?: number }) {
    this.maxSizeBytes = (options?.maxSizeMB ?? 50) * 1024 * 1024;
    this.maxEntries = options?.maxEntries ?? 500;
  }

  /**
   * Get audio from cache if available
   */
  get(key: string): HTMLAudioElement | undefined {
    const entry = this.cache.get(key);
    if (entry) {
      entry.lastAccessed = Date.now();
      entry.hits++;
      this.hits++;
      return entry.audio;
    }
    this.misses++;
    return undefined;
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Set audio in cache
   */
  set(key: string, audio: HTMLAudioElement, size?: number): void {
    // Estimate size if not provided
    const estimatedSize = size ?? 50 * 1024; // 50KB default estimate

    // Evict if necessary
    this.evictIfNeeded(estimatedSize);

    this.cache.set(key, {
      audio,
      url: key,
      size: estimatedSize,
      lastAccessed: Date.now(),
      hits: 0,
    });
  }

  /**
   * Get or load audio with deduplication and IndexedDB persistence
   */
  async getOrLoad(url: string, signal?: AbortSignal): Promise<HTMLAudioElement> {
    // Check memory cache first
    const cached = this.get(url);
    if (cached) {
      return cached;
    }

    // Deduplicate concurrent loads
    if (this.loading.has(url)) {
      return this.loading.get(url)!;
    }

    // Start loading
    const promise = this.loadAudioWithPersistence(url, signal);
    this.loading.set(url, promise);

    try {
      const audio = await promise;
      this.set(url, audio);
      return audio;
    } finally {
      this.loading.delete(url);
    }
  }

  /**
   * Load audio element with IndexedDB persistence
   */
  private async loadAudioWithPersistence(url: string, signal?: AbortSignal): Promise<HTMLAudioElement> {
    // Try IndexedDB first
    const cachedBlob = await getFromIndexedDB(url);
    if (cachedBlob) {
      const blobUrl = URL.createObjectURL(cachedBlob);
      const audio = new Audio(blobUrl);
      audio.preload = "auto";
      return audio;
    }

    // Fetch from network
    const response = await fetch(url, { signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${url}`);
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    // Store in IndexedDB for offline use
    storeInIndexedDB(url, blob).catch(() => {});

    const audio = new Audio(blobUrl);
    audio.preload = "auto";
    return audio;
  }

  /**
   * Load audio element (legacy method for direct URLs)
   */
  private async loadAudio(url: string, signal?: AbortSignal): Promise<HTMLAudioElement> {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      audio.preload = "auto";
      audio.src = url;

      const cleanup = () => {
        audio.oncanplaythrough = null;
        audio.onerror = null;
      };

      audio.oncanplaythrough = () => {
        cleanup();
        resolve(audio);
      };

      audio.onerror = () => {
        cleanup();
        reject(new Error(`Failed to load audio: ${url}`));
      };

      if (signal) {
        signal.addEventListener("abort", () => {
          cleanup();
          audio.src = "";
          reject(new Error("Aborted"));
        });
      }

      audio.load();
    });
  }

  /**
   * Check if an MP3 file exists via HEAD request (cached)
   */
  async checkExists(url: string): Promise<boolean> {
    // Check HEAD cache
    if (this.headCheckCache.has(url)) {
      return this.headCheckCache.get(url)!;
    }

    // Deduplicate concurrent HEAD requests
    if (this.headChecks.has(url)) {
      return this.headChecks.get(url)!;
    }

    const promise = (async (): Promise<boolean> => {
      try {
        const response = await fetch(url, { method: "HEAD" });
        const exists = response.ok;
        this.headCheckCache.set(url, exists);
        return exists;
      } catch {
        this.headCheckCache.set(url, false);
        return false;
      } finally {
        this.headChecks.delete(url);
      }
    })();

    this.headChecks.set(url, promise);
    return promise;
  }

  /**
   * Prefetch multiple URLs
   */
  async prefetch(urls: string[]): Promise<void> {
    const promises = urls.slice(0, 5).map((url) =>
      this.getOrLoad(url).catch(() => {
        // Silently fail prefetch
      })
    );
    await Promise.allSettled(promises);
  }

  /**
   * Evict entries if needed to make room
   */
  private evictIfNeeded(neededSize: number): void {
    // Check entry limit
    while (this.cache.size >= this.maxEntries) {
      this.evictLRU();
    }

    // Check size limit
    while (this.totalSize + neededSize > this.maxSizeBytes && this.cache.size > 0) {
      this.evictLRU();
    }
  }

  /**
   * Evict the least recently used entry
   */
  private evictLRU(): void {
    let oldest: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldest = key;
      }
    }

    if (oldest) {
      const entry = this.cache.get(oldest);
      if (entry) {
        // Revoke object URL if applicable
        if (entry.audio.src.startsWith("blob:")) {
          URL.revokeObjectURL(entry.audio.src);
        }
        entry.audio.src = "";
      }
      this.cache.delete(oldest);
    }
  }

  /**
   * Get total cached size
   */
  get totalSize(): number {
    let total = 0;
    for (const entry of this.cache.values()) {
      total += entry.size;
    }
    return total;
  }

  /**
   * Get cache statistics
   */
  getStats(): AudioCacheStats {
    const totalRequests = this.hits + this.misses;
    return {
      entries: this.cache.size,
      totalSize: this.totalSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: totalRequests > 0 ? this.hits / totalRequests : 0,
    };
  }

  /**
   * Clear all cached audio
   */
  clear(): void {
    for (const entry of this.cache.values()) {
      if (entry.audio.src.startsWith("blob:")) {
        URL.revokeObjectURL(entry.audio.src);
      }
      entry.audio.src = "";
    }
    this.cache.clear();
    this.loading.clear();
    this.headChecks.clear();
    this.headCheckCache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Delete specific entry
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      if (entry.audio.src.startsWith("blob:")) {
        URL.revokeObjectURL(entry.audio.src);
      }
      entry.audio.src = "";
      this.cache.delete(key);
      return true;
    }
    return false;
  }

  /**
   * Get cache size
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Clear persistent IndexedDB cache
   */
  async clearPersistent(): Promise<void> {
    try {
      const db = await getDB();
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      store.clear();
    } catch {
      // Ignore errors
    }
  }
}

// Singleton instance
export const audioCache = new AudioCache();
