import { useState, useEffect } from "react";
import { Navigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { useMongoFavorites } from "@/hooks/useMongoFavorites";
import { useMongoPlaylists } from "@/hooks/useMongoPlaylists";
import { useMongoRecentlyPlayed } from "@/hooks/useMongoRecentlyPlayed";
import { MainLayout } from "@/components/layout/MainLayout";
import { GlassCard } from "@/components/ui/GlassCard";
import { NeonButton } from "@/components/ui/NeonButton";
import { ParticleBackground } from "@/components/effects/ParticleBackground";
import { AddToPlaylistModal } from "@/components/playlist/AddToPlaylistModal";
import { songsApi, MongoSong, MongoPlaylist } from "@/lib/mongodb";
import { useToast } from "@/hooks/use-toast";
import { AnimatedActionButton } from "@/components/ui/AnimatedActionButton";
import { Heart, Clock, ListMusic, Play, Pause, Loader2, Plus, Trash2, ListPlus } from "lucide-react";

// Helper to convert MongoDB song to Track
const mongoSongToTrack = (song: MongoSong): Track => ({
  id: song._id,
  title: song.title,
  artist: song.artistName,
  artistId: song.artistId,
  coverUrl: song.coverUrl || "",
  audioUrl: song.audioUrl,
  duration: song.duration || 0,
  mood: song.mood,
});

// Helper to convert playlist metadata to Track
const metadataToTrack = (songId: string, metadata: MongoPlaylist["songMetadata"]): Track | null => {
  // Try both the raw key and the dot-replaced key (MongoDB uses _ instead of .)
  const meta = metadata?.[songId] || metadata?.[songId.replace(/\./g, "_")];
  if (!meta) return null;
  return {
    id: songId,
    title: meta.title,
    artist: meta.artist,
    artistId: meta.artistId,
    coverUrl: meta.coverUrl,
    audioUrl: meta.audioUrl,
    duration: meta.duration,
  };
};

// Track row component for favorites and recently played
function TrackRow({ track }: { track: Track }) {
  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayer();
  const { isFavorite, toggleFavorite } = useMongoFavorites();
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const isActive = currentTrack?.id === track.id;

  return (
    <>
      <GlassCard className="p-4 flex items-center gap-4" hover>
        <div className="relative group cursor-pointer" onClick={() => isActive ? togglePlay() : playTrack(track)}>
          <img src={track.coverUrl} alt={track.title} className="w-14 h-14 rounded-lg object-cover" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
            {isActive && isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-medium truncate ${isActive ? "text-primary" : ""}`}>{track.title}</p>
          <Link to={`/artist/${track.artistId}`} className="text-sm text-muted-foreground hover:text-primary truncate block">
            {track.artist}
          </Link>
        </div>
        <AnimatedActionButton
          type="playlist"
          onClick={() => setShowPlaylistModal(true)}
          title="Add to playlist"
        >
          <ListPlus className="w-5 h-5" />
        </AnimatedActionButton>
        <AnimatedActionButton
          type="like"
          onClick={() => toggleFavorite(track.id, track)}
          isActive={isFavorite(track.id)}
          title={isFavorite(track.id) ? "Remove from favorites" : "Add to favorites"}
        >
          <Heart className={`w-5 h-5 ${isFavorite(track.id) ? "fill-current" : ""}`} />
        </AnimatedActionButton>
      </GlassCard>

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

// Track row component for playlist songs with remove button
function PlaylistTrackRow({ track, onRemove }: { track: Track; onRemove: () => void }) {
  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayer();
  const { isFavorite, toggleFavorite } = useMongoFavorites();
  const isActive = currentTrack?.id === track.id;

  return (
    <GlassCard className="p-4 flex items-center gap-4" hover>
      <div className="relative group cursor-pointer" onClick={() => isActive ? togglePlay() : playTrack(track)}>
        <img src={track.coverUrl} alt={track.title} className="w-14 h-14 rounded-lg object-cover" />
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
          {isActive && isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-medium truncate ${isActive ? "text-primary" : ""}`}>{track.title}</p>
        <Link to={`/artist/${track.artistId}`} className="text-sm text-muted-foreground hover:text-primary truncate block">
          {track.artist}
        </Link>
      </div>
      <AnimatedActionButton
        type="like"
        onClick={() => toggleFavorite(track.id, track)}
        isActive={isFavorite(track.id)}
        title={isFavorite(track.id) ? "Remove from favorites" : "Add to favorites"}
      >
        <Heart className={`w-5 h-5 ${isFavorite(track.id) ? "fill-current" : ""}`} />
      </AnimatedActionButton>
      <button
        onClick={onRemove}
        className="p-2 rounded-full text-muted-foreground hover:text-destructive transition-colors"
        title="Remove from playlist"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </GlassCard>
  );
}

export default function Library() {
  const { user, isLoading: authLoading } = useAuth();
  const { currentTrack, isPlaying, playTrack, togglePlay, queue } = usePlayer();
  const { favorites, isFavorite, toggleFavorite, favoriteMetadata, getFavoriteMetadata } = useMongoFavorites();
  const { playlists, isLoading: playlistsLoading, createPlaylist, deletePlaylist, removeSongFromPlaylist } = useMongoPlaylists();
  const { history, isLoading: historyLoading } = useMongoRecentlyPlayed();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Read tab from URL, default to "favorites"
  const tabParam = searchParams.get("tab");
  const activeTab = (tabParam === "recent" || tabParam === "playlists") ? tabParam : "favorites";
  
  const setActiveTab = (tab: "favorites" | "recent" | "playlists") => {
    setSearchParams({ tab });
  };
  
  const [recentlyPlayedTracks, setRecentlyPlayedTracks] = useState<Track[]>([]);
  const [favoriteTracks, setFavoriteTracks] = useState<Track[]>([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(true);
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>([]);
  const [isLoadingPlaylistTracks, setIsLoadingPlaylistTracks] = useState(false);

  // Load favorite tracks - handle both local and external songs
  useEffect(() => {
    const loadFavoriteTracks = async () => {
      if (favorites.size === 0) {
        setFavoriteTracks([]);
        return;
      }

      try {
        const songIds = Array.from(favorites);
        const tracks: Track[] = [];
        
        for (const songId of songIds) {
          // Check if it's an external song with stored metadata
          if (songId.startsWith("jiosaavn_")) {
            const favMeta = getFavoriteMetadata(songId);
            if (favMeta?.metadata) {
              tracks.push({
                id: songId,
                title: favMeta.metadata.title,
                artist: favMeta.metadata.artist,
                artistId: favMeta.metadata.artistId,
                coverUrl: favMeta.metadata.coverUrl,
                audioUrl: favMeta.metadata.audioUrl,
                duration: favMeta.metadata.duration,
              });
            }
          } else {
            // Skip fetching from MongoDB for jiosaavn songs without metadata
            if (songId.startsWith("jiosaavn_")) continue;
            // Local song - fetch from MongoDB
            try {
              const { song } = await songsApi.getById(songId);
              if (song) {
                tracks.push(mongoSongToTrack(song));
              }
            } catch (err) {
              console.error(`Error fetching song ${songId}:`, err);
            }
          }
        }
        
        setFavoriteTracks(tracks);
      } catch (error) {
        console.error("Error loading favorite tracks:", error);
      }
    };

    loadFavoriteTracks();
  }, [favorites, favoriteMetadata, getFavoriteMetadata]);

  // Load recently played tracks - handle both local and external songs
  useEffect(() => {
    const loadRecentTracks = async () => {
      if (history.length === 0) {
        setRecentlyPlayedTracks([]);
        setIsLoadingTracks(false);
        return;
      }

      setIsLoadingTracks(true);
      try {
        const tracks: Track[] = [];
        const seenIds = new Set<string>();
        
        for (const item of history) {
          if (seenIds.has(item.songId)) continue;
          seenIds.add(item.songId);
          
          // Check if it's an external song with stored metadata
          if (item.songId.startsWith("jiosaavn_")) {
            // First check if we have metadata in the recently played item
            if (item.metadata) {
              tracks.push({
                id: item.songId,
                title: item.metadata.title,
                artist: item.metadata.artist,
                artistId: item.metadata.artistId,
                coverUrl: item.metadata.coverUrl,
                audioUrl: item.metadata.audioUrl,
                duration: item.metadata.duration,
              });
              continue;
            }
            // Fallback to favorites metadata
            const favMeta = getFavoriteMetadata(item.songId);
            if (favMeta?.metadata) {
              tracks.push({
                id: item.songId,
                title: favMeta.metadata.title,
                artist: favMeta.metadata.artist,
                artistId: favMeta.metadata.artistId,
                coverUrl: favMeta.metadata.coverUrl,
                audioUrl: favMeta.metadata.audioUrl,
                duration: favMeta.metadata.duration,
              });
            }
            continue;
          }
          
          // Skip jiosaavn songs without metadata
          if (item.songId.startsWith("jiosaavn_")) continue;
          try {
            const { song } = await songsApi.getById(item.songId);
            if (song) {
              tracks.push(mongoSongToTrack(song));
            }
          } catch (err) {
            console.error(`Error fetching song ${item.songId}:`, err);
          }
        }
        
        setRecentlyPlayedTracks(tracks);
      } catch (error) {
        console.error("Error loading recent tracks:", error);
      } finally {
        setIsLoadingTracks(false);
      }
    };

    loadRecentTracks();
  }, [history, getFavoriteMetadata]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const handleCreatePlaylist = async () => {
    const rawName = prompt("Enter playlist name:");
    if (!rawName) return;

    const name = rawName.trim();

    if (name.length === 0) {
      toast({
        title: "Error",
        description: "Playlist name cannot be empty",
        variant: "destructive",
      });
      return;
    }

    if (name.length > 100) {
      toast({
        title: "Error",
        description: "Playlist name must be under 100 characters",
        variant: "destructive",
      });
      return;
    }

    const playlistId = await createPlaylist(name);
    if (playlistId) {
      toast({
        title: "Success",
        description: "Playlist created successfully",
      });
    } else {
      toast({
        title: "Error",
        description: "Failed to create playlist",
        variant: "destructive",
      });
    }
  };

  const handleDeletePlaylist = async (playlistId: string) => {
    if (!confirm("Delete this playlist?")) return;
    await deletePlaylist(playlistId);
    if (selectedPlaylist === playlistId) {
      setSelectedPlaylist(null);
      setPlaylistTracks([]);
    }
  };

  const handleSelectPlaylist = async (playlistId: string) => {
    if (selectedPlaylist === playlistId) {
      setSelectedPlaylist(null);
      setPlaylistTracks([]);
      return;
    }

    const playlist = playlists.find(p => p._id === playlistId);
    if (!playlist || !playlist.songs?.length) {
      setSelectedPlaylist(playlistId);
      setPlaylistTracks([]);
      return;
    }

    setSelectedPlaylist(playlistId);
    setIsLoadingPlaylistTracks(true);

    try {
      const tracks: Track[] = [];
      for (const songId of playlist.songs) {
        // Check if it's an external song with stored metadata
        if (songId.startsWith("jiosaavn_")) {
          const track = metadataToTrack(songId, playlist.songMetadata);
          if (track) {
            tracks.push(track);
            continue;
          }
        }
        
        // Skip non-MongoDB IDs that failed metadata lookup
        if (songId.startsWith("jiosaavn_")) continue;
        
        // Local song - fetch from MongoDB
        try {
          const { song } = await songsApi.getById(songId);
          if (song) {
            tracks.push(mongoSongToTrack(song));
          }
        } catch (err) {
          console.error(`Error fetching song ${songId}:`, err);
        }
      }
      setPlaylistTracks(tracks);
    } catch (error) {
      console.error("Error loading playlist tracks:", error);
    } finally {
      setIsLoadingPlaylistTracks(false);
    }
  };

  const handlePlayPlaylist = () => {
    if (playlistTracks.length > 0) {
      playTrack(playlistTracks[0]);
    }
  };

  const handleRemoveFromPlaylist = async (songId: string) => {
    if (!selectedPlaylist) return;
    await removeSongFromPlaylist(selectedPlaylist, songId);
    setPlaylistTracks(prev => prev.filter(t => t.id !== songId));
  };

  const selectedPlaylistData = playlists.find(p => p._id === selectedPlaylist);

  const isLoading = playlistsLoading || historyLoading || isLoadingTracks;

  return (
    <MainLayout>
      <div className="min-h-screen pb-32 relative">
        <ParticleBackground particleCount={20} />

        <main className="max-w-7xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-orbitron font-bold mb-8 gradient-text">Your Library</h1>

          {/* Tabs */}
          <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
            {[
              { id: "favorites", label: "Favorites", icon: Heart, count: favoriteTracks.length },
              { id: "recent", label: "Recently Played", icon: Clock, count: recentlyPlayedTracks.length },
              { id: "playlists", label: "Playlists", icon: ListMusic, count: playlists.length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as "favorites" | "recent" | "playlists")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                <span className="ml-1 text-xs opacity-70">({tab.count})</span>
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : (
            <>
              {/* Favorites */}
              {activeTab === "favorites" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {favoriteTracks.length === 0 ? (
                    <p className="text-muted-foreground col-span-full text-center py-12">
                      No favorites yet. Heart some songs to see them here!
                    </p>
                  ) : (
                    favoriteTracks.map((track) => (
                      <TrackRow key={track.id} track={track} />
                    ))
                  )}
                </div>
              )}

              {/* Recently Played */}
              {activeTab === "recent" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {recentlyPlayedTracks.length === 0 ? (
                    <p className="text-muted-foreground col-span-full text-center py-12">
                      Start listening to build your history!
                    </p>
                  ) : (
                    recentlyPlayedTracks.map((track) => (
                      <TrackRow key={track.id} track={track} />
                    ))
                  )}
                </div>
              )}

              {/* Playlists */}
              {activeTab === "playlists" && (
                <div>
                  <NeonButton onClick={handleCreatePlaylist} className="mb-6">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Playlist
                  </NeonButton>
                  
                  {/* Playlist List */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                    {playlists.length === 0 ? (
                      <p className="text-muted-foreground col-span-full text-center py-12">
                        No playlists yet. Create one to get started!
                      </p>
                    ) : (
                      playlists.map((playlist) => (
                        <GlassCard 
                          key={playlist._id} 
                          className={`p-4 flex items-center gap-4 ${selectedPlaylist === playlist._id ? "border-primary/50 bg-primary/10" : ""}`} 
                          hover
                          onClick={() => handleSelectPlaylist(playlist._id)}
                        >
                          <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                            <ListMusic className="w-8 h-8 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{playlist.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {playlist.songs?.length || 0} songs
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePlaylist(playlist._id);
                            }}
                            className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </GlassCard>
                      ))
                    )}
                  </div>

                  {/* Selected Playlist Songs */}
                  {selectedPlaylist && selectedPlaylistData && (
                    <div className="mt-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xl font-semibold flex items-center gap-2">
                          <ListMusic className="w-5 h-5 text-primary" />
                          {selectedPlaylistData.name}
                        </h3>
                        {playlistTracks.length > 0 && (
                          <NeonButton onClick={handlePlayPlaylist} size="sm">
                            <Play className="w-4 h-4 mr-2" />
                            Play All
                          </NeonButton>
                        )}
                      </div>
                      
                      {isLoadingPlaylistTracks ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-8 h-8 text-primary animate-spin" />
                        </div>
                      ) : playlistTracks.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">
                          No songs in this playlist yet. Add songs using the playlist button on any track!
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {playlistTracks.map((track) => (
                            <PlaylistTrackRow 
                              key={track.id} 
                              track={track} 
                              onRemove={() => handleRemoveFromPlaylist(track.id)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </MainLayout>
  );
}
