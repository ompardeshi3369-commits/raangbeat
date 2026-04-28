import { useState, useEffect } from "react";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { jiosaavnApi, JioSaavnTrack } from "@/lib/jiosaavn";
import { deduplicateSongs, shuffleArray } from "@/lib/musicUtils";
import { BassReactiveBackground } from "@/components/effects/BassReactiveBackground";

import { TrendingSection } from "@/components/home/TrendingSection";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { AnimatedActionButton } from "@/components/ui/AnimatedActionButton";
import { AudioVisualizer } from "@/components/effects/AudioVisualizer";
import { AIRecommendations } from "@/components/ai/AIRecommendations";
import { AddToPlaylistModal } from "@/components/playlist/AddToPlaylistModal";
import { Play, Pause, Heart, Loader2, Sparkles, ListMusic, Flame } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, Link, useSearchParams } from "react-router-dom";
import { useMongoFavorites } from "@/hooks/useMongoFavorites";
import { MainLayout } from "@/components/layout/MainLayout";
import { cn } from "@/lib/utils";

// Detect mood from song title/artist keywords
const ROMANTIC_KEYWORDS = ["love", "ishq", "pyar", "dil", "mohabbat", "sanam", "jaan", "tumse", "tere", "teri", "sajna", "sajan", "humsafar", "mehboob", "aashiq", "valentine", "romance", "romantic", "pyaar", "dhadkan", "zindagi", "pehli nazar", "deewaniyat", "sitaare"];
const PARTY_KEYWORDS = ["party", "dance", "dj", "beat", "club", "naach", "nachle", "garba", "balle", "bhangra", "moves", "groove", "baby", "swag", "remix", "mashup", "gaana", "dhol", "peene", "thumka"];
const CHILL_KEYWORDS = ["chill", "relax", "soft", "calm", "peace", "soothing", "sufi", "acoustic", "unplugged", "lofi", "meditation", "instrumental", "breeze", "arz kiya hai"];
const DEVOTIONAL_KEYWORDS = ["bhajan", "aarti", "prayer", "devotional", "bhakti", "chalisa", "rama", "shiva", "ganesha", "namo", "shlok", "stotra", "mahadev", "bappa", "darshan", "shri", "namah", "vithal", "radha", "shyam", "hare", "krishna"];
const WORKOUT_KEYWORDS = ["workout", "gym", "pump", "energy", "power", "strong", "run", "fire", "ziddi", "beast", "motivation", "dhurandhar"];

function detectMood(title: string, artist: string): string {
  const text = `${title} ${artist}`.toLowerCase();

  // Explicit overrides for specific songs/artists to prevent false positives
  if (text.includes("hanumankind") || text.includes("dhurandhar")) return "workout";
  if (text.includes("udit narayan") && text.includes("cheez badi")) return "party";
  if (text.includes("hanuman") && !text.includes("hanumankind")) return "devotional"; // Only tag Hanuman if NOT Hanumankind

  // Explicit overrides for specific songs/artists to prevent false positives
  if (text.includes("hanumankind") || text.includes("dhurandhar")) return "workout";
  if (text.includes("udit narayan") && text.includes("cheez badi")) return "party";
  if (text.includes("hanuman") && !text.includes("hanumankind")) return "devotional"; // Only tag Hanuman if NOT Hanumankind

  const matches = (keywords: string[]) =>
    keywords.some(k => {
      const escapedK = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedK}\\b`, 'i');
      return regex.test(text);
    });

  if (text.includes("chalisa")) return "devotional";

  // Priority logic
  if (matches(DEVOTIONAL_KEYWORDS)) return "devotional";
  if (matches(PARTY_KEYWORDS)) return "party";
  if (matches(WORKOUT_KEYWORDS)) return "workout";
  if (matches(CHILL_KEYWORDS)) return "chill";
  if (matches(ROMANTIC_KEYWORDS)) return "romantic";

  return "romantic"; // Default for Bollywood
}

// Convert JioSaavn track to internal Track format
const jiosaavnToTrack = (song: JioSaavnTrack, mood?: string): Track => ({
  id: song.id,
  title: song.title,
  artist: song.artist,
  artistId: song.artistId,
  coverUrl: song.coverUrl,
  audioUrl: song.audioUrl,
  duration: song.duration,
  mood,
});

const moodEmojis: Record<string, string> = {
  romantic: "💕",
  chill: "🌿",
  party: "🎉",
  devotional: "🙏",
  workout: "💪",
};

const moodColors: Record<string, string> = {
  romantic: "from-pink-500/20 to-red-500/10", // Kept unchanged as requested
  chill: "from-emerald-500/30 to-teal-500/20",
  party: "from-violet-600/30 to-fuchsia-600/20",
  devotional: "from-amber-500/40 to-orange-600/40", // Made significantly more visible
  workout: "from-red-600/30 to-orange-600/20",
};

// Filter out remixes, mashups, DJ edits — show only original songs
const isOriginalSong = (title: string) => {
  const t = title.toLowerCase();
  return ![
    "remix", "mashup", "dj ", "lofi", " mix", "medley",
    "jukebox", "nonstop", "non stop", "karaoke", "tribute",
    "cover", "reprint", "re-print", "edited", "radio edit",
    "extended", "instrumental", "reprise",
  ].some(kw => t.includes(kw));
};

// Global cache to prevent refetching and loading lag when navigating back to Home
let cachedHomeTracks: Track[] | null = null;
let cachedAllTracksPage = 1;
let cachedHasMore = true;

export default function Home() {
  const { user, isLoading: authLoading } = useAuth();
  const { currentTrack, isPlaying, playTrack, togglePlay, setQueue } = usePlayer();
  const { toggleFavorite, isFavorite } = useMongoFavorites();
  const [searchParams] = useSearchParams();
  const showAI = searchParams.get('ai') === 'true';

  const [apiTracks, setApiTracks] = useState<Track[]>(cachedHomeTracks || []);
  const [isLoading, setIsLoading] = useState(!cachedHomeTracks);
  const [allTracksPage, setAllTracksPage] = useState(cachedAllTracksPage);
  const [visibleCount, setVisibleCount] = useState(20); // start with 20 cards, expand on demand
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(cachedHasMore);
  const [playlistTrack, setPlaylistTrack] = useState<Track | null>(null); // shared modal
  const TRACKS_PER_PAGE = 20;

  // Load songs from JioSaavn API
  useEffect(() => {
    const loadApiSongs = async () => {
      // CACHE FIX: If we already have tracks in memory, load them instantly and skip the API fetch!
      if (cachedHomeTracks && cachedHomeTracks.length > 0) {
        setQueue(cachedHomeTracks);
        return;
      }

      setIsLoading(true);
      try {
        // Random page 1-4 so every visit shows different songs
        const rp = () => Math.floor(Math.random() * 4) + 1;

        const [
          trendingRes,
          newReleasesRes,
          romanticRes,
          partyRes,
          chillRes,
          workoutRes,
          devotionalRes,
          popRes
        ] = await Promise.all([
          jiosaavnApi.getTrending(rp(), 40),
          jiosaavnApi.getNewReleases(rp(), 40),
          jiosaavnApi.getSongsByMood("romantic", rp(), 20),
          jiosaavnApi.getSongsByMood("party", rp(), 20),
          jiosaavnApi.getSongsByMood("chill", rp(), 30),
          jiosaavnApi.getSongsByMood("workout", rp(), 30),
          jiosaavnApi.getSongsByMood("devotional", rp(), 15),
          jiosaavnApi.searchSongs("latest bollywood hindi", rp(), 20),
        ]);

        // Combine and filter — only original songs with lyrics, no mashups
        const allSongs = [
          ...(trendingRes?.songs || []),
          ...(newReleasesRes?.songs || []),
          ...(romanticRes?.songs || []),
          ...(partyRes?.songs || []),
          ...(chillRes?.songs || []),
          ...(workoutRes?.songs || []),
          ...(devotionalRes?.songs || []),
          ...(popRes?.songs || []),
        ].filter(song => song.hasLyrics && isOriginalSong(song.title));

        // Deduplicate + shuffle for fresh order every visit
        const uniqueSongs = deduplicateSongs(allSongs);
        const shuffledSongs = shuffleArray(uniqueSongs);

        // Assign moods
        const tracks = shuffledSongs.map((song) =>
          jiosaavnToTrack(song as JioSaavnTrack, detectMood(song.title, song.artist))
        );

        setApiTracks(tracks);
        setQueue(tracks);
        
        // Save to cache so next visit is instant!
        cachedHomeTracks = tracks;
      } catch (error) {
        console.error("Error loading songs from JioSaavn:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      loadApiSongs();
    }
  }, [user, setQueue]);

  // Load more: first expand already-loaded tracks, then fetch from API
  const loadMoreTracks = async () => {
    if (isLoadingMore) return;

    // If there are more cached tracks not yet shown, just reveal them
    const currentShown = visibleCount;
    const totalLoaded = apiTracks.length - 15; // first 15 in trending
    if (currentShown < totalLoaded) {
      setVisibleCount(prev => prev + TRACKS_PER_PAGE);
      return;
    }

    if (!hasMore) return;
    setIsLoadingMore(true);
    try {
      const nextPage = allTracksPage + 1;
      const [trendingRes, newReleasesRes] = await Promise.all([
        jiosaavnApi.getTrending(nextPage, 20),
        jiosaavnApi.getNewReleases(nextPage, 20),
      ]);
      const newSongs = [
        ...(trendingRes?.songs || []),
        ...(newReleasesRes?.songs || []),
      ].filter(s => s.hasLyrics && isOriginalSong(s.title));

      if (newSongs.length === 0) {
        setHasMore(false);
        cachedHasMore = false;
      } else {
        const newTracks = newSongs.map(s => jiosaavnToTrack(s as JioSaavnTrack, detectMood(s.title, s.artist)));
        setApiTracks(prev => {
          const existingIds = new Set(prev.map(t => t.id));
          const updated = [...prev, ...newTracks.filter(t => !existingIds.has(t.id))];
          cachedHomeTracks = updated; // Update cache
          return updated;
        });
        setVisibleCount(prev => prev + TRACKS_PER_PAGE);
        setAllTracksPage(nextPage);
        cachedAllTracksPage = nextPage;
      }
    } catch (err) {
      console.error("Error loading more tracks:", err);
    } finally {
      setIsLoadingMore(false);
    }
  };



  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Show currently playing track in hero, fallback to first track in queue
  const featuredTrack = currentTrack || apiTracks[0];
  const currentMood = currentTrack?.mood || null;

  return (
    <MainLayout>

      <div className="min-h-screen pb-32 relative overflow-hidden">
        {/* Bass-reactive pulse effects */}
        <BassReactiveBackground />

        <main className="max-w-7xl mx-auto px-4 py-8 relative z-10">
          {/* Current Mood Indicator */}
          {currentMood && isPlaying && (
            <div className={cn(
              "fixed top-20 right-4 z-40 px-4 py-2 rounded-full backdrop-blur-xl border border-border/50 animate-fade-in flex items-center gap-2",
              `bg-gradient-to-r ${moodColors[currentMood] || "from-primary/20 to-accent/10"}`
            )}>
              <Sparkles className="w-4 h-4 text-primary animate-pulse" />
              <span className="text-sm font-medium capitalize">
                {moodEmojis[currentMood] || "🎵"} {currentMood} vibes
              </span>
            </div>
          )}

          {/* Hero Featured Track */}
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
            </div>
          ) : featuredTrack ? (
            <section className="mb-12 animate-fade-in">
              <GlassCard className="p-8 relative overflow-hidden" glow>
                <div className="absolute inset-0 opacity-20">
                  <img src={featuredTrack.coverUrl} alt="" className="w-full h-full object-cover blur-3xl" />
                </div>
                <div className="relative flex flex-col md:flex-row items-center gap-8">
                  <div className="relative group">
                    <img
                      src={featuredTrack.coverUrl}
                      alt={featuredTrack.title}
                      className="w-48 h-48 md:w-64 md:h-64 rounded-2xl object-cover shadow-2xl transition-transform group-hover:scale-105"
                    />
                    {/* Rotating ring animation when playing */}
                    {currentTrack?.id === featuredTrack.id && isPlaying && (
                      <div className="absolute -inset-4 border-2 border-primary/30 rounded-3xl animate-spin-slow pointer-events-none" style={{ animationDuration: '8s' }} />
                    )}
                    <button
                      onClick={() => currentTrack?.id === featuredTrack.id ? togglePlay() : playTrack(featuredTrack)}
                      className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"
                    >
                      <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-[0_0_30px_hsl(190_100%_50%/0.5)] hover:scale-110 transition-transform">
                        {currentTrack?.id === featuredTrack.id && isPlaying ? (
                          <Pause className="w-8 h-8 text-primary-foreground" />
                        ) : (
                          <Play className="w-8 h-8 text-primary-foreground ml-1" />
                        )}
                      </div>
                    </button>
                  </div>
                  <div className="text-center md:text-left flex-1">
                    <p className="text-primary text-sm font-medium mb-2 flex items-center gap-2 justify-center md:justify-start">
                      <span className="animate-pulse">🎵</span> FEATURED
                    </p>
                    <h2 className="text-3xl md:text-5xl font-orbitron font-bold mb-2">{featuredTrack.title}</h2>
                    <Link to={`/artist/${featuredTrack.artistId}`} className="text-xl text-muted-foreground hover:text-primary transition-colors">
                      {featuredTrack.artist}
                    </Link>
                    {featuredTrack.mood && (
                      <div className={cn(
                        "inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm mt-3 ml-0 md:ml-3",
                        `bg-gradient-to-r ${moodColors[featuredTrack.mood] || "from-primary/20 to-accent/10"}`
                      )}>
                        {moodEmojis[featuredTrack.mood]} {featuredTrack.mood}
                      </div>
                    )}
                    <div className="flex items-center gap-4 justify-center md:justify-start mt-4">
                      <NeonButton
                        onClick={() => currentTrack?.id === featuredTrack.id ? togglePlay() : playTrack(featuredTrack)}
                        className="group"
                      >
                        {currentTrack?.id === featuredTrack.id && isPlaying ? (
                          <>
                            <Pause className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" /> Pause Now
                          </>
                        ) : (
                          <>
                            <Play className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" /> Play Now
                          </>
                        )}
                      </NeonButton>
                      <NeonButton
                        variant="outline"
                        onClick={() => toggleFavorite(featuredTrack.id, featuredTrack)}
                        className={isFavorite(featuredTrack.id) ? "text-red-500 border-red-500/50" : ""}
                      >
                        <Heart className={`w-5 h-5 transition-transform hover:scale-125 ${isFavorite(featuredTrack.id) ? "fill-current" : ""}`} />
                      </NeonButton>
                    </div>
                  </div>
                  {currentTrack?.id === featuredTrack.id && (
                    <div className="absolute bottom-4 right-4 w-32 h-16">
                      <AudioVisualizer isPlaying={isPlaying} barCount={12} />
                    </div>
                  )}
                </div>
              </GlassCard>
            </section>
          ) : null}

          {/* Trending Section */}
          <TrendingSection />

          {/* AI Recommendations Section */}
          {showAI && (
            <section className="mb-8 animate-fade-in">
              <AIRecommendations allTracks={apiTracks} />
            </section>
          )}

          {/* Track List — shared playlist modal at section level, not per-card */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold flex items-center gap-2">
                <span className="w-1 h-6 bg-gradient-to-b from-primary to-accent rounded-full" />
                All Tracks
              </h3>
              {!showAI && (
                <Link
                  to="/home?ai=true"
                  className="flex items-center gap-2 text-sm text-neon-purple hover:text-neon-purple/80 transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  Get AI Recommendations
                </Link>
              )}
            </div>
            {/* Single shared playlist modal — one instance for all cards */}
            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
              style={{ contentVisibility: "auto" }}
            >
              {apiTracks.slice(15, 15 + visibleCount).map((track) => (
                <TrackCard key={track.id} track={track} onAddToPlaylist={setPlaylistTrack} />
              ))}
            </div>
            {playlistTrack && (
              <AddToPlaylistModal
                isOpen={!!playlistTrack}
                onClose={() => setPlaylistTrack(null)}
                songId={playlistTrack.id}
                songTitle={playlistTrack.title}
                trackData={playlistTrack}
              />
            )}
            {/* Load More button — same pattern as Discover page */}
            <div className="flex justify-center mt-8 mb-2">
              {hasMore ? (
                <button
                  onClick={loadMoreTracks}
                  disabled={isLoadingMore}
                  className="flex items-center gap-2 px-8 py-3 rounded-xl bg-card border border-border/50 hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium text-sm group"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <Flame className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
                      Load More Songs
                    </>
                  )}
                </button>
              ) : (
                <p className="text-sm text-muted-foreground">All songs loaded ✓</p>
              )}
            </div>
          </section>
        </main>
      </div>
    </MainLayout>
  );
}

function TrackCard({ track, onAddToPlaylist }: { track: Track; onAddToPlaylist: (t: Track) => void }) {
  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayer();
  const { toggleFavorite, isFavorite } = useMongoFavorites();
  const isActive = currentTrack?.id === track.id;

  return (
    <GlassCard
      className={cn(
        "p-4 flex items-center gap-3 transition-colors duration-200",
        isActive && isPlaying && `bg-gradient-to-r ${moodColors[track.mood || ""] || "from-primary/10 to-accent/5"}`
      )}
      hover
    >
      <div className="relative group cursor-pointer flex-shrink-0" onClick={() => isActive ? togglePlay() : playTrack(track)}>
        <img src={track.coverUrl} alt={track.title} loading="lazy" className="w-12 h-12 rounded-lg object-cover" />
          {isActive && isPlaying && (
            <div className="absolute inset-0 rounded-lg border-2 border-primary animate-pulse" />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
            {isActive && isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn("font-medium transition-colors text-sm leading-tight truncate", isActive && "text-primary")} title={track.title}>
            {track.title}
          </p>
          <Link to={`/artist/${track.artistId}`} className="text-xs text-muted-foreground hover:text-primary transition-colors block truncate" title={track.artist}>
            {track.artist}
          </Link>
          {track.mood && (
            <span className={cn(
              "inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full mt-1",
              track.mood === "romantic" && "bg-pink-500/20 text-pink-400",
              track.mood === "chill" && "bg-green-500/20 text-green-400",
              track.mood === "party" && "bg-purple-500/20 text-purple-400",
              track.mood === "devotional" && "bg-orange-500/20 text-orange-400",
              track.mood === "workout" && "bg-red-500/20 text-red-400",
            )}>
              {moodEmojis[track.mood]} {track.mood}
            </span>
          )}
        </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <AnimatedActionButton
          type="playlist"
          onClick={() => onAddToPlaylist(track)}
          title="Add to playlist"
          className="!p-1.5"
        >
          <ListMusic className="w-4 h-4" />
        </AnimatedActionButton>
        <AnimatedActionButton
          type="like"
          onClick={() => toggleFavorite(track.id, track)}
          isActive={isFavorite(track.id)}
          className="!p-1.5"
        >
          <Heart className={cn("w-4 h-4", isFavorite(track.id) && "fill-current")} />
        </AnimatedActionButton>
        {isActive && <AudioVisualizer isPlaying={isPlaying} barCount={4} className="w-6 h-6" />}
      </div>
    </GlassCard>
  );
}
