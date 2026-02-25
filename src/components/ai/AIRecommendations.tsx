import { useState, useMemo, useEffect } from "react";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { GlassCard } from "@/components/ui/GlassCard";
import { Sparkles, RefreshCw, Play, Pause, Heart, Loader2, ListPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMongoFavorites } from "@/hooks/useMongoFavorites";
import { AddToPlaylistModal } from "@/components/playlist/AddToPlaylistModal";
import { Link } from "react-router-dom";
import { jiosaavnApi, JioSaavnTrack } from "@/lib/jiosaavn";

interface AIRecommendationsProps {
  allTracks: Track[];
}

const moodEmojis: Record<string, string> = {
  romantic: "💕",
  sad: "💫",
  chill: "🌿",
  party: "🎉",
  devotional: "🙏",
  workout: "💪",
};

export function AIRecommendations({ allTracks }: AIRecommendationsProps) {
  const { currentTrack, isPlaying, playTrack, togglePlay, queue } = usePlayer();
  const { toggleFavorite, isFavorite, favorites, getFavoriteMetadata } = useMongoFavorites();
  const [recommendations, setRecommendations] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);

  // Mood keyword lists for validating API results actually match the mood
  const moodKeywords: Record<string, string[]> = {
    romantic: ["love", "ishq", "pyar", "dil", "mohabbat", "sanam", "jaan", "tumse", "tere", "teri", "sajna", "humsafar", "aashiq", "romance", "pyaar", "dhadkan", "pehli nazar"],
    party: ["party", "dance", "dj", "beat", "club", "naach", "nachle", "bhangra", "groove", "baby", "swag", "thumka", "dhol", "peene"],
    chill: ["chill", "relax", "soft", "calm", "peace", "soothing", "sufi", "acoustic", "unplugged", "lofi", "breeze"],
    devotional: ["bhajan", "aarti", "prayer", "devotional", "bhakti", "chalisa", "rama", "shiva", "ganesha", "shlok", "mahadev", "krishna", "hanuman"],
    workout: ["workout", "gym", "pump", "energy", "power", "strong", "fire", "ziddi", "beast", "motivation"],
  };

  // Additional search queries per mood to improve variety
  const moodSearchQueries: Record<string, string[]> = {
    romantic: ["romantic hindi songs", "love songs bollywood", "pyar hindi", "ishq songs hindi"],
    party: ["party songs hindi", "dance bollywood songs", "dj hindi songs", "bhangra songs"],
    chill: ["chill hindi songs", "unplugged bollywood", "soft hindi songs", "sufi songs hindi"],
    devotional: ["devotional hindi songs", "bhajan hindi", "aarti songs", "bhakti songs"],
    workout: ["workout hindi songs", "gym songs bollywood", "motivation hindi songs", "energy songs hindi"],
  };

  // Prioritize currently playing track's mood over favorites
  const preferredMood = useMemo(() => {
    // If currently playing a song with a mood, use THAT mood
    if (currentTrack?.mood) return currentTrack.mood;

    // Otherwise, infer from favorites
    const moodCounts: Record<string, number> = {};
    favorites.forEach((songId) => {
      const t = queue.find((q) => q.id === songId);
      if (t?.mood) {
        moodCounts[t.mood] = (moodCounts[t.mood] || 0) + 1;
      }
    });
    const sorted = Object.entries(moodCounts).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] || null;
  }, [favorites, queue, currentTrack?.mood]);

  // Check if a song's title/artist matches mood keywords
  const matchesMood = (title: string, artist: string, mood: string): boolean => {
    const text = `${title} ${artist}`.toLowerCase();
    const keywords = moodKeywords[mood] || [];
    return keywords.some(k => text.includes(k));
  };

  const generateRecommendations = async () => {
    setIsLoading(true);

    const targetMood = preferredMood || "romantic";

    try {
      // Use multiple search strategies for better results
      const queries = moodSearchQueries[targetMood] || [`${targetMood} hindi songs`];
      const randomQuery = queries[Math.floor(Math.random() * queries.length)];

      const [moodResult, searchResult] = await Promise.all([
        jiosaavnApi.getSongsByMood(targetMood, 1, 20),
        jiosaavnApi.searchSongs(randomQuery, 1, 20),
      ]);

      // Combine and deduplicate results
      const allSongs = [
        ...(moodResult?.songs || []),
        ...(searchResult?.songs || []),
      ];

      // Filter: must have lyrics, must match mood keywords, no remixes
      const filtered = allSongs.filter((s: JioSaavnTrack) => {
        if (!s.hasLyrics) return false;
        const titleLower = s.title.toLowerCase();
        if (titleLower.includes("remix") || titleLower.includes("mashup") || titleLower.includes("lofi")) return false;
        // Validate the song actually matches the target mood
        return matchesMood(s.title, s.artist, targetMood);
      });

      // Deduplicate by title similarity
      const seen = new Set<string>();
      const unique = filtered.filter(s => {
        const key = s.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      if (unique.length > 0) {
        // Shuffle and pick 4
        const shuffled = unique.sort(() => Math.random() - 0.5);
        const moodTracks: Track[] = shuffled.slice(0, 4).map((s: JioSaavnTrack) => ({
          id: s.id,
          title: s.title,
          artist: s.artist,
          artistId: s.artistId,
          coverUrl: s.coverUrl,
          audioUrl: s.audioUrl,
          duration: s.duration,
          mood: targetMood,
        }));
        setRecommendations(moodTracks);
        setReason(`${moodEmojis[targetMood] || "🎵"} ${targetMood.charAt(0).toUpperCase() + targetMood.slice(1)} picks for you`);
        setIsLoading(false);
        return;
      }
    } catch (e) {
      console.error("Mood fetch failed, falling back:", e);
    }

    // Fallback to local tracks matching the mood
    const targetMoodFallback = preferredMood || "romantic";
    const moodMatches = allTracks.filter((t) => t.mood === targetMoodFallback && !favorites.has(t.id));

    const pool = moodMatches.length > 0 ? moodMatches : allTracks.filter((t) => !favorites.has(t.id));
    const scored = pool.map((track) => {
      let score = Math.random() * 0.2;
      if (track.mood === targetMoodFallback) score += 0.5;
      if (track.mood === currentTrack?.mood) score += 0.3;
      if (currentTrack && track.artistId === currentTrack.artistId) score += 0.2;
      return { track, score };
    });

    const top = scored.sort((a, b) => b.score - a.score).slice(0, 4).map((s) => s.track);
    setRecommendations(top);

    if (preferredMood) {
      setReason(`${moodEmojis[targetMoodFallback] || "🎵"} ${targetMoodFallback.charAt(0).toUpperCase() + targetMoodFallback.slice(1)} picks for you`);
    } else if (currentTrack) {
      setReason(`Because you're listening to ${currentTrack.artist}`);
    } else {
      setReason("Curated picks for you");
    }

    setIsLoading(false);
  };

  // Auto-generate on first render
  if (recommendations.length === 0 && !isLoading && allTracks.length > 0) {
    generateRecommendations();
  }

  const openPlaylistModal = (track: Track) => {
    setSelectedTrack(track);
    setShowPlaylistModal(true);
  };

  return (
    <>
      <GlassCard className="p-5" glow>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-neon-purple/30 to-primary/20">
              <Sparkles className="w-5 h-5 text-neon-purple" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">AI For You</h3>
              {reason && <p className="text-xs text-muted-foreground">{reason}</p>}
            </div>
          </div>
          <button
            onClick={generateRecommendations}
            disabled={isLoading}
            className="p-2 rounded-xl hover:bg-muted/50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <span className="ml-2 text-muted-foreground">Analyzing your taste...</span>
          </div>
        ) : (
          <div className="space-y-2">
            {recommendations.map((track, index) => {
              const isActive = currentTrack?.id === track.id;
              return (
                <div
                  key={track.id}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-xl transition-all cursor-pointer group",
                    isActive ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/50"
                  )}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <span className="text-xs text-muted-foreground w-4">{index + 1}</span>

                  <div
                    className="relative"
                    onClick={() => (isActive ? togglePlay() : playTrack(track))}
                  >
                    <img
                      src={track.coverUrl}
                      alt={track.title}
                      className="w-10 h-10 rounded-lg object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                      {isActive && isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium truncate", isActive && "text-primary")}>
                      {track.title}
                    </p>
                    <Link
                      to={`/artist/${track.artistId}`}
                      className="text-xs text-muted-foreground truncate block hover:text-primary transition-colors"
                    >
                      {track.artist}
                    </Link>
                  </div>

                  {track.mood && <span className="text-sm">{moodEmojis[track.mood] || "🎵"}</span>}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openPlaylistModal(track);
                    }}
                    className="p-1.5 rounded-full transition-all opacity-0 group-hover:opacity-100 hover:bg-muted/50"
                  >
                    <ListPlus className="w-4 h-4" />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(track.id, track);
                    }}
                    className={cn(
                      "p-1.5 rounded-full transition-all opacity-0 group-hover:opacity-100",
                      isFavorite(track.id) ? "text-destructive opacity-100" : "hover:text-destructive/80"
                    )}
                  >
                    <Heart className={cn("w-4 h-4", isFavorite(track.id) && "fill-current")} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      {selectedTrack && (
        <AddToPlaylistModal
          isOpen={showPlaylistModal}
          onClose={() => setShowPlaylistModal(false)}
          songId={selectedTrack.id}
          songTitle={selectedTrack.title}
          trackData={{
            title: selectedTrack.title,
            artist: selectedTrack.artist,
            artistId: selectedTrack.artistId,
            coverUrl: selectedTrack.coverUrl,
            audioUrl: selectedTrack.audioUrl,
            duration: selectedTrack.duration,
          }}
        />
      )}
    </>
  );
}
