import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { playlistsApi, MongoPlaylist, SongMetadata } from "@/lib/mongodb";

export function useMongoPlaylists() {
  const { user } = useAuth();
  const [playlists, setPlaylists] = useState<MongoPlaylist[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadPlaylists = useCallback(async () => {
    if (!user) {
      setPlaylists([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { playlists: data } = await playlistsApi.getAll(user.id);
      setPlaylists(data || []);
    } catch (err) {
      console.error("Error loading playlists from MongoDB:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  const createPlaylist = useCallback(async (name: string, description?: string) => {
    if (!user) return null;
    try {
      const result = await playlistsApi.create(user.id, { name, description });
      await loadPlaylists();
      return result.playlistId;
    } catch (err) {
      console.error("Error creating playlist:", err);
      return null;
    }
  }, [user, loadPlaylists]);

  const deletePlaylist = useCallback(async (playlistId: string) => {
    try {
      await playlistsApi.delete(playlistId);
      setPlaylists((prev) => prev.filter((p) => p._id !== playlistId));
    } catch (err) {
      console.error("Error deleting playlist:", err);
    }
  }, []);

  const addSongToPlaylist = useCallback(async (
    playlistId: string, 
    songId: string,
    metadata?: SongMetadata
  ) => {
    try {
      // If it's an external song and metadata is provided, use the metadata version
      if (songId.startsWith("jiosaavn_") && metadata) {
        await playlistsApi.addSongWithMetadata(playlistId, songId, metadata);
      } else {
        await playlistsApi.addSong(playlistId, songId);
      }
      await loadPlaylists();
    } catch (err) {
      console.error("Error adding song to playlist:", err);
    }
  }, [loadPlaylists]);

  const removeSongFromPlaylist = useCallback(async (playlistId: string, songId: string) => {
    try {
      await playlistsApi.removeSong(playlistId, songId);
      await loadPlaylists();
    } catch (err) {
      console.error("Error removing song from playlist:", err);
    }
  }, [loadPlaylists]);

  return {
    playlists,
    isLoading,
    refresh: loadPlaylists,
    createPlaylist,
    deletePlaylist,
    addSongToPlaylist,
    removeSongFromPlaylist,
  };
}
