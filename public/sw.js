/**
 * NUR Lingo — Service Worker
 * Handles offline support, caching, and background notifications
 */

const CACHE_NAME = "nur-lingo-v1";
const STATIC_CACHE = "nur-static-v1";
const AUDIO_CACHE = "nur-audio-v1";
const IMAGE_CACHE = "nur-images-v1";

// Static assets to cache immediately
const STATIC_ASSETS = [
  "/",
  "/world",
  "/dictionary",
  "/review",
  "/curriculum",
  "/learn",
  "/dialogues",
  "/garden",
  "/onboarding",
  "/manifest.json",
];

// Install event - cache static assets
self.addEventListener("install", (event) => {
  console.log("[SW] Installing service worker");

  event.waitUntil(
    Promise.all([
      // Cache static pages
      caches.open(STATIC_CACHE).then((cache) => {
        console.log("[SW] Caching static assets");
        return cache.addAll(STATIC_ASSETS).catch((err) => {
          console.warn("[SW] Some static assets failed to cache:", err);
        });
      }),
    ]).then(() => {
      console.log("[SW] Installation complete");
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating service worker");

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            // Delete old caches
            return (
              name.startsWith("nur-") &&
              name !== STATIC_CACHE &&
              name !== AUDIO_CACHE &&
              name !== IMAGE_CACHE
            );
          })
          .map((name) => {
            console.log("[SW] Deleting old cache:", name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log("[SW] Activation complete");
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // Skip API calls and auth
  if (url.pathname.startsWith("/api/") || url.hostname.includes("supabase")) {
    return;
  }

  // Handle audio files specially
  if (url.pathname.startsWith("/audio/")) {
    event.respondWith(handleAudioRequest(request));
    return;
  }

  // Handle images
  if (request.destination === "image") {
    event.respondWith(handleImageRequest(request));
    return;
  }

  // Handle static assets
  event.respondWith(handleStaticRequest(request));
});

// Handle audio requests with cache-first strategy
async function handleAudioRequest(request) {
  const cache = await caches.open(AUDIO_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    console.log("[SW] Audio cache hit:", request.url);
    return cached;
  }

  console.log("[SW] Audio cache miss, fetching:", request.url);

  try {
    const response = await fetch(request);
    if (response.ok) {
      // Cache the audio file
      const responseClone = response.clone();
      cache.put(request, responseClone);
      console.log("[SW] Audio cached:", request.url);
    }
    return response;
  } catch (error) {
    console.warn("[SW] Audio fetch failed:", request.url);
    return new Response("Audio not available offline", { status: 503 });
  }
}

// Handle image requests with cache-first strategy
async function handleImageRequest(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const responseClone = response.clone();
      cache.put(request, responseClone);
    }
    return response;
  } catch (error) {
    // Return placeholder image for offline
    return new Response(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect fill="#ddd" width="100" height="100"/><text x="50" y="50" font-size="14" text-anchor="middle" dy=".3em" fill="#999">Offline</text></svg>',
      {
        headers: { "Content-Type": "image/svg+xml" },
      }
    );
  }
}

// Handle static requests with stale-while-revalidate
async function handleStaticRequest(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  // Always try network first for navigation
  if (request.mode === "navigate") {
    try {
      const response = await fetch(request);
      if (response.ok) {
        const responseClone = response.clone();
        cache.put(request, responseClone);
      }
      return response;
    } catch (error) {
      // Fallback to cache
      if (cached) {
        return cached;
      }
      // Return offline page
      return caches.match("/");
    }
  }

  // For other requests, serve cache first
  if (cached) {
    // Revalidate in background
    fetch(request)
      .then((response) => {
        if (response.ok) {
          cache.put(request, response);
        }
      })
      .catch(() => {});
    return cached;
  }

  // Fetch from network
  try {
    const response = await fetch(request);
    if (response.ok) {
      const responseClone = response.clone();
      cache.put(request, responseClone);
    }
    return response;
  } catch (error) {
    // Return offline page for navigation
    if (request.mode === "navigate") {
      return caches.match("/");
    }
    return new Response("Offline", { status: 503 });
  }
}

// Handle push notifications
self.addEventListener("push", function(event) {
  const data = event.data ? event.data.json() : {
    title: "NUR Lingo",
    body: "Time for your Armenian lesson!"
  };

  const options = {
    body: data.body,
    icon: "/images/nuri/nuri-happy.png",
    badge: "/favicon.ico",
    data: {
      url: data.url || "/"
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification clicks
self.addEventListener("notificationclick", function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});

// Handle messages from the app
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data && event.data.type === "CACHE_AUDIO") {
    const { urls } = event.data;
    cacheAudioFiles(urls);
  }

  if (event.data && event.data.type === "CACHE_LESSON") {
    const { wordIds } = event.data;
    cacheLessonAudio(wordIds);
  }
});

// Cache multiple audio files
async function cacheAudioFiles(urls) {
  const cache = await caches.open(AUDIO_CACHE);
  console.log("[SW] Caching audio files:", urls.length);

  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const response = await fetch(url);
      if (response.ok) {
        return cache.put(url, response);
      }
    })
  );

  const cached = results.filter((r) => r.status === "fulfilled").length;
  console.log(`[SW] Cached ${cached}/${urls.length} audio files`);

  // Notify app
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: "AUDIO_CACHED",
        cached,
        total: urls.length,
      });
    });
  });
}

// Cache all audio for a lesson
async function cacheLessonAudio(wordIds) {
  const urls = [];
  for (const id of wordIds) {
    const paddedId = String(id).padStart(6, "0");
    ["hy", "en", "ru"].forEach((lang) => {
      urls.push(`/audio/${lang}/${paddedId}.mp3`);
    });
  }
  await cacheAudioFiles(urls);
}

console.log("[SW] Service worker loaded");
