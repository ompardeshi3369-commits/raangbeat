import { useState, useEffect, useMemo, useRef } from "react";
import { Navigate, useParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { useMongoFavorites } from "@/hooks/useMongoFavorites";
import { useAudioAnalyzer } from "@/hooks/useAudioAnalyzer";
import { Navbar } from "@/components/layout/Navbar";
import { MainLayout } from "@/components/layout/MainLayout";
import { AddToPlaylistModal } from "@/components/playlist/AddToPlaylistModal";
import { AnimatedActionButton } from "@/components/ui/AnimatedActionButton";
import { artistsApi, songsApi, followsApi, MongoArtist, MongoSong } from "@/lib/mongodb";
import { jiosaavnApi, JioSaavnArtist, JioSaavnTrack } from "@/lib/jiosaavn";
import { motion } from "framer-motion";
import {
  Play,
  Pause,
  Heart,
  UserPlus,
  UserCheck,
  Loader2,
  Share2,
  MoreVertical,
  CheckCircle,
  ListPlus,
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";

// Helper to convert MongoDB song to Track
const mongoSongToTrack = (song: MongoSong, artistName: string): Track => ({
  id: song._id,
  title: song.title,
  artist: artistName,
  artistId: song.artistId,
  coverUrl: song.coverUrl || "",
  audioUrl: song.audioUrl,
  duration: song.duration || 0,
  mood: song.mood,
});

// Helper to convert JioSaavn track to Track
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

// Format duration from seconds to mm:ss
const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Mood-based color themes for the waveform
type MoodType = 'romantic' | 'sad' | 'chill' | 'party' | 'default';

const getMoodColorScheme = (mood: MoodType, progress: number) => {
  switch (mood) {
    case 'romantic':
      // Pink to rose gradient
      return {
        hue: 340 + progress * 30, // 340-370 (pink to rose)
        saturation: 80 + Math.sin(progress * Math.PI) * 15,
        glowColor: 'hsl(350, 85%, 60%)',
      };
    case 'sad':
      // Blue to cyan gradient with sparkle effect
      return {
        hue: 200 + progress * 40, // 200-240 (blue range)
        saturation: 75 + Math.sin(progress * Math.PI) * 20,
        glowColor: 'hsl(220, 80%, 55%)',
      };
    case 'chill':
      // Teal to green gradient
      return {
        hue: 160 + progress * 50, // 160-210 (teal to cyan)
        saturation: 70 + Math.sin(progress * Math.PI) * 15,
        glowColor: 'hsl(180, 70%, 50%)',
      };
    case 'party':
      // Rainbow gradient effect
      return {
        hue: (progress * 360 + Date.now() / 50) % 360, // Animated rainbow
        saturation: 90 + Math.sin(progress * Math.PI) * 10,
        glowColor: `hsl(${(progress * 360) % 360}, 90%, 60%)`,
      };
    default:
      // Default magenta to purple
      return {
        hue: 300 + progress * 60,
        saturation: 85 + Math.sin(progress * Math.PI) * 15,
        glowColor: 'hsl(320, 85%, 55%)',
      };
  }
};

// Audio-reactive waveform bars that respond to real frequencies with mood colors
const AudioReactiveWaveform = ({ isActive, seed, mood }: { isActive: boolean; seed: number; mood?: string }) => {
  const { frequencyData, isConnected } = useAudioAnalyzer(48, isActive);
  const [fallbackBars, setFallbackBars] = useState<number[]>([]);
  const [, forceUpdate] = useState(0);
  const animationRef = useRef<number>();
  const barCount = 48;

  const normalizedMood: MoodType = ['romantic', 'sad', 'chill', 'party'].includes(mood || '')
    ? (mood as MoodType)
    : 'default';

  // Force re-render for party mode animation
  useEffect(() => {
    if (normalizedMood === 'party' && isActive) {
      const interval = setInterval(() => forceUpdate(n => n + 1), 50);
      return () => clearInterval(interval);
    }
  }, [normalizedMood, isActive]);

  // Fallback animation when audio analyzer isn't connected
  useEffect(() => {
    if (isConnected && isActive) return;

    if (!isActive) {
      // Static bars when not playing
      const staticBars = Array.from({ length: barCount }, (_, i) => {
        return ((seed * (i + 1) * 9301 + 49297) % 233280) / 233280 * 35 + 10;
      });
      setFallbackBars(staticBars);
      return;
    }

    // Animated fallback when playing but no audio connection
    let startTime = Date.now();

    const animate = () => {
      const elapsed = (Date.now() - startTime) / 1000;

      const newBars = Array.from({ length: barCount }, (_, i) => {
        const wave1 = Math.sin(elapsed * 3.5 + i * 0.25) * 28;
        const wave2 = Math.sin(elapsed * 2.1 + i * 0.4 + 1.5) * 18;
        const wave3 = Math.sin(elapsed * 4.5 + i * 0.15 + 3) * 12;

        const centerOffset = Math.abs(i - barCount / 2) / (barCount / 2);
        const baseHeight = 50 - centerOffset * 25;

        return Math.max(8, Math.min(95, baseHeight + wave1 + wave2 + wave3));
      });

      setFallbackBars(newBars);
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, isConnected, seed]);

  // Use real frequency data or fallback
  const displayBars = isConnected && isActive ? frequencyData : fallbackBars;

  return (
    <div className="flex items-end justify-center gap-[1.5px] h-10 overflow-hidden px-2">
      {displayBars.map((height, i) => {
        const progress = i / barCount;
        const colorScheme = getMoodColorScheme(normalizedMood, progress);

        let adjustedHue = colorScheme.hue;
        if (adjustedHue > 360) adjustedHue -= 360;
        if (adjustedHue < 0) adjustedHue += 360;

        const { saturation } = colorScheme;
        const lightness = isActive ? 55 : 30;

        // Add some intensity based on height
        const glowIntensity = isActive ? Math.min(height / 100, 1) * 0.8 : 0;

        return (
          <motion.div
            key={i}
            className="rounded-full"
            animate={{
              height: `${Math.max(8, height)}%`,
            }}
            transition={{
              duration: 0.05,
              ease: "linear",
            }}
            style={{
              width: '2.5px',
              minHeight: '8%',
              background: isActive
                ? `linear-gradient(to top, 
                    hsl(${adjustedHue}, ${saturation}%, ${lightness - 10}%), 
                    hsl(${adjustedHue + 20}, ${saturation}%, ${lightness + 15}%))`
                : `hsl(${adjustedHue}, ${saturation * 0.6}%, 25%)`,
              boxShadow: isActive
                ? `0 0 ${4 + glowIntensity * 8}px hsl(${adjustedHue}, ${saturation}%, ${lightness}%),
                   0 0 ${8 + glowIntensity * 16}px hsl(${adjustedHue}, ${saturation}%, ${lightness}%, 0.5)`
                : 'none',
              willChange: 'height',
            }}
          />
        );
      })}
    </div>
  );
};

export default function ArtistProfile() {
  const { id } = useParams<{ id: string }>();
  const { user, isLoading: authLoading } = useAuth();
  const { currentTrack, isPlaying, playTrack, togglePlay, setQueue } = usePlayer();
  const { isFavorite, toggleFavorite } = useMongoFavorites();
  const [artist, setArtist] = useState<MongoArtist | JioSaavnArtist | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [allArtists, setAllArtists] = useState<MongoArtist[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [selectedTrackTitle, setSelectedTrackTitle] = useState<string>("");
  const [isExternalArtist, setIsExternalArtist] = useState(false);
  const [songsPage, setSongsPage] = useState(1);
  const [isLoadingMoreSongs, setIsLoadingMoreSongs] = useState(false);
  const [hasMoreSongs, setHasMoreSongs] = useState(true);

  useEffect(() => {
    if (!id || !user) return;

    const loadArtist = async () => {
      setIsLoading(true);
      const isExternal = id.startsWith("jiosaavn_artist_");
      setIsExternalArtist(isExternal);

      try {
        if (isExternal) {
          // Load from JioSaavn API
          const [artistResult, songsResult] = await Promise.all([
            jiosaavnApi.getArtist(id),
            jiosaavnApi.getArtistSongs(id),
          ]);

          setArtist(artistResult);
          const artistTracks = (songsResult?.songs || []).map(jiosaavnToTrack);
          setTracks(artistTracks);
          setSongsPage(1);
          setHasMoreSongs(artistTracks.length >= 10);

          // For external artists, we can't show "similar artists" from MongoDB
          setAllArtists([]);

          // Check if following from MongoDB
          const { isFollowing: followStatus } = await followsApi.check(user.id, id);
          setIsFollowing(followStatus);
        } else {
          // Load from MongoDB
          const { artist: artistData } = await artistsApi.getById(id);
          setArtist(artistData);

          const { artists: allArtistsData } = await artistsApi.getAll();
          setAllArtists((allArtistsData || []).filter(a => a._id !== id));

          if (artistData) {
            const { songs: songsData } = await songsApi.getByArtist(id);
            const artistTracks = (songsData || []).map((song) =>
              mongoSongToTrack(song, artistData.name)
            );
            setTracks(artistTracks);

            const { isFollowing: followStatus } = await followsApi.check(user.id, id);
            setIsFollowing(followStatus);
          }
        }
      } catch (error) {
        console.error("Error loading artist:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadArtist();
  }, [id, user]);

  const toggleFollow = async () => {
    if (!user || !id) return;

    const wasFollowing = isFollowing;
    setIsFollowing(!isFollowing);

    try {
      if (wasFollowing) {
        await followsApi.unfollow(user.id, id);
      } else {
        await followsApi.follow(user.id, id);
      }
    } catch (error) {
      setIsFollowing(wasFollowing);
      console.error("Error toggling follow:", error);
    }
  };

  const playAll = () => {
    if (tracks.length > 0) {
      setQueue(tracks);
      playTrack(tracks[0]);
    }
  };

  const openPlaylistModal = (track: Track, trackTitle: string) => {
    setSelectedTrack(track);
    setSelectedTrackTitle(trackTitle);
    setShowPlaylistModal(true);
  };

  const loadMoreSongs = async () => {
    if (!id || !isExternalArtist || isLoadingMoreSongs) return;
    setIsLoadingMoreSongs(true);
    try {
      const nextPage = songsPage + 1;
      const result = await jiosaavnApi.getArtistSongs(id, nextPage);
      const newTracks = (result?.songs || []).map(jiosaavnToTrack);
      if (newTracks.length > 0) {
        setTracks(prev => {
          const existingIds = new Set(prev.map(t => t.id));
          const unique = newTracks.filter(t => !existingIds.has(t.id));
          return [...prev, ...unique];
        });
        setSongsPage(nextPage);
        setHasMoreSongs(newTracks.length >= 10);
      } else {
        setHasMoreSongs(false);
      }
    } catch (error) {
      console.error("Error loading more songs:", error);
    } finally {
      setIsLoadingMoreSongs(false);
    }
  };

  // Memoize random stats based on artist ID to prevent flickering
  const artistStats = useMemo(() => {
    const hash = (id || '').split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    const absHash = Math.abs(hash);
    return {
      monthlyListeners: ((absHash % 900) + 100),
      followers: ((absHash % 20) / 10 + 0.5).toFixed(1),
      totalStreams: ((absHash % 500) + 50),
    };
  }, [id]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!artist) return <Navigate to="/artists" replace />;

  const similarArtists = isExternalArtist ? [] : allArtists.slice(0, 3);
  const artistName = isExternalArtist ? (artist as JioSaavnArtist).name : (artist as MongoArtist).name;
  const artistAvatarUrl = isExternalArtist
    ? (artist as JioSaavnArtist).avatarUrl
    : (artist as MongoArtist).avatarUrl;
  const artistCoverUrl = isExternalArtist
    ? (artist as JioSaavnArtist).avatarUrl
    : ((artist as MongoArtist).coverUrl || (artist as MongoArtist).avatarUrl);
  const rawBio = isExternalArtist
    ? (artist as JioSaavnArtist).bio
    : (artist as MongoArtist).bio;
  // Ensure bio is a string (JioSaavn sometimes returns objects)
  const artistBio = typeof rawBio === 'string' ? rawBio : (rawBio ? String(rawBio) : null);

  return (
    <MainLayout>
      <div className="min-h-screen pb-32 bg-background relative overflow-hidden">
        {/* Animated background particles */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-primary/30 rounded-full"
              animate={{
                x: [Math.random() * window.innerWidth, Math.random() * window.innerWidth],
                y: [Math.random() * window.innerHeight, Math.random() * window.innerHeight],
                opacity: [0.2, 0.6, 0.2],
              }}
              transition={{
                duration: Math.random() * 20 + 10,
                repeat: Infinity,
                ease: "linear",
              }}
              style={{
                left: Math.random() * 100 + '%',
                top: Math.random() * 100 + '%',
              }}
            />
          ))}
        </div>

        <Navbar />

        {/* Hero Banner with Full Cover Image */}
        <div className="relative h-[400px] md:h-[480px] overflow-hidden">
          {/* Cover Image */}
          <motion.img
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8 }}
            src={artistCoverUrl || "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&h=600&fit=crop"}
            alt={artistName}
            className="w-full h-full object-cover object-top"
          />

          {/* Gradient overlays */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-background/60" />

          {/* Glowing orbs */}
          <div className="absolute bottom-20 left-1/4 w-64 h-64 bg-primary/20 rounded-full blur-[100px] animate-pulse" />
          <div className="absolute top-20 right-1/4 w-48 h-48 bg-accent/20 rounded-full blur-[80px] animate-pulse" />

          {/* Artist Info Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
            <div className="max-w-7xl mx-auto flex items-end gap-6 md:gap-8">
              {/* Avatar */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="relative"
              >
                <div className="w-28 h-28 md:w-40 md:h-40 rounded-full p-1 bg-gradient-to-br from-primary via-accent to-primary">
                  <img
                    src={artistAvatarUrl || "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop"}
                    alt={artistName}
                    className="w-full h-full rounded-full object-cover border-4 border-background"
                  />
                </div>
              </motion.div>

              {/* Name and Genre */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="flex-1"
              >
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-3xl md:text-5xl lg:text-6xl font-orbitron font-bold text-foreground">
                    {artistName}
                  </h1>
                  <CheckCircle className="w-6 h-6 md:w-8 md:h-8 text-primary fill-primary/20" />
                </div>
                <p className="text-muted-foreground text-sm md:text-base">
                  Bollywood / Indian Pop
                </p>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="max-w-7xl mx-auto px-4 md:px-10 py-6">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="flex items-center gap-4 flex-wrap"
          >
            {/* Following Button */}
            <Button
              onClick={toggleFollow}
              variant={isFollowing ? "default" : "outline"}
              className={`rounded-full px-6 py-3 h-auto flex items-center gap-2 transition-all ${isFollowing
                ? 'bg-primary/20 hover:bg-primary/30 text-primary border-primary'
                : 'border-muted-foreground/30 hover:border-primary hover:text-primary'
                }`}
            >
              {isFollowing ? (
                <>
                  <UserCheck className="w-5 h-5" />
                  Following
                  <ChevronDown className="w-4 h-4 ml-1" />
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  Follow
                </>
              )}
            </Button>

            {/* Share Button */}
            <Button
              variant="outline"
              className="rounded-full px-6 py-3 h-auto flex items-center gap-2 border-muted-foreground/30 hover:border-primary hover:text-primary transition-all"
            >
              <Share2 className="w-5 h-5" />
              Share
            </Button>
          </motion.div>

          {/* Stats Row */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="flex items-center gap-6 md:gap-10 mt-6 flex-wrap"
          >
            <div className="text-center">
              <p className="text-xl md:text-2xl font-bold text-foreground">
                {artistStats.monthlyListeners}K
              </p>
              <p className="text-xs text-muted-foreground">Monthly Listeners</p>
            </div>
            <div className="text-center">
              <p className="text-xl md:text-2xl font-bold text-foreground">
                {artistStats.followers}M
              </p>
              <p className="text-xs text-muted-foreground">Followers</p>
            </div>
            <div className="text-center">
              <p className="text-xl md:text-2xl font-bold text-foreground">
                {artistStats.totalStreams}M
              </p>
              <p className="text-xs text-muted-foreground">Total Streams</p>
            </div>
            <div className="text-center flex items-center gap-2">
              <span className="text-lg">🇮🇳</span>
              <div>
                <p className="text-sm font-semibold text-foreground">India</p>
                <p className="text-xs text-muted-foreground">Top Country</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Main Content Grid */}
        <div className="max-w-7xl mx-auto px-4 md:px-10 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Top Tracks Section */}
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="lg:col-span-2"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl md:text-2xl font-orbitron font-bold text-foreground">
                  Top Tracks
                </h2>
                <Button
                  onClick={playAll}
                  disabled={tracks.length === 0}
                  className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground px-6"
                >
                  <Play className="w-4 h-4 mr-2 fill-current" />
                  Play All
                </Button>
              </div>

              <div className="space-y-2">
                {tracks.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>No tracks from this artist yet.</p>
                  </div>
                ) : (
                  tracks.map((track, index) => {
                    const isActive = currentTrack?.id === track.id;
                    // Use track ID hash to generate consistent year
                    const trackHash = track.id.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0);
                    const year = 2020 + (Math.abs(trackHash) % 6);
                    const isNew = year === 2025;

                    return (
                      <motion.div
                        key={track.id}
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.1 * index, duration: 0.3 }}
                        className={`group flex items-center gap-4 p-3 rounded-xl transition-all cursor-pointer ${isActive
                          ? 'bg-primary/10 border border-primary/30'
                          : 'hover:bg-muted/50 border border-transparent hover:border-muted'
                          }`}
                      >
                        {/* Track Cover */}
                        <div
                          className="relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0"
                          onClick={() => { if (isActive) { togglePlay(); } else { setQueue(tracks); playTrack(track); } }}
                        >
                          <img
                            src={track.coverUrl || "/placeholder.svg"}
                            alt={track.title}
                            className="w-full h-full object-cover"
                          />
                          <div className={`absolute inset-0 flex items-center justify-center bg-black/50 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                            }`}>
                            {isActive && isPlaying ? (
                              <Pause className="w-6 h-6 text-white" />
                            ) : (
                              <Play className="w-6 h-6 text-white fill-white" />
                            )}
                          </div>
                        </div>

                        {/* Track Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={`font-medium truncate ${isActive ? 'text-primary' : 'text-foreground'}`}>
                              {track.title}
                            </p>
                            {isNew && (
                              <span className="px-2 py-0.5 text-[10px] font-bold bg-accent text-accent-foreground rounded-full">
                                NEW
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{year}</p>
                        </div>

                        {/* Audio-reactive Waveform with mood-based colors */}
                        <div className="hidden md:flex flex-1 justify-center">
                          <AudioReactiveWaveform
                            isActive={isActive && isPlaying}
                            seed={index + 1}
                            mood={currentTrack?.mood}
                          />
                        </div>

                        {/* Play Button */}
                        <button
                          onClick={() => (isActive ? togglePlay() : playTrack(track))}
                          className={`p-2 rounded-full transition-colors ${isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted/50 text-muted-foreground hover:bg-primary/20 hover:text-primary'
                            }`}
                        >
                          {isActive && isPlaying ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4 fill-current" />
                          )}
                        </button>

                        {/* Duration */}
                        <span className="text-sm text-muted-foreground w-12 text-right">
                          {formatDuration(track.duration || 180)}
                        </span>

                        {/* Favorite Button */}
                        <AnimatedActionButton
                          type="like"
                          onClick={() => toggleFavorite(track.id, track)}
                          isActive={isFavorite(track.id)}
                          title={isFavorite(track.id) ? "Remove from favorites" : "Add to favorites"}
                        >
                          <Heart className={`w-5 h-5 ${isFavorite(track.id) ? 'fill-current' : ''}`} />
                        </AnimatedActionButton>

                        {/* Add to Playlist */}
                        <AnimatedActionButton
                          type="playlist"
                          onClick={() => openPlaylistModal(track, track.title)}
                          title="Add to playlist"
                        >
                          <ListPlus className="w-5 h-5" />
                        </AnimatedActionButton>
                      </motion.div>
                    );
                  })
                )}
              </div>

              {/* Load More Songs Button */}
              {isExternalArtist && hasMoreSongs && tracks.length > 0 && (
                <div className="flex justify-center mt-6">
                  <button
                    onClick={loadMoreSongs}
                    disabled={isLoadingMoreSongs}
                    className="flex items-center gap-2 px-8 py-3 rounded-xl bg-card border border-border/50 hover:border-primary/30 hover:bg-card/80 transition-all font-medium text-sm"
                  >
                    {isLoadingMoreSongs ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading more songs...
                      </>
                    ) : (
                      "Load More Songs"
                    )}
                  </button>
                </div>
              )}
            </motion.div>

            {/* Right Sidebar */}
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.5 }}
              className="space-y-8"
            >
              {/* Related Artists / Albums */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-orbitron font-semibold text-foreground">
                    Related Artists
                  </h3>
                  <Link to="/artists" className="text-sm text-primary hover:underline">
                    See all →
                  </Link>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {similarArtists.map((relatedArtist) => (
                    <Link key={relatedArtist._id} to={`/artist/${relatedArtist._id}`}>
                      <div className="group text-center">
                        <div className="relative aspect-square rounded-xl overflow-hidden mb-2">
                          <img
                            src={relatedArtist.avatarUrl || "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=150&h=150&fit=crop"}
                            alt={relatedArtist.name}
                            className="w-full h-full object-cover transition-transform group-hover:scale-110"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <p className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">
                          {relatedArtist.name}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* About Artist */}
              <div className="bg-muted/30 rounded-2xl p-5 border border-muted">
                <h3 className="text-lg font-orbitron font-semibold text-foreground mb-3">
                  About
                </h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Genre:</span>{" "}
                    <span className="text-foreground">Bollywood / Indian Pop</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Hometown:</span>{" "}
                    <span className="text-foreground">Mumbai, India</span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed pt-2">
                    {artistBio || "One of the most celebrated artists in Indian music, known for soulful melodies and chart-topping hits that have defined Bollywood soundtracks."}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {selectedTrack && (
          <AddToPlaylistModal
            isOpen={showPlaylistModal}
            onClose={() => setShowPlaylistModal(false)}
            songId={selectedTrack.id}
            songTitle={selectedTrackTitle}
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
      </div>
    </MainLayout>
  );
}
