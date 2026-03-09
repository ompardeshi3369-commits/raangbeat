import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { AudioVisualizer } from "@/components/effects/AudioVisualizer";
import { AnimatedActionButton } from "@/components/ui/AnimatedActionButton";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { useMongoFavorites } from "@/hooks/useMongoFavorites";
import { jiosaavnApi, JioSaavnTrack, JioSaavnArtist } from "@/lib/jiosaavn";
import { deduplicateSongs } from "@/lib/musicUtils";
import { Play, Pause, Heart, TrendingUp, Music2, Users, Disc3, Flame, Crown, Star, ListPlus, Shuffle } from "lucide-react";
import { cn } from "@/lib/utils";
import { AddToPlaylistModal } from "@/components/playlist/AddToPlaylistModal";

// Convert JioSaavn track to internal Track format
const jiosaavnToTrack = (song: JioSaavnTrack): Track => ({
  id: song.id,
  title: song.title,
  artist: song.artist,
  artistId: song.artistId,
  coverUrl: song.coverUrl,
  audioUrl: song.audioUrl,
  duration: song.duration,
  mood: undefined,
});

// Popular artists to feature
const POPULAR_ARTIST_NAMES = [
  "Arijit Singh",
  "Shreya Ghoshal",
  "Neha Kakkar",
  "Atif Aslam",
  "Jubin Nautiyal",
  "Badshah",
];

type TabType = "songs" | "artists" | "albums";

const tabConfig = {
  songs: { icon: Music2, label: "Trending Songs", gradient: "from-orange-500 to-pink-500" },
  artists: { icon: Users, label: "Top Artists", gradient: "from-purple-500 to-blue-500" },
  albums: { icon: Disc3, label: "Hot Albums", gradient: "from-cyan-500 to-emerald-500" },
};

import { useLocation } from "react-router-dom";

// Module-level cache — persists across page navigations
let cachedTrendingSongs: Track[] | null = null;
let cachedTopArtists: JioSaavnArtist[] | null = null;
let cachedHotAlbums: any[] | null = null; // Reset on every build to pick up new album queries
let trendingCacheTimestamp = 0;
const TRENDING_CACHE_TTL = 5 * 60 * 1000; // 5 minutes


export function TrendingSection() {
  const location = useLocation();
  // Initialize state directly from navigation state if available
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    if (location.state && (location.state as any).tab) {
      return (location.state as any).tab;
    }
    return "songs";
  });

  // Keep the effect for subsequent navigation updates
  useEffect(() => {
    if (location.state && (location.state as any).tab) {
      setActiveTab((location.state as any).tab);
    }
  }, [location.state]);

  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayer();
  const { toggleFavorite, isFavorite } = useMongoFavorites();
  const [trendingSongs, setTrendingSongs] = useState<Track[]>(cachedTrendingSongs || []);
  const [topArtists, setTopArtists] = useState<JioSaavnArtist[]>(cachedTopArtists || []);
  const [hotAlbums, setHotAlbums] = useState<any[]>(cachedHotAlbums || []);
  const [isLoading, setIsLoading] = useState(!cachedTrendingSongs);
  const [visibleAlbums, setVisibleAlbums] = useState(50); // Show all albums by default as requested
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAlbumsLoading, setIsAlbumsLoading] = useState(!cachedHotAlbums);

  // 1. Fast loading: Songs & Artists
  const loadSongsAndArtists = async () => {
    // Use cache if fresh
    if (cachedTrendingSongs && cachedTopArtists && (Date.now() - trendingCacheTimestamp < TRENDING_CACHE_TTL)) {
      setTrendingSongs(cachedTrendingSongs);
      setTopArtists(cachedTopArtists);
      setIsLoading(false);
      return;
    }

    setIsLoading(!cachedTrendingSongs); // Show loading skeleton only on first load
    setIsRefreshing(true);
    try {
      // Parallel fetch for speed
      const [trendingRes, topArtistsRes] = await Promise.all([
        jiosaavnApi.getTrending(1, 150), // Keep 150 as requested
        Promise.all(POPULAR_ARTIST_NAMES.map(name => jiosaavnApi.searchArtists(name).then(res => res?.artists?.[0] || null)))
      ]);

      // Process Songs
      const filteredSongs = (trendingRes?.songs || []).filter(song => song.hasLyrics === true);
      const uniqueSongs = deduplicateSongs(filteredSongs).slice(0, 12); //Keep 12
      const songs = uniqueSongs.map(jiosaavnToTrack);
      setTrendingSongs(songs);

      // Process Artists
      const artists = topArtistsRes.filter((a): a is JioSaavnArtist => a !== null);
      setTopArtists(artists);

      // Update cache
      cachedTrendingSongs = songs;
      cachedTopArtists = artists;
      trendingCacheTimestamp = Date.now();

    } catch (err) {
      console.error("Error loading songs:", err);
    } finally {
      setIsLoading(false); // Enable UI interaction immediately
      setIsRefreshing(false);
    }
  };

  // 2. Background loading: Albums (Heavy)
  const loadAlbums = async () => {
    // Use cache if fresh
    if (cachedHotAlbums && (Date.now() - trendingCacheTimestamp < TRENDING_CACHE_TTL)) {
      setHotAlbums(cachedHotAlbums);
      setIsAlbumsLoading(false);
      return;
    }

    setIsAlbumsLoading(!cachedHotAlbums); // Show loading skeleton only on first load
    try {
      // a) Dhurandhar
      const dhurandharRes = await jiosaavnApi.searchSongs("Dhurandhar").catch(() => null);
      let dhurandharAlbum = null;
      if (dhurandharRes?.songs?.length) {
        const dhSongs = dhurandharRes.songs.filter(s => s.title.includes("Dhurandhar") || s.album?.includes("Dhurandhar"));
        if (dhSongs.length > 0) {
          dhurandharAlbum = {
            id: "dhurandhar_special_album",
            title: "Dhurandhar",
            artist: "Shashwat Sachdev & More",
            coverUrl: dhSongs[0].coverUrl,
            songCount: dhSongs.length,
            tracks: dhSongs.map(jiosaavnToTrack),
            isFeatured: true
          };
        }
      }

      // b) Featured Albums
      const featuredAlbums = await jiosaavnApi.getFeaturedAlbums();
      const formattedFeatured = featuredAlbums.map(album => ({
        ...album,
        tracks: album.songs.map(jiosaavnToTrack)
      }));

      // Combine
      const albums = dhurandharAlbum ? [dhurandharAlbum, ...formattedFeatured] : formattedFeatured;
      setHotAlbums(albums);

      // Update cache
      cachedHotAlbums = albums;

    } catch (err) {
      console.error("Error loading albums:", err);
    } finally {
      setIsAlbumsLoading(false); // Reveal albums when ready
    }
  };

  useEffect(() => {
    // Run independently
    loadSongsAndArtists();
    loadAlbums();
  }, []);

  return (
    <section className="mb-12 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500/20 to-pink-500/20 backdrop-blur-sm">
            <TrendingUp className="w-6 h-6 text-orange-400" />
          </div>
          <h2 className="text-2xl font-orbitron font-bold bg-gradient-to-r from-orange-400 via-pink-500 to-purple-500 bg-clip-text text-transparent">
            Trending Now
          </h2>
          <Flame className="w-5 h-5 text-orange-500 animate-pulse" />
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 p-1 rounded-2xl bg-background/50 backdrop-blur-md border border-border/50 w-fit">
        {(Object.keys(tabConfig) as TabType[]).map((tab) => {
          const { icon: Icon, label, gradient } = tabConfig[tab];
          const isActive = activeTab === tab;

          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "relative flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-300",
                isActive
                  ? "text-white shadow-lg"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className={cn("absolute inset-0 rounded-xl bg-gradient-to-r", gradient)}
                  initial={false}
                  transition={{ type: "spring", duration: 0.5, bounce: 0.2 }}
                />
              )}
              <Icon className={cn("w-4 h-4 relative z-10", isActive && "text-white")} />
              <span className="relative z-10 hidden sm:inline">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === "songs" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {(isLoading ? Array(8).fill(null) : trendingSongs).map((song, index) => (
                <TrendingSongCard
                  key={song?.id || index}
                  song={song}
                  rank={index + 1}
                  isLoading={isLoading}
                  isActive={currentTrack?.id === song?.id}
                  isPlaying={isPlaying && currentTrack?.id === song?.id}
                  isFavorite={song ? isFavorite(song.id) : false}
                  onPlay={() => song && (currentTrack?.id === song.id ? togglePlay() : playTrack(song))}
                  onToggleFavorite={() => song && toggleFavorite(song.id)}
                />
              ))}
            </div>
          )}

          {activeTab === "artists" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {topArtists.map((artist, index) => (
                <TrendingArtistCard
                  key={artist.id || index}
                  artist={artist}
                  rank={index + 1}
                />
              ))}
            </div>
          )}

          {activeTab === "albums" && (
            <div className="space-y-6">
              <div className="flex justify-end mb-2">
                <button
                  onClick={() => {
                    const shuffled = [...hotAlbums].sort(() => Math.random() - 0.5);
                    setHotAlbums(shuffled);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-primary transition-colors hover:bg-primary/10 rounded-lg group"
                >
                  <Shuffle className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                  Shuffle Albums
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {(isAlbumsLoading ? Array(5).fill(null) : hotAlbums.slice(0, visibleAlbums)).map((album, index) => (
                  <TrendingAlbumCard
                    key={album?.id || index}
                    album={album}
                    rank={index + 1}
                  />
                ))}
              </div>
              {!isAlbumsLoading && hotAlbums.length > visibleAlbums && (
                <div className="flex justify-center">
                  <button
                    onClick={() => setVisibleAlbums(prev => prev + 12)}
                    className="px-6 py-2 rounded-full bg-primary/10 hover:bg-primary/20 text-primary font-medium transition-colors"
                  >
                    View More Albums
                  </button>
                </div>
              )}

              {!isAlbumsLoading && visibleAlbums > 6 && (
                <div className="flex justify-center">
                  <button
                    onClick={() => setVisibleAlbums(6)}
                    className="px-6 py-2 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-500 font-medium transition-colors flex items-center gap-2"
                  >
                    <TrendingUp className="w-4 h-4 rotate-180" /> Show Less
                  </button>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

// Trending Song Card
function TrendingSongCard({
  song,
  rank,
  isLoading,
  isActive,
  isPlaying,
  isFavorite,
  onPlay,
  onToggleFavorite,
}: {
  song: Track | null;
  rank: number;
  isLoading: boolean;
  isActive: boolean;
  isPlaying: boolean;
  isFavorite: boolean;
  onPlay: () => void;
  onToggleFavorite: () => void;
}) {
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);

  if (isLoading || !song) {
    return (
      <GlassCard className="p-3 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-3 bg-muted rounded w-1/2" />
          </div>
        </div>
      </GlassCard>
    );
  }

  const getRankBadge = () => {
    if (rank === 1) return <Crown className="w-4 h-4 text-yellow-400" />;
    if (rank === 2) return <Star className="w-4 h-4 text-slate-300" />;
    if (rank === 3) return <Star className="w-4 h-4 text-amber-600" />;
    return <span className="text-xs font-bold text-muted-foreground">#{rank}</span>;
  };

  return (
    <>
      <GlassCard
        className={cn(
          "p-3 group transition-all duration-300 hover:scale-[1.02]",
          isActive && "ring-2 ring-primary/50 bg-primary/5"
        )}
        hover
      >
        <div className="flex items-center gap-3">
          {/* Rank Badge */}
          <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
            {getRankBadge()}
          </div>

          {/* Cover Art */}
          <div className="relative flex-shrink-0 cursor-pointer" onClick={onPlay}>
            <img
              src={song.coverUrl}
              alt={song.title}
              className="w-12 h-12 rounded-lg object-cover transition-transform group-hover:scale-105"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
              {isPlaying ? (
                <Pause className="w-5 h-5 text-white" />
              ) : (
                <Play className="w-5 h-5 text-white ml-0.5" />
              )}
            </div>
            {isPlaying && (
              <div className="absolute -bottom-1 -right-1 w-5 h-5">
                <AudioVisualizer isPlaying={true} barCount={3} className="w-full h-full" />
              </div>
            )}
          </div>

          {/* Song Info */}
          <div className="flex-1 min-w-0">
            <p className={cn(
              "font-medium text-sm truncate transition-colors",
              isActive && "text-primary"
            )}>
              {song.title}
            </p>
            <Link
              to={`/artist/${song.artistId}`}
              className="text-xs text-muted-foreground hover:text-primary transition-colors truncate block"
            >
              {song.artist}
            </Link>
          </div>

          {/* Playlist Button */}
          <AnimatedActionButton
            type="playlist"
            onClick={() => setShowPlaylistModal(true)}
            title="Add to playlist"
            className="!p-1.5"
          >
            <ListPlus className="w-4 h-4" />
          </AnimatedActionButton>

          {/* Heart Button */}
          <AnimatedActionButton
            type="like"
            onClick={onToggleFavorite}
            isActive={isFavorite}
            title={isFavorite ? "Remove from favorites" : "Add to favorites"}
            className="!p-1.5"
          >
            <Heart className={cn("w-4 h-4", isFavorite && "fill-current")} />
          </AnimatedActionButton>
        </div>
      </GlassCard>

      <AddToPlaylistModal
        isOpen={showPlaylistModal}
        onClose={() => setShowPlaylistModal(false)}
        songId={song.id}
        songTitle={song.title}
        trackData={{
          title: song.title,
          artist: song.artist,
          artistId: song.artistId || "",
          coverUrl: song.coverUrl,
          audioUrl: song.audioUrl,
          duration: song.duration || 0,
        }}
      />
    </>
  );
}

// Trending Artist Card
function TrendingArtistCard({ artist, rank }: { artist: JioSaavnArtist; rank: number }) {
  const getRankColor = () => {
    if (rank === 1) return "from-yellow-500 to-amber-500";
    if (rank === 2) return "from-slate-400 to-slate-500";
    if (rank === 3) return "from-amber-700 to-amber-800";
    return "from-muted to-muted";
  };

  return (
    <Link to={`/artist/${artist.id}`}>
      <GlassCard className="p-4 text-center group hover:scale-105 transition-all duration-300" hover>
        <div className="relative mx-auto w-20 h-20 mb-3">
          <img
            src={artist.avatarUrl || "/placeholder.svg"}
            alt={artist.name}
            className="w-full h-full rounded-full object-cover border-2 border-primary/20 group-hover:border-primary/50 transition-colors"
          />
          {rank <= 3 && (
            <div className={cn(
              "absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br shadow-lg",
              getRankColor()
            )}>
              {rank}
            </div>
          )}
          <div className="absolute inset-0 rounded-full bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Play className="w-8 h-8 text-white" />
          </div>
        </div>
        <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
          {artist.name}
        </p>
        <p className="text-xs text-muted-foreground">Artist</p>
      </GlassCard>
    </Link>
  );
}

// Trending AlbumCard
function TrendingAlbumCard({ album, rank }: { album: any; rank: number }) {
  const navigate = useNavigate();

  if (!album) {
    return (
      <GlassCard className="p-3 animate-pulse">
        <div className="mb-3 aspect-square rounded-xl bg-muted" />
        <div className="h-4 bg-muted rounded w-3/4 mb-2" />
        <div className="h-3 bg-muted rounded w-1/2" />
      </GlassCard>
    );
  }

  const handleClick = () => {
    navigate(`/album/${album.id}`);
  };

  return (
    <GlassCard className="p-3 group hover:scale-105 transition-all duration-300 cursor-pointer" hover onClick={handleClick}>
      <div className="relative mb-3 aspect-square rounded-xl overflow-hidden">
        <img
          src={album.coverUrl}
          alt={album.title}
          className="w-full h-full object-cover transition-transform group-hover:scale-110"
        />
        {rank <= 3 && (
          <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center text-xs font-bold text-white shadow-lg">
            {rank}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/90 text-primary-foreground text-xs font-medium">
            <ListPlus className="w-3 h-3" /> View Album
          </div>
        </div>
      </div>
      <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
        {album.title}
      </p>
      <p className="text-xs text-muted-foreground truncate">{album.artist}</p>
      <p className="text-xs text-muted-foreground/70">{album.songCount} tracks</p>
    </GlassCard>
  );
}
