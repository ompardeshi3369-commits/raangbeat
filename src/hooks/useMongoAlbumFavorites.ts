import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { albumFavoritesApi } from "@/lib/mongodb";

interface ExtendedAlbumFavorite {
  albumId: string;
  metadata?: {
    title: string;
    artist: string;
    coverUrl: string;
    songCount: number;
  };
}

export function useMongoAlbumFavorites() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [favoriteMetadata, setFavoriteMetadata] = useState<Map<string, ExtendedAlbumFavorite>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  const loadFavoritesWithMetadata = useCallback(async () => {
    if (!user) {
      setFavorites(new Set());
      setFavoriteMetadata(new Map());
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { favorites: favData } = await albumFavoritesApi.getAll(user.id);
      const ids = new Set<string>();
      const metadata = new Map<string, ExtendedAlbumFavorite>();
      
      for (const fav of favData || []) {
        // The API returns 'songId' as the primary key because we reused the 'add_external_favorite' logic
        const favDoc = fav as unknown as { songId: string, metadata?: any };
        ids.add(favDoc.songId);
        
        if (favDoc.metadata) {
          metadata.set(favDoc.songId, {
            albumId: favDoc.songId,
            metadata: favDoc.metadata
          });
        }
      }
      
      setFavorites(ids);
      setFavoriteMetadata(metadata);
    } catch (error) {
      console.error("Error loading album favorites from MongoDB:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadFavoritesWithMetadata();
  }, [loadFavoritesWithMetadata]);

  const toggleFavorite = useCallback(async (albumId: string, metadata?: { title: string, artist: string, coverUrl: string, songCount: number }) => {
    if (!user) return;

    const isFavorited = favorites.has(albumId);

    // Optimistic update
    setFavorites((prev) => {
      const next = new Set(prev);
      if (isFavorited) {
        next.delete(albumId);
      } else {
        next.add(albumId);
      }
      return next;
    });

    try {
      if (isFavorited) {
        await albumFavoritesApi.remove(user.id, albumId);
        setFavoriteMetadata((prev) => {
          const next = new Map(prev);
          next.delete(albumId);
          return next;
        });
      } else {
        if (metadata) {
          await albumFavoritesApi.add(user.id, albumId, metadata);
          setFavoriteMetadata((prev) => {
            const next = new Map(prev);
            next.set(albumId, {
              albumId,
              metadata,
            });
            return next;
          });
        }
      }
    } catch (error) {
      // Revert on error
      setFavorites((prev) => {
        const next = new Set(prev);
        if (isFavorited) {
          next.add(albumId);
        } else {
          next.delete(albumId);
        }
        return next;
      });
      console.error("Error toggling album favorite:", error);
    }
  }, [user, favorites]);

  const isFavorite = useCallback((albumId: string) => favorites.has(albumId), [favorites]);

  return { 
    favorites, 
    toggleFavorite, 
    isFavorite, 
    isLoading, 
    favoriteMetadata, 
    refresh: loadFavoritesWithMetadata
  };
}
