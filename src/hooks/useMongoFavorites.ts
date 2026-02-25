import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { favoritesApi } from "@/lib/mongodb";
import { Track } from "@/contexts/PlayerContext";
import { jiosaavnApi } from "@/lib/jiosaavn";

// Extended favorite type to support external songs
interface ExtendedFavorite {
  songId: string;
  isExternal?: boolean;
  metadata?: {
    title: string;
    artist: string;
    artistId: string;
    coverUrl: string;
    audioUrl: string;
    duration: number;
  };
}

export function useMongoFavorites() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [favoriteMetadata, setFavoriteMetadata] = useState<Map<string, ExtendedFavorite>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  // Load favorites with full metadata
  const loadFavoritesWithMetadata = useCallback(async () => {
    if (!user) {
      setFavorites(new Set());
      setFavoriteMetadata(new Map());
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Get full favorites data including metadata
      const { favorites: favData } = await favoritesApi.getAll(user.id);
      const ids = new Set<string>();
      const metadata = new Map<string, ExtendedFavorite>();
      
      for (const fav of favData || []) {
        const favDoc = fav as unknown as ExtendedFavorite;
        ids.add(favDoc.songId);
        
        // For external songs, try to get metadata from DB or fetch from API
        if (favDoc.songId.startsWith("jiosaavn_")) {
          if (favDoc.isExternal && favDoc.metadata) {
            metadata.set(favDoc.songId, favDoc);
          } else {
            // Metadata not stored - fetch from JioSaavn API
            try {
              const songData = await jiosaavnApi.getSong(favDoc.songId);
              if (songData) {
                const enrichedFav: ExtendedFavorite = {
                  songId: favDoc.songId,
                  isExternal: true,
                  metadata: {
                    title: songData.title,
                    artist: songData.artist,
                    artistId: songData.artistId,
                    coverUrl: songData.coverUrl,
                    audioUrl: songData.audioUrl,
                    duration: songData.duration,
                  },
                };
                metadata.set(favDoc.songId, enrichedFav);
              }
            } catch (err) {
              console.error("Error fetching song metadata:", err);
            }
          }
        }
      }
      
      setFavorites(ids);
      setFavoriteMetadata(metadata);
    } catch (error) {
      console.error("Error loading favorites from MongoDB:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadFavoritesWithMetadata();
  }, [loadFavoritesWithMetadata]);

  const toggleFavorite = useCallback(async (songId: string, trackData?: Track) => {
    if (!user) return;

    const isFavorited = favorites.has(songId);
    const isExternal = songId.startsWith("jiosaavn_");

    // Optimistic update
    setFavorites((prev) => {
      const next = new Set(prev);
      if (isFavorited) {
        next.delete(songId);
      } else {
        next.add(songId);
      }
      return next;
    });

    try {
      if (isFavorited) {
        await favoritesApi.remove(user.id, songId);
        setFavoriteMetadata((prev) => {
          const next = new Map(prev);
          next.delete(songId);
          return next;
        });
      } else {
        // For external songs, store metadata
        if (isExternal && trackData) {
          await favoritesApi.addExternal(user.id, songId, {
            title: trackData.title,
            artist: trackData.artist,
            artistId: trackData.artistId,
            coverUrl: trackData.coverUrl,
            audioUrl: trackData.audioUrl,
            duration: trackData.duration,
          });
          setFavoriteMetadata((prev) => {
            const next = new Map(prev);
            next.set(songId, {
              songId,
              isExternal: true,
              metadata: {
                title: trackData.title,
                artist: trackData.artist,
                artistId: trackData.artistId,
                coverUrl: trackData.coverUrl,
                audioUrl: trackData.audioUrl,
                duration: trackData.duration,
              },
            });
            return next;
          });
        } else {
          await favoritesApi.add(user.id, songId);
        }
      }
    } catch (error) {
      // Revert on error
      setFavorites((prev) => {
        const next = new Set(prev);
        if (isFavorited) {
          next.add(songId);
        } else {
          next.delete(songId);
        }
        return next;
      });
      console.error("Error toggling favorite:", error);
    }
  }, [user, favorites]);

  const isFavorite = useCallback((songId: string) => favorites.has(songId), [favorites]);

  const getFavoriteMetadata = useCallback((songId: string) => favoriteMetadata.get(songId), [favoriteMetadata]);

  return { 
    favorites, 
    toggleFavorite, 
    isFavorite, 
    isLoading, 
    favoriteMetadata, 
    getFavoriteMetadata,
    refresh: loadFavoritesWithMetadata
  };
}
