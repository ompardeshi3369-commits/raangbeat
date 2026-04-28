// Official YouTube Data API v3 — Legal embedding via Google's official API
// Supports multiple API keys with automatic rotation on quota exhaustion
// Falls back to Invidious public instances (free, no key needed) when all keys exhausted

const YT_SEARCH_BASE = "https://www.googleapis.com/youtube/v3/search";
const YT_VIDEOS_BASE = "https://www.googleapis.com/youtube/v3/videos";

// ─── Invidious Public Instances (free fallback, no key needed) ────────────────
// These are publicly hosted Invidious servers with open APIs.
// Used ONLY for search (video IDs) — videos still play via official YouTube embed.
const INVIDIOUS_INSTANCES = [
  "https://iv.datura.network",
  "https://invidious.privacydev.net",
  "https://yt.cdaut.de",
  "https://invidious.nerdvpn.de",
  "https://invidious.fdn.fr",
  "https://invidious.slipfox.xyz",
];

// ─── Piped Public Instances (another free fallback, no key needed) ────────────
// Piped is another open-source YouTube frontend with a documented public API.
// Used ONLY for search + trending — videos still play via official YouTube embed.
// Docs: https://docs.piped.video/docs/api-documentation/
const PIPED_INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.adminforge.de",
  "https://piped-api.garudalinux.org",
  "https://api.piped.yt",
  "https://pipedapi.drgns.space",
];

// Track failed instances this session
const failedInstances = new Set<string>();
const failedPipedInstances = new Set<string>();

// ─── YouTube API Key Rotation ─────────────────────────────────────────────────

const API_KEYS: string[] = [
  import.meta.env.VITE_YOUTUBE_API_KEY_1,
  import.meta.env.VITE_YOUTUBE_API_KEY_2,
  import.meta.env.VITE_YOUTUBE_API_KEY_3,
  import.meta.env.VITE_YOUTUBE_API_KEY_4,
  import.meta.env.VITE_YOUTUBE_API_KEY_5,
].filter((k) => k && k.trim().length > 0);

const exhaustedKeys = new Set<string>();

function getAvailableKey(): string | null {
  return API_KEYS.filter((k) => !exhaustedKeys.has(k))[0] || null;
}

function markKeyExhausted(key: string) {
  exhaustedKeys.add(key);
  console.warn(`YouTube API key exhausted, rotating. (${exhaustedKeys.size}/${API_KEYS.length} used up)`);
}

function allKeysExhausted(): boolean {
  return API_KEYS.length > 0 && exhaustedKeys.size >= API_KEYS.length;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface YouTubeVideo {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
}

// ─── Embeddability Check ──────────────────────────────────────────────────────

/**
 * Full embeddability check — covers all causes of "Video unavailable":
 * embedding disabled, region blocked in India, age-restricted, private, live stream.
 */
function isEmbeddable(v: any): boolean {
  if (v.status?.privacyStatus !== "public") return false;
  if (v.status?.embeddable === false) return false;
  if (v.snippet?.liveBroadcastContent === "live") return false;
  const blocked: string[] = v.contentDetails?.regionRestriction?.blocked || [];
  if (blocked.includes("IN")) return false;
  const allowed: string[] = v.contentDetails?.regionRestriction?.allowed || [];
  if (allowed.length > 0 && !allowed.includes("IN")) return false;
  const rating = v.contentDetails?.contentRating || {};
  if (rating.ytRating === "ytAgeRestricted") return false;
  return true;
}

// ─── YouTube Data API v3 Helpers ──────────────────────────────────────────────

async function searchWithKey(key: string, query: string): Promise<any[]> {
  const params = new URLSearchParams({
    part: "snippet", q: query, type: "video",
    videoCategoryId: "10", maxResults: "10",
    safeSearch: "moderate", key,
  });
  const res = await fetch(`${YT_SEARCH_BASE}?${params.toString()}`);
  if (res.status === 403) { markKeyExhausted(key); throw new Error("QUOTA_EXCEEDED"); }
  if (!res.ok) throw new Error(`YouTube search HTTP ${res.status}`);
  const data = await res.json();
  return data?.items || [];
}

async function getEmbeddableVideos(key: string, videoIds: string[]): Promise<any[]> {
  if (!videoIds.length) return [];
  const params = new URLSearchParams({
    part: "status,snippet,contentDetails", id: videoIds.join(","), key,
  });
  const res = await fetch(`${YT_VIDEOS_BASE}?${params.toString()}`);
  if (res.status === 403) { markKeyExhausted(key); throw new Error("QUOTA_EXCEEDED"); }
  if (!res.ok) return [];
  const data = await res.json();
  return (data?.items || []).filter(isEmbeddable);
}

// ─── Invidious Fallback Search ────────────────────────────────────────────────

/**
 * Search using Invidious public API (free, no key needed).
 * Returns video IDs only — videos still play via official YouTube embed player.
 * Used as fallback when all YouTube API keys are exhausted.
 */
async function searchViaInvidious(query: string): Promise<YouTubeVideo | null> {
  const available = INVIDIOUS_INSTANCES.filter(i => !failedInstances.has(i));
  if (!available.length) return null;

  for (const instance of available) {
    try {
      const params = new URLSearchParams({
        q: query,
        type: "video",
        fields: "videoId,title,author,videoThumbnails",
        sort_by: "relevance",
      });
      const res = await fetch(
        `${instance}/api/v1/search?${params.toString()}`,
        { signal: AbortSignal.timeout(5000) }  // 5s timeout per instance
      );
      if (!res.ok) { failedInstances.add(instance); continue; }

      const results: any[] = await res.json();
      if (!Array.isArray(results) || !results.length) continue;

      // Pick first result with a valid videoId
      const video = results.find(r => r.videoId && r.title);
      if (!video) continue;

      // Get best thumbnail
      const thumb = video.videoThumbnails?.find((t: any) => t.quality === "high")
        || video.videoThumbnails?.[0];

      console.info(`Invidious fallback used (${instance})`);
      return {
        videoId: video.videoId,
        title: video.title,
        channelTitle: video.author || "",
        thumbnailUrl: thumb?.url || `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`,
      };
    } catch {
      failedInstances.add(instance);
    }
  }

  return null;
}

// ─── Main Search Function ─────────────────────────────────────────────────────

/**
 * Search YouTube for an official music video.
 * Priority:
 *   1. YouTube Data API v3 (with full embeddability check, multi-key rotation)
 *   2. Invidious public API fallback (when all API keys exhausted)
 * Videos always play via official youtube-nocookie.com embed.
 */
export async function searchYouTubeVideo(
  title: string,
  artist: string
): Promise<YouTubeVideo | null> {
  const queries = [
    `${title} ${artist} official video`,
    `${title} ${artist} official audio`,
    `${title} ${artist} lyrics`,
    `${title} ${artist}`,
  ];

  // ── Try YouTube Data API v3 first ──────────────────────────────────────────
  if (API_KEYS.length > 0) {
    for (const query of queries) {
      let key = getAvailableKey();

      while (key) {
        try {
          const items = await searchWithKey(key, query);
          if (!items.length) break;

          const videoIds = items.map((item: any) => item.id.videoId);
          let embeddableVideos: any[] = [];
          try {
            embeddableVideos = await getEmbeddableVideos(key, videoIds);
          } catch {
            const first = items[0];
            if (first) return {
              videoId: first.id.videoId,
              title: first.snippet.title,
              channelTitle: first.snippet.channelTitle,
              thumbnailUrl: first.snippet.thumbnails?.high?.url || "",
            };
          }

          if (embeddableVideos.length > 0) {
            const v = embeddableVideos[0];
            return {
              videoId: v.id,
              title: v.snippet.title,
              channelTitle: v.snippet.channelTitle,
              thumbnailUrl: v.snippet.thumbnails?.high?.url || "",
            };
          }
          break;
        } catch (err: any) {
          if (err.message === "QUOTA_EXCEEDED") { key = getAvailableKey(); continue; }
          break;
        }
      }

      if (!key) break; // All keys exhausted — fall through to Invidious
    }
  }

  // ── Fallback tier 1: Piped (free, no key needed) — PRIMARY fallback ───────
  if (API_KEYS.length === 0 || allKeysExhausted()) {
    console.info("All YouTube API keys exhausted — trying Piped fallback first...");
    for (const query of queries) {
      const result = await searchViaPipedOne(query);
      if (result) return result;
    }

    // ── Fallback tier 2: Invidious (if Piped also fails) ──────────────────
    console.info("Piped failed — trying Invidious fallback...");
    for (const query of queries) {
      const result = await searchViaInvidious(query);
      if (result) return result;
    }
  }

  return null;
}

// ─── Invidious Search for YouTube Page ───────────────────────────────────────

/**
 * Search Invidious for multiple videos (used by YouTube page as fallback grid).
 * Returns video IDs played via official YouTube embed.
 */
export async function searchViaInvidiousMany(
  query: string,
  maxResults = 20
): Promise<YouTubeVideo[]> {
  const available = INVIDIOUS_INSTANCES.filter(i => !failedInstances.has(i));
  if (!available.length) return [];

  for (const instance of available) {
    try {
      const params = new URLSearchParams({
        q: query, type: "video",
        fields: "videoId,title,author,videoThumbnails,lengthSeconds,viewCount",
        sort_by: "relevance",
      });
      const res = await fetch(
        `${instance}/api/v1/search?${params.toString()}`,
        { signal: AbortSignal.timeout(6000) }
      );
      if (!res.ok) { failedInstances.add(instance); continue; }

      const results: any[] = await res.json();
      if (!Array.isArray(results) || !results.length) continue;

      return results
        .filter(r => r.videoId && r.title)
        .slice(0, maxResults)
        .map(r => {
          const thumb = r.videoThumbnails?.find((t: any) => t.quality === "high")
            || r.videoThumbnails?.[0];
          return {
            videoId: r.videoId,
            title: r.title,
            channelTitle: r.author || "",
            thumbnailUrl: thumb?.url || `https://i.ytimg.com/vi/${r.videoId}/hqdefault.jpg`,
          };
        });
    } catch {
      failedInstances.add(instance);
    }
  }

  return [];
}

/**
 * Search using Piped public API (free, no key needed).
 * Returns one video — used as fallback after Invidious.
 * Videos still play via official YouTube embed.
 */
async function searchViaPipedOne(query: string): Promise<YouTubeVideo | null> {
  const available = PIPED_INSTANCES.filter(i => !failedPipedInstances.has(i));
  if (!available.length) return null;

  for (const instance of available) {
    try {
      const params = new URLSearchParams({ q: query, filter: "videos" });
      const res = await fetch(
        `${instance}/search?${params.toString()}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!res.ok) { failedPipedInstances.add(instance); continue; }

      const data = await res.json();
      const items: any[] = data?.items || [];
      const video = items.find(r => r.url && r.title && !r.uploaderName?.includes("Mix"));
      if (!video) continue;

      // Extract videoId from url like "/watch?v=dQw4w9WgXcQ"
      const videoId = new URLSearchParams(video.url.split("?")[1]).get("v");
      if (!videoId) continue;

      console.info(`Piped fallback used (${instance})`);
      return {
        videoId,
        title: video.title,
        channelTitle: video.uploaderName || "",
        thumbnailUrl: video.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      };
    } catch {
      failedPipedInstances.add(instance);
    }
  }
  return null;
}

/**
 * Search using Piped public API — returns multiple results.
 * Used by the YouTube page grid as fallback.
 */
export async function searchViaPipedMany(
  query: string,
  maxResults = 20
): Promise<YouTubeVideo[]> {
  const available = PIPED_INSTANCES.filter(i => !failedPipedInstances.has(i));
  if (!available.length) return [];

  for (const instance of available) {
    try {
      const params = new URLSearchParams({ q: query, filter: "videos" });
      const res = await fetch(
        `${instance}/search?${params.toString()}`,
        { signal: AbortSignal.timeout(6000) }
      );
      if (!res.ok) { failedPipedInstances.add(instance); continue; }

      const data = await res.json();
      const items: any[] = data?.items || [];

      return items
        .filter(r => r.url && r.title)
        .slice(0, maxResults)
        .map(r => {
          const videoId = new URLSearchParams(r.url.split("?")[1]).get("v") || "";
          return {
            videoId,
            title: r.title,
            channelTitle: r.uploaderName || "",
            thumbnailUrl: r.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          };
        })
        .filter(v => v.videoId);
    } catch {
      failedPipedInstances.add(instance);
    }
  }
  return [];
}

/**
 * Get trending videos for India using Piped's /trending endpoint.
 * Great for the Trending category on the YouTube page.
 */
export async function getTrendingViaPiped(region = "IN"): Promise<YouTubeVideo[]> {
  const available = PIPED_INSTANCES.filter(i => !failedPipedInstances.has(i));
  if (!available.length) return [];

  for (const instance of available) {
    try {
      const res = await fetch(
        `${instance}/trending?region=${region}`,
        { signal: AbortSignal.timeout(6000) }
      );
      if (!res.ok) { failedPipedInstances.add(instance); continue; }

      const items: any[] = await res.json();
      if (!Array.isArray(items) || !items.length) continue;

      return items
        .filter(r => r.url && r.title)
        .slice(0, 24)
        .map(r => {
          const videoId = new URLSearchParams(r.url.split("?")[1]).get("v") || "";
          return {
            videoId,
            title: r.title,
            channelTitle: r.uploaderName || "",
            thumbnailUrl: r.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          };
        })
        .filter(v => v.videoId);
    } catch {
      failedPipedInstances.add(instance);
    }
  }
  return [];
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function getYouTubeSearchUrl(title: string, artist: string): string {
  const query = encodeURIComponent(`${title} ${artist} official video`);
  return `https://www.youtube.com/results?search_query=${query}`;
}

export function getYouTubeEmbedUrl(videoId: string): string {
  const params = new URLSearchParams({
    autoplay: "1",
    rel: "0",
    modestbranding: "1",
    iv_load_policy: "3",
    enablejsapi: "1",        // ← REQUIRED: enables postMessage error events
    origin: window.location.origin,
  });
  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}

export function getKeyStatus(): { total: number; available: number; invidiousAvailable: boolean; pipedAvailable: boolean } {
  return {
    total: API_KEYS.length,
    available: API_KEYS.filter((k) => !exhaustedKeys.has(k)).length,
    invidiousAvailable: INVIDIOUS_INSTANCES.filter(i => !failedInstances.has(i)).length > 0,
    pipedAvailable: PIPED_INSTANCES.filter(i => !failedPipedInstances.has(i)).length > 0,
  };
}

