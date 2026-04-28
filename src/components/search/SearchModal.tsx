import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, Play, User, Music, X, Globe, Loader2, Heart, ListPlus, Disc } from "lucide-react";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { jiosaavnApi, JioSaavnTrack, JioSaavnArtist } from "@/lib/jiosaavn";
import { songsApi, artistsApi } from "@/lib/mongodb";
import { useMongoFavorites } from "@/hooks/useMongoFavorites";
import { AddToPlaylistModal } from "@/components/playlist/AddToPlaylistModal";

interface LocalArtist {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Convert JioSaavn track to player Track format
// Note: audioUrl might be empty from search results, PlayerContext will fetch it
const jiosaavnToTrack = (song: JioSaavnTrack): Track => ({
  id: song.id,
  title: song.title,
  artist: song.artist,
  artistId: song.artistId,
  coverUrl: song.coverUrl,
  audioUrl: song.audioUrl || "", // May be empty, PlayerContext handles this
  duration: song.duration,
  mood: undefined,
});

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [localSongs, setLocalSongs] = useState<Track[]>([]);
  const [localArtists, setLocalArtists] = useState<LocalArtist[]>([]);
  const [discoverSongs, setDiscoverSongs] = useState<JioSaavnTrack[]>([]);
  const [discoverArtists, setDiscoverArtists] = useState<JioSaavnArtist[]>([]);
  const [discoverAlbums, setDiscoverAlbums] = useState<any[]>([]);
  const [isSearchingLocal, setIsSearchingLocal] = useState(false);
  const [isSearchingDiscover, setIsSearchingDiscover] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "library" | "discover">("all");
  const { playTrack } = usePlayer();
  const { isFavorite, toggleFavorite } = useMongoFavorites();
  const [playlistSong, setPlaylistSong] = useState<{ id: string; title: string; trackData?: any } | null>(null);

  const searchLocal = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setLocalSongs([]);
      setLocalArtists([]);
      return;
    }

    setIsSearchingLocal(true);
    try {
      // Search local MongoDB songs
      const { songs } = await songsApi.search(searchQuery, 5);
      const tracks: Track[] = (songs || []).map((song: any) => ({
        id: song._id,
        title: song.title,
        artist: song.artistName,
        artistId: song.artistId,
        coverUrl: song.coverUrl || "",
        audioUrl: song.audioUrl,
        duration: song.duration || 0,
        mood: song.mood,
      }));
      setLocalSongs(tracks);

      // Search local artists
      const { artists } = await artistsApi.search(searchQuery, 5);
      setLocalArtists(artists?.map((a: any) => ({
        id: a._id,
        name: a.name,
        avatar_url: a.avatarUrl
      })) || []);
    } catch (error) {
      console.error("Local search error:", error);
    } finally {
      setIsSearchingLocal(false);
    }
  }, []);

  const searchDiscover = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setDiscoverSongs([]);
      setDiscoverArtists([]);
      return;
    }

    setIsSearchingDiscover(true);
    try {
      const result = await jiosaavnApi.searchAll(searchQuery);
      setDiscoverSongs(result.songs?.slice(0, 8) || []);
      setDiscoverArtists(result.artists?.slice(0, 4) || []);
      // Extract albums from searchAll result (was already returned, just never used!)
      setDiscoverAlbums(
        (result.albums || []).slice(0, 6).map((a: any) => ({
          id: `jiosaavn_album_${a.id}`,
          title: a.title || a.name,
          artist: a.primaryArtists || a.artist || "Various Artists",
          coverUrl: a.image?.[a.image?.length - 1]?.url || a.image?.[1]?.url || "",
          year: a.year,
          songCount: a.songCount,
        }))
      );
    } catch (error) {
      console.error("Discover search error:", error);
    } finally {
      setIsSearchingDiscover(false);
    }
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      searchLocal(query);
      searchDiscover(query);
    }, 300);
    return () => clearTimeout(debounce);
  }, [query, searchLocal, searchDiscover]);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setLocalSongs([]);
      setLocalArtists([]);
      setDiscoverSongs([]);
      setDiscoverArtists([]);
      setDiscoverAlbums([]);
      setActiveTab("all");
    }
  }, [isOpen]);

  const handlePlayLocalSong = (track: Track) => {
    playTrack(track);
    onClose();
  };

  const handlePlayDiscoverSong = (song: JioSaavnTrack) => {
    playTrack(jiosaavnToTrack(song));
    onClose();
  };

  const isSearching = isSearchingLocal || isSearchingDiscover;
  const hasLocalResults = localSongs.length > 0 || localArtists.length > 0;
  const hasDiscoverResults = discoverSongs.length > 0 || discoverArtists.length > 0 || discoverAlbums.length > 0;
  const hasAnyResults = hasLocalResults || hasDiscoverResults;

  const showLibrary = activeTab === "all" || activeTab === "library";
  const showDiscover = activeTab === "all" || activeTab === "discover";

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-2xl glass-card border-border/50 p-0 overflow-hidden max-h-[85vh]">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="gradient-text text-xl">Search</DialogTitle>
          </DialogHeader>

          <div className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Search songs, artists..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-10 pr-10 bg-muted/50 border-border/50 focus:border-primary"
                autoFocus
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Tabs */}
            {query.trim() && (
              <div className="flex gap-2 mt-3">
                {["all", "library", "discover"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab as typeof activeTab)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                      activeTab === tab
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/50 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab === "all" ? "All" : tab === "library" ? "Your Library" : "Discover"}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="overflow-y-auto px-4 pb-4 max-h-[60vh]">
            {isSearching && !hasAnyResults ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : query.trim() ? (
              <>
                {/* Your Library Section */}
                {showLibrary && hasLocalResults && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Music className="w-4 h-4 text-primary" /> Your Library
                    </h3>

                    {/* Local Artists */}
                    {localArtists.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs text-muted-foreground mb-2 px-1">Artists</p>
                        <div className="space-y-1">
                          {localArtists.map((artist) => (
                            <Link
                              key={artist.id}
                              to={`/artist/${artist.id}`}
                              onClick={onClose}
                              className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors group"
                            >
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center overflow-hidden">
                                {artist.avatar_url ? (
                                  <img src={artist.avatar_url} alt={artist.name} className="w-full h-full object-cover" />
                                ) : (
                                  <User className="w-5 h-5 text-primary-foreground" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium group-hover:text-primary transition-colors">{artist.name}</p>
                                <p className="text-xs text-muted-foreground">Artist</p>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Local Songs */}
                    {localSongs.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2 px-1">Songs</p>
                        <div className="space-y-1">
                          {localSongs.map((song) => (
                            <div
                              key={song.id}
                              className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors w-full text-left group"
                            >
                              <button
                                onClick={() => handlePlayLocalSong(song)}
                                className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0"
                              >
                                <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Play className="w-4 h-4 text-white" />
                                </div>
                              </button>
                              <button
                                onClick={() => handlePlayLocalSong(song)}
                                className="flex-1 min-w-0 text-left"
                              >
                                <p className="font-medium truncate group-hover:text-primary transition-colors">{song.title}</p>
                                <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                              </button>
                              {song.mood && (
                                <span className={cn(
                                  "text-xs px-2 py-0.5 rounded-full flex-shrink-0",
                                  song.mood === "romantic" && "bg-pink-500/20 text-pink-400",
                                  song.mood === "sad" && "bg-blue-500/20 text-blue-400",
                                  song.mood === "chill" && "bg-green-500/20 text-green-400",
                                  song.mood === "party" && "bg-purple-500/20 text-purple-400"
                                )}>
                                  {song.mood}
                                </span>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFavorite(song.id, song);
                                }}
                                className="p-1.5 rounded-full hover:bg-muted transition-colors flex-shrink-0"
                                title={isFavorite(song.id) ? "Remove from favorites" : "Add to favorites"}
                              >
                                <Heart className={cn(
                                  "w-4 h-4 transition-colors",
                                  isFavorite(song.id) ? "fill-red-500 text-red-500" : "text-muted-foreground hover:text-red-400"
                                )} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPlaylistSong({
                                    id: song.id,
                                    title: song.title,
                                    trackData: {
                                      title: song.title,
                                      artist: song.artist,
                                      artistId: song.artistId,
                                      coverUrl: song.coverUrl,
                                      audioUrl: song.audioUrl,
                                      duration: song.duration,
                                    }
                                  });
                                }}
                                className="p-1.5 rounded-full hover:bg-muted transition-colors flex-shrink-0"
                                title="Add to playlist"
                              >
                                <ListPlus className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Discover Section */}
                {showDiscover && hasDiscoverResults && (
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                      <Globe className="w-4 h-4 text-accent" /> Discover
                      {isSearchingDiscover && <Loader2 className="w-3 h-3 animate-spin" />}
                    </h3>

                    {/* Discover Albums */}
                    {discoverAlbums.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs text-muted-foreground mb-2 px-1 flex items-center gap-1">
                          <Disc className="w-3 h-3" /> Albums
                        </p>
                        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                          {discoverAlbums.map((album) => (
                            <Link
                              key={album.id}
                              to={`/album/${encodeURIComponent(album.id)}`}
                              onClick={onClose}
                              className="flex flex-col gap-2 p-2 rounded-xl hover:bg-muted/50 transition-colors group min-w-[100px] max-w-[100px]"
                            >
                              <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-accent/30 to-primary/30 overflow-hidden flex-shrink-0 relative">
                                {album.coverUrl ? (
                                  <img src={album.coverUrl} alt={album.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                                ) : (
                                  <Disc className="w-8 h-8 text-muted-foreground absolute inset-0 m-auto" />
                                )}
                                {/* Play overlay */}
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Play className="w-6 h-6 text-white fill-white" />
                                </div>
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold truncate group-hover:text-primary transition-colors">{album.title}</p>
                                <p className="text-xs text-muted-foreground truncate">{album.artist}</p>
                                {album.year && <p className="text-xs text-muted-foreground/60">{album.year}</p>}
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Discover Artists */}
                    {discoverArtists.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs text-muted-foreground mb-2 px-1">Artists</p>
                        <div className="flex gap-3 overflow-x-auto pb-2">
                          {discoverArtists.map((artist) => (
                            <Link
                              key={artist.id}
                              to={`/artist/${artist.id}`}
                              onClick={onClose}
                              className="flex flex-col items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors group min-w-[80px]"
                            >
                              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-accent to-primary flex items-center justify-center overflow-hidden">
                                {artist.avatarUrl ? (
                                  <img src={artist.avatarUrl} alt={artist.name} className="w-full h-full object-cover" />
                                ) : (
                                  <User className="w-6 h-6 text-primary-foreground" />
                                )}
                              </div>
                              <p className="text-xs font-medium text-center truncate max-w-[80px] group-hover:text-primary transition-colors">
                                {artist.name}
                              </p>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Discover Songs */}
                    {discoverSongs.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2 px-1">Songs</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {discoverSongs.map((song) => (
                            <div
                              key={song.id}
                              className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors w-full text-left group"
                            >
                              <button
                                onClick={() => handlePlayDiscoverSong(song)}
                                className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0"
                              >
                                <img src={song.coverUrl} alt={song.title} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Play className="w-5 h-5 text-white" />
                                </div>
                              </button>
                              <button
                                onClick={() => handlePlayDiscoverSong(song)}
                                className="flex-1 min-w-0 text-left"
                              >
                                <p className="font-medium truncate group-hover:text-primary transition-colors text-sm">{song.title}</p>
                                <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                              </button>
                              <div className="flex items-center gap-0.5 flex-shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const track = jiosaavnToTrack(song);
                                    toggleFavorite(song.id, track);
                                  }}
                                  className="p-1.5 rounded-full hover:bg-muted transition-colors"
                                  title={isFavorite(song.id) ? "Remove from favorites" : "Add to favorites"}
                                >
                                  <Heart className={cn(
                                    "w-3.5 h-3.5 transition-colors",
                                    isFavorite(song.id) ? "fill-red-500 text-red-500" : "text-muted-foreground hover:text-red-400"
                                  )} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPlaylistSong({
                                      id: song.id,
                                      title: song.title,
                                      trackData: {
                                        title: song.title,
                                        artist: song.artist,
                                        artistId: song.artistId,
                                        coverUrl: song.coverUrl,
                                        audioUrl: song.audioUrl,
                                        duration: song.duration,
                                      }
                                    });
                                  }}
                                  className="p-1.5 rounded-full hover:bg-muted transition-colors"
                                  title="Add to playlist"
                                >
                                  <ListPlus className="w-3.5 h-3.5 text-muted-foreground hover:text-primary transition-colors" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!hasAnyResults && !isSearching && (
                  <div className="text-center py-8 text-muted-foreground">
                    No results found for "{query}"
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Search millions of songs</p>
                <p className="text-sm mt-1">Type to search your library and discover new music</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add to Playlist Modal */}
      {
        playlistSong && (
          <AddToPlaylistModal
            isOpen={!!playlistSong}
            onClose={() => setPlaylistSong(null)}
            songId={playlistSong.id}
            songTitle={playlistSong.title}
            trackData={playlistSong.trackData}
          />
        )
      }
    </>
  );
}
