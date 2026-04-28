import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { getYouTubeEmbedUrl, getYouTubeSearchUrl, searchViaInvidiousMany, searchViaPipedMany, getTrendingViaPiped } from "@/lib/youtube";
import {
  Youtube, Search, X, Loader2, ExternalLink, Play,
  TrendingUp, Music2, Zap, Heart, Dumbbell, Flame, Eye
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface YTVideo {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  viewCount?: string;
  duration?: string;
}

// ─── API Keys (same rotation system) ─────────────────────────────────────────

const API_KEYS: string[] = [
  import.meta.env.VITE_YOUTUBE_API_KEY_1,
  import.meta.env.VITE_YOUTUBE_API_KEY_2,
  import.meta.env.VITE_YOUTUBE_API_KEY_3,
  import.meta.env.VITE_YOUTUBE_API_KEY_4,
  import.meta.env.VITE_YOUTUBE_API_KEY_5,
].filter((k) => k && k.trim().length > 0);

const exhausted = new Set<string>();
function getKey() { return API_KEYS.find(k => !exhausted.has(k)) || null; }
function burnKey(k: string) { exhausted.add(k); }

async function ytFetch(url: string): Promise<any> {
  const res = await fetch(url);
  if (res.status === 403) throw new Error("QUOTA");
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  return res.json();
}

/**
 * Returns true if a video is safe to embed — checks all known reasons for
 * "Video unavailable": embedding disabled, region blocked (IN), age restricted,
 * private, or an ongoing live stream.
 */
function isEmbeddable(v: any): boolean {
  // Must be public
  if (v.status?.privacyStatus !== "public") return false;
  // Must allow embedding
  if (v.status?.embeddable === false) return false;
  // Must not be an active live stream (live streams often fail in embeds)
  if (v.snippet?.liveBroadcastContent === "live") return false;
  // Must not be region-blocked in India
  const blocked: string[] = v.contentDetails?.regionRestriction?.blocked || [];
  if (blocked.includes("IN")) return false;
  // If allowed list exists, India must be in it
  const allowed: string[] = v.contentDetails?.regionRestriction?.allowed || [];
  if (allowed.length > 0 && !allowed.includes("IN")) return false;
  // Must not be age-restricted (ytRating or any contentRating key)
  const rating = v.contentDetails?.contentRating || {};
  if (rating.ytRating === "ytAgeRestricted") return false;
  return true;
}

async function searchVideos(query: string, maxResults = 20): Promise<YTVideo[]> {
  // ── PRIMARY: Piped + YouTube API run in PARALLEL ─────────────────────────────
  // Piped results appear FIRST (primary), YouTube API fills remaining slots.
  // Both fire simultaneously for speed, then merged with Piped taking priority.

  const pipedPromise = (async (): Promise<YTVideo[]> => {
    try {
      const piped = await searchViaPipedMany(query, maxResults);
      return piped.map(v => ({
        videoId: v.videoId,
        title: v.title,
        channelTitle: v.channelTitle,
        thumbnailUrl: v.thumbnailUrl,
      }));
    } catch {
      return [];
    }
  })();

  const ytPromise = (async (): Promise<YTVideo[]> => {
    let key = getKey();
    while (key) {
      try {
        const params = new URLSearchParams({
          part: "snippet", q: query, type: "video",
          videoCategoryId: "10", maxResults: "50",
          regionCode: "IN", relevanceLanguage: "hi",
          safeSearch: "moderate", key,
        });
        const data = await ytFetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
        const items: any[] = data?.items || [];
        if (!items.length) return [];

        const ids = items.map((i: any) => i.id.videoId).join(",");
        const sParams = new URLSearchParams({
          part: "status,snippet,statistics,contentDetails", id: ids, key,
        });
        const sData = await ytFetch(`https://www.googleapis.com/youtube/v3/videos?${sParams}`);
        const videos: any[] = sData?.items || [];

        return videos.filter(isEmbeddable).map((v: any) => ({
          videoId: v.id,
          title: v.snippet.title,
          channelTitle: v.snippet.channelTitle,
          thumbnailUrl: v.snippet.thumbnails?.high?.url || v.snippet.thumbnails?.medium?.url || "",
          viewCount: formatViews(v.statistics?.viewCount),
          duration: formatDuration(v.contentDetails?.duration),
        }));
      } catch (e: any) {
        if (e.message === "QUOTA") { burnKey(key); key = getKey(); continue; }
        break;
      }
    }
    return [];
  })();

  // Both run simultaneously, wait for both
  const [pipedResults, ytResults] = await Promise.all([pipedPromise, ytPromise]);

  // Merge: PIPED FIRST (primary), YouTube API fills remaining slots
  const seen = new Set<string>();
  const merged: YTVideo[] = [];

  for (const v of [...pipedResults, ...ytResults]) {
    if (!v.videoId || seen.has(v.videoId)) continue;
    seen.add(v.videoId);
    merged.push(v);
    if (merged.length >= maxResults) break;
  }

  // If both failed → Invidious last resort
  if (merged.length === 0) {
    console.info("Piped + YouTube API both empty — trying Invidious fallback...");
    try {
      const inv = await searchViaInvidiousMany(query, maxResults);
      return inv.map(v => ({ videoId: v.videoId, title: v.title, channelTitle: v.channelTitle, thumbnailUrl: v.thumbnailUrl }));
    } catch { return []; }
  }

  return merged;
}



function formatViews(n?: string): string {
  if (!n) return "";
  const num = parseInt(n);
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B views`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M views`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K views`;
  return `${num} views`;
}

function formatDuration(iso?: string): string {
  if (!iso) return "";
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return "";
  const h = parseInt(match[1] || "0");
  const m = parseInt(match[2] || "0");
  const s = parseInt(match[3] || "0");
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ─── Categories ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: "trending",    label: "Trending",   icon: TrendingUp, query: "trending hindi songs india 2025",         color: "from-orange-500 to-red-500" },
  { id: "bollywood",  label: "Bollywood",  icon: Music2,     query: "bollywood hit songs 2024 2025",           color: "from-pink-500 to-rose-500" },
  { id: "party",      label: "Party",      icon: Zap,        query: "bollywood party dance songs 2025",        color: "from-purple-500 to-violet-500" },
  { id: "romantic",   label: "Romantic",   icon: Heart,      query: "romantic hindi songs 2024",               color: "from-red-400 to-pink-600" },
  { id: "devotional", label: "Devotional", icon: Flame,      query: "bhakti devotional songs hindi 2025",      color: "from-amber-500 to-orange-600" },
  { id: "workout",    label: "Workout",    icon: Dumbbell,   query: "gym workout motivation hindi songs 2025",  color: "from-green-500 to-emerald-600" },
];

// ─── Video Card ───────────────────────────────────────────────────────────────

function VideoCard({ video, onPlay, isPlaying }: { video: YTVideo; onPlay: () => void; isPlaying: boolean }) {
  return (
    <div
      onClick={onPlay}
      className={cn(
        "group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300",
        "bg-card/50 border hover:scale-[1.03] hover:shadow-2xl",
        isPlaying
          ? "border-red-500/60 shadow-lg shadow-red-500/20 ring-1 ring-red-500/30"
          : "border-border/40 hover:border-red-500/30"
      )}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video overflow-hidden bg-black">
        <img
          src={video.thumbnailUrl}
          alt={video.title}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          loading="lazy"
        />
        {/* Play overlay */}
        <div className={cn(
          "absolute inset-0 flex items-center justify-center transition-all duration-300",
          isPlaying ? "bg-black/30" : "bg-black/0 group-hover:bg-black/40"
        )}>
          <div className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300",
            isPlaying
              ? "bg-red-600 scale-100 opacity-100"
              : "bg-white/90 scale-75 opacity-0 group-hover:scale-100 group-hover:opacity-100"
          )}>
            {isPlaying
              ? <div className="flex gap-0.5 items-end h-5"><div className="w-1 bg-white animate-[bounce_0.6s_ease-in-out_infinite]" style={{height:"60%"}} /><div className="w-1 bg-white animate-[bounce_0.6s_ease-in-out_infinite_0.2s]" style={{height:"100%"}} /><div className="w-1 bg-white animate-[bounce_0.6s_ease-in-out_infinite_0.1s]" style={{height:"40%"}} /></div>
              : <Play className="w-5 h-5 text-gray-900 ml-0.5" />
            }
          </div>
        </div>

        {/* Duration badge */}
        {video.duration && (
          <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded font-mono">
            {video.duration}
          </span>
        )}

        {/* Now Playing badge */}
        {isPlaying && (
          <span className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            Playing
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className={cn(
          "text-sm font-medium leading-snug line-clamp-2 mb-1 transition-colors",
          isPlaying ? "text-red-400" : "text-foreground group-hover:text-white"
        )}>
          {video.title}
        </p>
        <p className="text-xs text-muted-foreground truncate">{video.channelTitle}</p>
        {video.viewCount && (
          <p className="text-xs text-muted-foreground/60 mt-0.5 flex items-center gap-1">
            <Eye className="w-3 h-3" /> {video.viewCount}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function YouTubePage() {
  const { user, isLoading: authLoading } = useAuth();
  const [activeCategory, setActiveCategory] = useState("trending");
  const [videos, setVideos] = useState<YTVideo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [playingVideo, setPlayingVideo] = useState<YTVideo | null>(null);
  const [videoError, setVideoError] = useState(false);   // true = current video unavailable
  const [skipping, setSkipping] = useState(false);       // true = auto-skipping to next
  const playerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const skipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noKeys = API_KEYS.length === 0;

  // ─ Auto-skip: detect YouTube player errors via postMessage ────────────────────
  // Requires enablejsapi=1 in embed URL (now set in getYouTubeEmbedUrl).
  // Error codes: 100=not found, 101/150=embedding disabled
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        // Video is actually PLAYING → cancel any error state
        if (data?.event === "onStateChange" && data?.info === 1) {
          setVideoError(false);
          setSkipping(false);
        }
        // YouTube IFrame API error event
        if (data?.event === "onError" && [100, 101, 150].includes(data?.info)) {
          handleVideoUnavailable();
        }
        if (data?.event === "video-unavailable") {
          handleVideoUnavailable();
        }
      } catch { /* ignore non-JSON messages */ }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [playingVideo, videos]); // eslint-disable-line

  // Reset error state when a new video starts
  useEffect(() => {
    setVideoError(false);
    setSkipping(false);
    // Removed the 8-second aggressive skip timer because it caused false positives 
    // when browsers block autoplay or users wait to click play. 
    // We now solely rely on the postMessage onError event for skipping.
  }, [playingVideo?.videoId]); // eslint-disable-line

  // Skip to next video automatically
  const handleVideoUnavailable = useCallback(() => {
    setVideoError(true);
    setSkipping(true);
    setTimeout(() => {
      setVideos(prev => {
        const idx = prev.findIndex(v => v.videoId === playingVideo?.videoId);
        const next = prev[idx + 1];
        if (next) {
          setPlayingVideo(next);
        } else {
          setPlayingVideo(null);
        }
        setSkipping(false);
        setVideoError(false);
        return prev;
      });
    }, 1500); // 1.5s so user sees "Skipping..." before next video loads
  }, [playingVideo]);

  // Load videos for category or search
  const loadVideos = useCallback(async (query: string, usePipedTrending = false) => {
    setIsLoading(true);
    try {
      let results: YTVideo[] = [];
      // For Trending category, try Piped's real trending endpoint first
      if (usePipedTrending) {
        const trending = await getTrendingViaPiped("IN");
        if (trending.length > 0) {
          results = trending.map(v => ({ videoId: v.videoId, title: v.title, channelTitle: v.channelTitle, thumbnailUrl: v.thumbnailUrl }));
        }
      }
      // Fall back to search if trending didn't work or not trending category
      if (!results.length) {
        results = await searchVideos(query, 24);
      }
      setVideos(results);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Category change
  useEffect(() => {
    if (!searchQuery) {
      const cat = CATEGORIES.find(c => c.id === activeCategory);
      if (cat) loadVideos(cat.query, cat.id === "trending");
    }
  }, [activeCategory, searchQuery, loadVideos]);

  // Search submit
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    setSearchQuery(searchInput.trim());
    loadVideos(searchInput.trim());
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchInput("");
    const cat = CATEGORIES.find(c => c.id === activeCategory);
    if (cat) loadVideos(cat.query);
    searchRef.current?.focus();
  };

  const playVideo = (video: YTVideo) => {
    setPlayingVideo(video);
    setVideoError(false);
    setSkipping(false);
    setTimeout(() => playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  };

  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-12 h-12 text-red-500 animate-spin" />
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;

  const activeCat = CATEGORIES.find(c => c.id === activeCategory)!;

  return (
    <MainLayout>
      <div className="min-h-screen pb-36 relative">
        {/* Background glow */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-red-600/5 blur-[120px] rounded-full" />
        </div>

        <main className="max-w-7xl mx-auto px-4 py-8 relative z-10">

          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 rounded-2xl bg-red-600/20 border border-red-500/30">
              <Youtube className="w-8 h-8 text-red-500" />
            </div>
            <div>
              <h1 className="text-3xl font-orbitron font-bold text-white">Music Videos</h1>
              <p className="text-muted-foreground text-sm mt-0.5">Watch official music videos inside RAANG BEAT</p>
            </div>
          </div>

          {/* No API key warning */}
          {noKeys && (
            <div className="mb-6 p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/30 flex items-center gap-3">
              <Youtube className="w-5 h-5 text-yellow-500 flex-shrink-0" />
              <p className="text-yellow-400 text-sm">
                Add YouTube API keys to <code className="text-yellow-300">.env</code> to enable video search.
              </p>
            </div>
          )}

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="mb-8">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                ref={searchRef}
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Search any video, song, or artist..."
                className={cn(
                  "w-full pl-12 pr-14 py-4 rounded-2xl text-base transition-all duration-300",
                  "bg-card/60 backdrop-blur-xl border border-border/50",
                  "focus:outline-none focus:border-red-500/60 focus:bg-card/80 focus:shadow-lg focus:shadow-red-500/10",
                  "placeholder:text-muted-foreground/50"
                )}
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {searchQuery && (
              <div className="flex items-center gap-2 mt-2 px-1">
                <span className="text-sm text-muted-foreground">Showing results for</span>
                <span className="text-sm text-red-400 font-medium">"{searchQuery}"</span>
                <button onClick={clearSearch} className="text-xs text-muted-foreground hover:text-foreground transition-colors underline">
                  Clear
                </button>
              </div>
            )}
          </form>

          {/* Category Filters — only show when not searching */}
          {!searchQuery && (
            <div className="flex gap-2 mb-8 flex-wrap">
              {CATEGORIES.map(cat => {
                const isActive = cat.id === activeCategory;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300",
                      isActive
                        ? `bg-gradient-to-r ${cat.color} text-white shadow-lg`
                        : "bg-card/50 border border-border/40 text-muted-foreground hover:border-red-500/30 hover:text-foreground"
                    )}
                  >
                    <cat.icon className="w-4 h-4" />
                    {cat.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Now Playing Player */}
          {playingVideo && (
            <div ref={playerRef} className="mb-10 animate-fade-in">
              <div className="rounded-3xl overflow-hidden border border-red-500/20 shadow-2xl shadow-red-500/10 bg-card/50 backdrop-blur-xl">
                {/* Player */}
                <div className="relative w-full bg-black" style={{ aspectRatio: "16/9" }}>
                  {!skipping && (
                    <iframe
                      key={playingVideo.videoId}
                      src={getYouTubeEmbedUrl(playingVideo.videoId)}
                      title={playingVideo.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      referrerPolicy="strict-origin-when-cross-origin"
                      className="absolute inset-0 w-full h-full border-0"
                    />
                  )}
                  {/* Auto-skip overlay */}
                  {skipping && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black gap-3">
                      <Loader2 className="w-10 h-10 text-red-500 animate-spin" />
                      <p className="text-white/80 text-sm font-medium">Video unavailable — skipping to next...</p>
                    </div>
                  )}
                  {/* Manual skip button (shows after 3s if user doesn't want to wait) */}
                  {videoError && !skipping && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 gap-4">
                      <Youtube className="w-12 h-12 text-red-500/50" />
                      <p className="text-white/70 text-sm">This video can't be embedded</p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            const idx = videos.findIndex(v => v.videoId === playingVideo.videoId);
                            const next = videos[idx + 1];
                            if (next) playVideo(next);
                            else setPlayingVideo(null);
                          }}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-xl transition-colors flex items-center gap-2"
                        >
                          <Play className="w-4 h-4" /> Skip to Next
                        </button>
                        <a
                          href={`https://www.youtube.com/watch?v=${playingVideo.videoId}`}
                          target="_blank" rel="noopener noreferrer"
                          className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-xl transition-colors"
                        >
                          Watch on YouTube
                        </a>
                      </div>
                    </div>
                  )}
                </div>
                {/* Video Info */}
                <div className="p-5 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="flex items-center gap-1.5 text-xs text-red-400 font-semibold bg-red-500/10 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        NOW PLAYING
                      </span>
                    </div>
                    <h2 className="text-lg font-semibold text-white line-clamp-2 mb-1">{playingVideo.title}</h2>
                    <p className="text-sm text-muted-foreground">{playingVideo.channelTitle}</p>
                    {playingVideo.viewCount && (
                      <p className="text-xs text-muted-foreground/60 mt-1 flex items-center gap-1">
                        <Eye className="w-3 h-3" /> {playingVideo.viewCount}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <a
                      href={`https://www.youtube.com/watch?v=${playingVideo.videoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-sm transition-all"
                    >
                      <ExternalLink className="w-4 h-4" />
                      YouTube
                    </a>
                    <button
                      onClick={() => setPlayingVideo(null)}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Section Title */}
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span className="w-1 h-6 bg-gradient-to-b from-red-500 to-red-700 rounded-full" />
              {searchQuery ? `Results for "${searchQuery}"` : activeCat.label}
            </h2>
            {!noKeys && (
              <a
                href={getYouTubeSearchUrl(searchQuery || activeCat.query, "")}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-red-400 transition-colors"
              >
                More on YouTube <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>

          {/* Video Grid */}
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="rounded-2xl overflow-hidden bg-card/30 border border-border/30 animate-pulse">
                  <div className="aspect-video bg-muted/30" />
                  <div className="p-3 space-y-2">
                    <div className="h-3 bg-muted/30 rounded w-full" />
                    <div className="h-3 bg-muted/30 rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : videos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {videos.map((video) => (
                <VideoCard
                  key={video.videoId}
                  video={video}
                  onPlay={() => playVideo(video)}
                  isPlaying={playingVideo?.videoId === video.videoId}
                />
              ))}
            </div>
          ) : !noKeys ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <Youtube className="w-16 h-16 text-muted-foreground/30" />
              <p className="text-muted-foreground text-lg">No videos found</p>
              <p className="text-muted-foreground/60 text-sm">Try a different search or category</p>
            </div>
          ) : null}
        </main>
      </div>
    </MainLayout>
  );
}
