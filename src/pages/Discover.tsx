import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { jiosaavnApi, JioSaavnTrack } from "@/lib/jiosaavn";
import { deduplicateSongs } from "@/lib/musicUtils";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { useMongoFavorites } from "@/hooks/useMongoFavorites";
import { AddToPlaylistModal } from "@/components/playlist/AddToPlaylistModal";
import { Play, TrendingUp, Sparkles, Music2, Heart, Loader2, ListPlus } from "lucide-react";
import { cn } from "@/lib/utils";

// Convert JioSaavn track to player Track format (with optional mood)
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

const MOODS = [
  { id: "romantic", label: "Romantic", emoji: "💕", color: "from-pink-500 to-rose-500" },
  { id: "party", label: "Party", emoji: "🎉", color: "from-purple-500 to-fuchsia-500" },
  { id: "chill", label: "Chill", emoji: "😌", color: "from-green-500 to-teal-500" },
  { id: "devotional", label: "Devotional", emoji: "🙏", color: "from-orange-500 to-amber-500" },
  { id: "workout", label: "Workout", emoji: "💪", color: "from-red-500 to-orange-500" },
];

interface SongCardProps {
  song: JioSaavnTrack;
  index?: number;
  onPlay: (song: JioSaavnTrack) => void;
  showRank?: boolean;
  mood?: string;
}

function SongCard({ song, index, onPlay, showRank, mood }: SongCardProps) {
  const { isFavorite, toggleFavorite } = useMongoFavorites();
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);

  const track = jiosaavnToTrack(song, mood);

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite(track.id, track);
  };

  const handlePlaylist = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowPlaylistModal(true);
  };

  return (
    <>
      <div
        onClick={() => onPlay(song)}
        className="group flex items-center gap-3 p-3 rounded-xl bg-card/50 hover:bg-card transition-all border border-border/50 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 cursor-pointer"
      >
        {showRank && index !== undefined && (
          <span className={cn(
            "text-2xl font-bold w-8 text-center",
            index === 0 && "text-yellow-500",
            index === 1 && "text-gray-400",
            index === 2 && "text-amber-600",
            index > 2 && "text-muted-foreground"
          )}>
            {index + 1}
          </span>
        )}
        <div className="relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
          <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Play className="w-6 h-6 text-white fill-white" />
          </div>
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="font-medium truncate group-hover:text-primary transition-colors">{song.title}</p>
          <p className="text-sm text-muted-foreground truncate">{song.artist}</p>
          {mood && (
            <span className={cn(
              "inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full mt-0.5",
              mood === "romantic" && "bg-pink-500/20 text-pink-400",
              mood === "chill" && "bg-green-500/20 text-green-400",
              mood === "party" && "bg-purple-500/20 text-purple-400",
              mood === "devotional" && "bg-orange-500/20 text-orange-400",
              mood === "workout" && "bg-red-500/20 text-red-400",
            )}>
              {MOODS.find(m => m.id === mood)?.emoji} {mood}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handlePlaylist}
            className="p-2 rounded-full hover:bg-muted/50 transition-colors"
            title="Add to playlist"
          >
            <ListPlus className="w-4 h-4" />
          </button>
          <button
            onClick={handleFavorite}
            className={cn(
              "p-2 rounded-full hover:bg-muted/50 transition-colors",
              isFavorite(track.id) && "text-red-500"
            )}
            title={isFavorite(track.id) ? "Remove from favorites" : "Add to favorites"}
          >
            <Heart className={cn("w-4 h-4", isFavorite(track.id) && "fill-current")} />
          </button>
        </div>
      </div>

      <AddToPlaylistModal
        isOpen={showPlaylistModal}
        onClose={() => setShowPlaylistModal(false)}
        songId={track.id}
        songTitle={track.title}
        trackData={{
          title: track.title,
          artist: track.artist,
          artistId: track.artistId,
          coverUrl: track.coverUrl,
          audioUrl: track.audioUrl,
          duration: track.duration,
        }}
      />
    </>
  );
}

// Module-level cache — persists across page navigations
let cachedDiscoverTrending: JioSaavnTrack[] | null = null;
let cachedDiscoverNewReleases: JioSaavnTrack[] | null = null;
let cachedMoodSongsMap: Record<string, JioSaavnTrack[]> = {};
let discoverCacheTimestamp = 0;
const DISCOVER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export default function Discover() {
  const [trending, setTrending] = useState<JioSaavnTrack[]>(cachedDiscoverTrending || []);
  const [newReleases, setNewReleases] = useState<JioSaavnTrack[]>(cachedDiscoverNewReleases || []);
  const [moodSongs, setMoodSongs] = useState<JioSaavnTrack[]>([]);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);

  const [trendingPage, setTrendingPage] = useState(1);
  const [newReleasesPage, setNewReleasesPage] = useState(1);
  const [moodPage, setMoodPage] = useState(1);

  const [isLoadingTrending, setIsLoadingTrending] = useState(!cachedDiscoverTrending);
  const [isLoadingNew, setIsLoadingNew] = useState(!cachedDiscoverNewReleases);
  const [isLoadingMood, setIsLoadingMood] = useState(false);

  const [isLoadingMoreTrending, setIsLoadingMoreTrending] = useState(false);
  const [isLoadingMoreNew, setIsLoadingMoreNew] = useState(false);
  const [isLoadingMoreMood, setIsLoadingMoreMood] = useState(false);

  const { playTrack, setQueue } = usePlayer();

  useEffect(() => {
    loadTrending();
    loadNewReleases();
  }, []);

  const loadTrending = async () => {
    // Use cache if fresh
    if (cachedDiscoverTrending && (Date.now() - discoverCacheTimestamp < DISCOVER_CACHE_TTL)) {
      setTrending(cachedDiscoverTrending);
      setIsLoadingTrending(false);
      return;
    }

    setIsLoadingTrending(!cachedDiscoverTrending);
    try {
      const result = await jiosaavnApi.getTrending(1, 40);
      const songs = deduplicateSongs((result.songs || []).filter(s => s.hasLyrics === true)) as JioSaavnTrack[];
      setTrending(songs);
      setTrendingPage(1);

      // Update cache
      cachedDiscoverTrending = songs;
      discoverCacheTimestamp = Date.now();
    } catch (error) {
      console.error("Failed to load trending:", error);
    } finally {
      setIsLoadingTrending(false);
    }
  };

  const loadMoreTrending = async () => {
    setIsLoadingMoreTrending(true);
    try {
      const nextPage = trendingPage + 1;
      const result = await jiosaavnApi.getTrending(nextPage, 20);
      const filtered = (result.songs || []).filter(s => s.hasLyrics === true);
      if (filtered.length > 0) {
        setTrending(prev => [...prev, ...filtered]);
        setTrendingPage(nextPage);
      }
    } catch (error) {
      console.error("Failed to load more trending:", error);
    } finally {
      setIsLoadingMoreTrending(false);
    }
  };

  const loadNewReleases = async () => {
    // Use cache if fresh
    if (cachedDiscoverNewReleases && (Date.now() - discoverCacheTimestamp < DISCOVER_CACHE_TTL)) {
      setNewReleases(cachedDiscoverNewReleases);
      setIsLoadingNew(false);
      return;
    }

    setIsLoadingNew(!cachedDiscoverNewReleases);
    try {
      const result = await jiosaavnApi.getNewReleases(1, 40);
      const songs = deduplicateSongs((result.songs || []).filter(s => s.hasLyrics === true)) as JioSaavnTrack[];
      setNewReleases(songs);
      setNewReleasesPage(1);

      // Update cache
      cachedDiscoverNewReleases = songs;
    } catch (error) {
      console.error("Failed to load new releases:", error);
    } finally {
      setIsLoadingNew(false);
    }
  };

  const loadMoreNewReleases = async () => {
    setIsLoadingMoreNew(true);
    try {
      const nextPage = newReleasesPage + 1;
      const result = await jiosaavnApi.getNewReleases(nextPage, 24);
      const filtered = (result.songs || []).filter(s => s.hasLyrics === true);
      if (filtered.length > 0) {
        setNewReleases(prev => [...prev, ...filtered]);
        setNewReleasesPage(nextPage);
      }
    } catch (error) {
      console.error("Failed to load more new releases:", error);
    } finally {
      setIsLoadingMoreNew(false);
    }
  };

  const loadMoodSongs = async (mood: string) => {
    setSelectedMood(mood);
    setMoodPage(1);

    // Use mood cache if available
    if (cachedMoodSongsMap[mood]) {
      setMoodSongs(cachedMoodSongsMap[mood]);
      setIsLoadingMood(false);
      return;
    }

    setIsLoadingMood(true);
    try {
      const result = await jiosaavnApi.getSongsByMood(mood, 1, 40);
      const songs = deduplicateSongs(result.songs || []) as JioSaavnTrack[];
      setMoodSongs(songs);

      // Cache per mood
      cachedMoodSongsMap[mood] = songs;
    } catch (error) {
      console.error("Failed to load mood songs:", error);
    } finally {
      setIsLoadingMood(false);
    }
  };

  const loadMoreMoodSongs = async () => {
    if (!selectedMood) return;
    setIsLoadingMoreMood(true);
    try {
      const nextPage = moodPage + 1;
      const result = await jiosaavnApi.getSongsByMood(selectedMood, nextPage, 20);
      const newSongs = result.songs || [];
      if (newSongs.length > 0) {
        setMoodSongs(prev => deduplicateSongs([...prev, ...newSongs]) as JioSaavnTrack[]);
        setMoodPage(nextPage);
      }
    } catch (error) {
      console.error("Failed to load more mood songs:", error);
    } finally {
      setIsLoadingMoreMood(false);
    }
  };

  const handlePlaySong = (song: JioSaavnTrack, mood?: string) => {
    playTrack(jiosaavnToTrack(song, mood));
  };

  const handlePlayAll = (songs: JioSaavnTrack[], mood?: string) => {
    if (songs.length === 0) return;
    const tracks = songs.map(s => jiosaavnToTrack(s, mood));
    setQueue(tracks);
    playTrack(tracks[0]);
  };

  return (
    <MainLayout>
      <div className="p-6 space-y-8 pb-32">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
            <Sparkles className="w-8 h-8" />
            Discover
          </h1>
          <p className="text-muted-foreground">Explore millions of songs from around the world</p>
        </div>

        {/* Mood Selection */}
        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Heart className="w-5 h-5 text-primary" />
            Browse by Mood
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {MOODS.map((mood) => (
              <button
                key={mood.id}
                onClick={() => loadMoodSongs(mood.id)}
                className={cn(
                  "p-4 rounded-xl transition-all border",
                  selectedMood === mood.id
                    ? `bg-gradient-to-br ${mood.color} text-white border-transparent shadow-lg`
                    : "bg-card/50 border-border/50 hover:border-primary/30 hover:bg-card"
                )}
              >
                <span className="text-2xl mb-1 block">{mood.emoji}</span>
                <span className="font-medium text-sm">{mood.label}</span>
              </button>
            ))}
          </div>

          {/* Mood Songs Results */}
          {selectedMood && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium capitalize">
                  {MOODS.find(m => m.id === selectedMood)?.label} Songs
                </h3>
                {moodSongs.length > 0 && (
                  <button
                    onClick={() => handlePlayAll(moodSongs, selectedMood)}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Play All
                  </button>
                )}
              </div>
              {isLoadingMood ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {moodSongs.map((song) => (
                      <SongCard key={song.id} song={song} onPlay={(s) => handlePlaySong(s, selectedMood)} mood={selectedMood} />
                    ))}
                  </div>
                  {moodSongs.length > 0 && (
                    <div className="flex justify-center">
                      <button
                        onClick={loadMoreMoodSongs}
                        disabled={isLoadingMoreMood}
                        className="flex items-center gap-2 px-6 py-2 rounded-xl bg-card border border-border/50 hover:border-primary/30 hover:bg-card/80 transition-all text-sm font-medium"
                      >
                        {isLoadingMoreMood ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Loading...
                          </>
                        ) : (
                          "Load More Songs"
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Trending Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Trending Now
            </h2>
            {trending.length > 0 && (
              <button
                onClick={() => handlePlayAll(trending)}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                <Play className="w-4 h-4" />
                Play All
              </button>
            )}
          </div>
          {isLoadingTrending ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {trending.map((song, index) => (
                  <SongCard key={song.id} song={song} index={index} onPlay={handlePlaySong} showRank />
                ))}
              </div>
              {trending.length > 0 && (
                <div className="flex justify-center">
                  <button
                    onClick={loadMoreTrending}
                    disabled={isLoadingMoreTrending}
                    className="flex items-center gap-2 px-6 py-2 rounded-xl bg-card border border-border/50 hover:border-primary/30 hover:bg-card/80 transition-all text-sm font-medium"
                  >
                    {isLoadingMoreTrending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      "Load More Trending"
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* New Releases Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Music2 className="w-5 h-5 text-accent" />
              New Releases
            </h2>
            {newReleases.length > 0 && (
              <button
                onClick={() => handlePlayAll(newReleases)}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
              >
                <Play className="w-4 h-4" />
                Play All
              </button>
            )}
          </div>
          {isLoadingNew ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {newReleases.map((song) => (
                  <button
                    key={song.id}
                    onClick={() => handlePlaySong(song)}
                    className="group flex flex-col gap-2 text-left"
                  >
                    <div className="relative aspect-square rounded-xl overflow-hidden">
                      <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
                          <Play className="w-6 h-6 text-primary-foreground fill-current ml-1" />
                        </div>
                      </div>
                    </div>
                    <div className="px-1">
                      <p className="font-medium truncate text-sm group-hover:text-primary transition-colors">{song.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                    </div>
                  </button>
                ))}
              </div>
              {newReleases.length > 0 && (
                <div className="flex justify-center">
                  <button
                    onClick={loadMoreNewReleases}
                    disabled={isLoadingMoreNew}
                    className="flex items-center gap-2 px-6 py-2 rounded-xl bg-card border border-border/50 hover:border-primary/30 hover:bg-card/80 transition-all text-sm font-medium"
                  >
                    {isLoadingMoreNew ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      "Load More Releases"
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </MainLayout>
  );
}
